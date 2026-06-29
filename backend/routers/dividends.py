"""
GET /api/dividends?force_refresh=false

Auto-fetches dividend history for all held stocks via yfinance,
cross-referenced with actual holding periods from the transaction log.

Scope: stocks only (NSE/BSE/US). MF IDCW plans are excluded —
yfinance does not have reliable IDCW data for Indian MFs.

Caching:
  Per-symbol raw dividends: 30-day disk cache per symbol ("divs:{YF_SYMBOL}")
  Computed result:          24h in-memory per (all / portfolio)
  Frontend localStorage:    30-day (served instantly on cold start, see useDividends.ts)
"""

from __future__ import annotations

import concurrent.futures
import json
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

import pandas as pd
import yfinance as yf
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from src.cache import Cache
from src.data_loader import load_transactions
from src.price_fetcher import get_usd_inr_rate

_DATA_FILE   = Path("data/demo_msp_v2.csv")
_DIVS_START  = "2015-01-01"  # matches chart/benchmark start convention elsewhere in the app
_SKIP_PORTS  = {"Equity", "MF_Portfolio"}
_CACHE_TTL   = 86400.0        # 24h in-memory for computed result
_SYM_DIV_TTL = 30 * 86400.0  # 30 days disk cache per symbol
_FORCE_DEDUPE_SEC = 300.0     # a force-refresh batch hits the same symbol once per portfolio it
                              # appears in (sequential HTTP calls) — within this window, treat an
                              # already-just-refreshed symbol as done rather than refetching it
                              # again for every portfolio that holds it.
_DIVS_BATCH_TIMEOUT = 30.0    # total wall-clock budget for one /api/dividends call's symbol
                              # fetches — a slow/stuck symbol just gets skipped for this response
                              # rather than the whole request (and the Render instance) hanging.

router = APIRouter()

_mem: dict[str, tuple[Any, float]] = {}


class _PortfolioNotCached(Exception):
    """Raised when a non-demo csv_hash misses the FIFO cache — caller must not silently fall
    back to demo data (same contract as add_txn.py's 404 on a cache miss)."""


def _load_txns(csv_hash: str = "demo"):
    cached = Cache().get_fifo(csv_hash)
    if cached is not None:
        txns, _, _, _ = cached
        return txns
    if csv_hash == "demo":
        return load_transactions(_DATA_FILE)
    raise _PortfolioNotCached(csv_hash)


def _shares_on_date(txns: pd.DataFrame, yf_symbol: str, ex_date: pd.Timestamp) -> float:
    ex_day   = pd.Timestamp(ex_date.date())
    tx_dates = txns["date"].dt.normalize()
    mask = (
        (txns["yf_symbol"] == yf_symbol)
        & (tx_dates <= ex_day)
        & txns["type"].isin(["BUY", "SELL"])
    )
    sub   = txns[mask]
    buys  = sub[sub["type"] == "BUY"]["quantity"].sum()
    sells = sub[sub["type"] == "SELL"]["quantity"].sum()
    return max(0.0, float(buys - sells))


def _strip_tz(idx: pd.Index) -> pd.Index:
    if hasattr(idx, "tz") and idx.tz is not None:
        return idx.tz_localize(None)
    return idx


def _read_cache_entry(yf_sym: str) -> dict | None:
    try:
        return Cache().get(f"divs:{yf_sym}")
    except Exception:
        return None


def _read_cached_divs(yf_sym: str) -> pd.Series | None:
    """Synchronous, no-network read of whatever's already cached for a symbol — used to
    pre-seed the batch fallback so a fetch that doesn't finish in time degrades to
    last-known-good data instead of silently dropping the symbol from the response."""
    entry = _read_cache_entry(yf_sym)
    if entry and entry.get("data"):
        d = entry["data"]
        return pd.Series(d["values"], index=pd.to_datetime(d["dates"]))
    return None


def _fetch_symbol_divs(
    yf_sym: str, force: bool = False, is_closed: bool = False, client_since: str | None = None
) -> pd.Series | None:
    """Dividends for one symbol, cached on disk and fetched incrementally — same model as
    history.py's chart cache: closed holdings are fetched once and never refetched (no new
    dividends can ever land on a position you no longer hold); open holdings only fetch the
    window since the last cached ex-date instead of re-pulling full history every refresh.

    `client_since` is the caller's own last-known ex-date for this symbol (their IndexedDB
    cache, which survives a Render redeploy — this backend's disk cache doesn't). When this
    backend's own cache is empty (e.g. right after a deploy) but the client already has data,
    use their date as the fetch-from point instead of re-pulling the full 2015-onward history.
    Single-user app assumption: the one browser that supplies this hint is the cache's only
    real consumer, so a hint-seeded entry never needs to be "completed" for anyone else."""
    entry = _read_cache_entry(yf_sym)

    cached_series = None
    if entry and entry.get("data"):
        d = entry["data"]
        cached_series = pd.Series(d["values"], index=pd.to_datetime(d["dates"]))

    # Closed position — already fetched once, nothing new can ever land on it.
    if entry and entry.get("closed"):
        return cached_series

    # Open position still within its freshness window — serve cache as-is, no network call.
    # Forced refreshes use a much shorter window so a symbol held across several portfolios
    # gets fetched once per refresh batch, not once per portfolio that holds it.
    fresh_window = _FORCE_DEDUPE_SEC if force else _SYM_DIV_TTL
    if cached_series is not None and (time.time() - entry.get("ts", 0)) < fresh_window:
        return cached_series

    try:
        if cached_series is not None and not cached_series.empty:
            since = cached_series.index.max() + pd.Timedelta(days=1)
        elif client_since:
            since = pd.Timestamp(client_since) + pd.Timedelta(days=1)
        else:
            since = pd.Timestamp(_DIVS_START)
        # Bounded start — `Ticker.dividends` has no start param and walks back to a symbol's
        # full listing history (seen fetching from 1927 for old US tickers); `history(start=...)`
        # keeps every fetch (first or incremental) capped to what the app actually needs.
        hist = yf.Ticker(yf_sym).history(start=since.strftime("%Y-%m-%d"), actions=True)
        raw  = hist["Dividends"] if "Dividends" in hist.columns else pd.Series(dtype=float)
        raw  = raw[raw > 0]
    except Exception as e:
        print(f"[dividends] {yf_sym}: fetch error — {e}", file=sys.stderr)
        return cached_series

    if raw is None or (hasattr(raw, "empty") and raw.empty):
        # No new events — still refresh ts/closed flag so we don't hit yfinance again until TTL.
        _cache_sym_divs(yf_sym, cached_series, closed=is_closed)
        return cached_series

    if isinstance(raw, pd.DataFrame):
        col = "Dividends" if "Dividends" in raw.columns else raw.columns[0]
        raw = raw[col]

    new_series = pd.Series(raw.values, index=_strip_tz(raw.index))
    merged = (
        pd.concat([cached_series, new_series]).sort_index()
        if cached_series is not None else new_series
    )
    merged = merged[~merged.index.duplicated(keep="last")]

    _cache_sym_divs(yf_sym, merged, closed=is_closed)
    return merged


def _cache_sym_divs(yf_sym: str, series: pd.Series | None, closed: bool = False) -> None:
    try:
        Cache().set(f"divs:{yf_sym}", {
            "data": {
                "dates":  [str(d) for d in series.index],
                "values": [float(v) for v in series.values],
            } if series is not None and not series.empty else None,
            "ts": time.time(),
            "closed": closed,
        })
    except Exception:
        pass


def _current_shares(txns: pd.DataFrame, yf_symbol: str) -> float:
    """Total shares currently held for yf_symbol across whatever portfolio scope `txns`
    already represents — no date cutoff, unlike `_shares_on_date`."""
    sub   = txns[(txns["yf_symbol"] == yf_symbol) & txns["type"].isin(["BUY", "SELL"])]
    buys  = sub[sub["type"] == "BUY"]["quantity"].sum()
    sells = sub[sub["type"] == "SELL"]["quantity"].sum()
    return max(0.0, float(buys - sells))


def _compute(
    txns: pd.DataFrame, usd_inr: float, portfolio: str | None = None, force: bool = False,
    since_hints: dict[str, str] | None = None,
    symbols_filter: set[str] | None = None,
) -> dict:
    since_hints = since_hints or {}
    if "portfolio" in txns.columns:
        txns = txns[~txns["portfolio"].isin(_SKIP_PORTS)].copy()

    # Closed/open status is symbol-level (the disk cache is shared across every portfolio
    # scope), so it must be decided from the full non-skip txn set, not the portfolio filter
    # applied below — a symbol still held in another portfolio isn't "closed" for caching.
    all_txns = txns
    if portfolio and "portfolio" in txns.columns:
        filtered = txns[txns["portfolio"] == portfolio].copy()
        if filtered.empty and "tags" in txns.columns:
            # Portfolio is a Label from "Copy Holdings" — the portfolio column still holds the
            # broker name; the label lives as a tag value (e.g. "Asset Class=Stocks").
            def _has_label(tag_str, label: str) -> bool:
                if not tag_str or (isinstance(tag_str, float)):
                    return False
                return any(p.split("=", 1)[1] == label for p in str(tag_str).split(";") if "=" in p)
            filtered = txns[txns["tags"].apply(lambda t: _has_label(t, portfolio))].copy()
        txns = filtered

    sym_meta: dict[str, dict] = (
        txns[txns["type"] == "BUY"]
        .groupby("yf_symbol")
        .first()[["symbol", "exchange", "currency"]]
        .to_dict("index")
    )

    inv_per_sym: dict[str, float] = defaultdict(float)
    for _, row in txns[txns["type"] == "BUY"].iterrows():
        cost = row["quantity"] * row["price"]
        if str(row.get("currency", "INR")) == "USD":
            cost *= usd_inr
        inv_per_sym[row["yf_symbol"]] += cost

    cutoff_trailing = pd.Timestamp.now() - pd.DateOffset(years=1)

    # Fetch all symbols in parallel — symbol-level disk cache (shared across every portfolio
    # scope) means a symbol held in 5 portfolios is fetched once total, not once per portfolio;
    # closed symbols are fetched once ever, open symbols only pull the window since last fetch.
    # Bounded to a total wall-clock budget rather than per-symbol: a slow/stuck symbol just
    # gets skipped (None — it'll fall back to whatever was last cached) instead of the whole
    # request hanging on it. The executor is shut down without waiting so a still-running
    # symbol fetch finishes in the background and caches itself for next time regardless.
    sym_keys = list(sym_meta.keys())
    if symbols_filter:
        sym_keys = [s for s in sym_keys if s in symbols_filter]
    closed_map = {s: _current_shares(all_txns, s) <= 0 for s in sym_keys}
    # Pre-seed with whatever's already cached (cheap, no network) so a symbol whose fetch
    # doesn't finish within the batch budget falls back to last-known-good data instead of
    # silently dropping out of the response (and out of the aggregate totals) entirely.
    divs_map: dict[str, pd.Series | None] = {s: _read_cached_divs(s) for s in sym_keys}
    ex = concurrent.futures.ThreadPoolExecutor(max_workers=10)
    futures = {
        ex.submit(_fetch_symbol_divs, s, force, closed_map[s], since_hints.get(s)): s
        for s in sym_keys
    }
    done, _pending = concurrent.futures.wait(futures, timeout=_DIVS_BATCH_TIMEOUT)
    _pending_syms = {futures[f] for f in _pending}
    for fut in done:
        try:
            divs_map[futures[fut]] = fut.result()
        except Exception as e:
            print(f"[dividends] {futures[fut]}: future error — {e}", file=sys.stderr)
    ex.shutdown(wait=False)

    by_symbol: list[dict] = []
    timeline:  list[dict] = []
    by_year:   dict[str, float] = defaultdict(float)
    by_month:  dict[str, float] = defaultdict(float)
    grand_total = 0.0
    grand_count = 0
    grand_proj  = 0.0

    for yf_sym, meta in sym_meta.items():
        divs = divs_map.get(yf_sym)
        if divs is None or divs.empty:
            continue

        events:        list[dict] = []
        sym_total:     float = 0.0
        trailing_12m:  float = 0.0
        month_pattern: list[int] = []

        for ex_date, div_per_share in divs.items():
            ex_ts  = pd.Timestamp(ex_date)
            shares = _shares_on_date(txns, yf_sym, ex_ts)
            if shares <= 0:
                continue

            amount_native = shares * float(div_per_share)
            currency      = str(meta.get("currency", "INR"))
            amount_inr    = amount_native * usd_inr if currency == "USD" else amount_native

            events.append({
                "ex_date":       ex_ts.strftime("%Y-%m-%d"),
                "shares_held":   round(shares, 4),
                "div_per_share": round(float(div_per_share), 4),
                "div_currency":  currency,
                "amount":        round(amount_inr, 2),
                "amount_native": round(amount_native, 2),
            })

            sym_total   += amount_inr
            grand_total += amount_inr
            grand_count += 1

            by_year[str(ex_ts.year)]          += amount_inr
            by_month[ex_ts.strftime("%Y-%m")]  += amount_inr
            month_pattern.append(ex_ts.month)

            timeline.append({
                "date":     ex_ts.strftime("%Y-%m-%d"),
                "symbol":   meta["symbol"],
                "exchange": meta["exchange"],
                "amount":   round(amount_inr, 2),
            })

            if ex_ts >= cutoff_trailing:
                trailing_12m += amount_inr

        if not events:
            continue

        invested = inv_per_sym.get(yf_sym, 0.0)
        yoc      = (sym_total / invested * 100) if invested > 0 else None
        proj     = round(trailing_12m, 2)
        grand_proj += proj

        by_symbol.append({
            "symbol":           meta["symbol"],
            "yf_symbol":        yf_sym,
            "exchange":         meta["exchange"],
            "total_dividends":  round(sym_total, 2),
            "event_count":      len(events),
            "yield_on_cost":    round(yoc, 2) if yoc is not None else None,
            "last_ex_date":     events[-1]["ex_date"],
            "projected_annual": proj,
            "month_pattern":    sorted(set(month_pattern)),
            "events": sorted(events, key=lambda e: e["ex_date"], reverse=True),
        })

    by_symbol.sort(key=lambda x: x["total_dividends"], reverse=True)
    timeline.sort(key=lambda x: x["date"], reverse=True)

    skipped_symbols = sorted(
        sym_meta[s]["symbol"] for s in _pending_syms if s in sym_meta
    )

    return {
        "summary": {
            "total_dividends_inr":    round(grand_total, 2),
            "dividend_count":         grand_count,
            "symbols_with_dividends": len(by_symbol),
            "projected_annual_inr":   round(grand_proj, 2),
        },
        "by_symbol": by_symbol,
        "by_year":   {k: round(v, 2) for k, v in sorted(by_year.items())},
        "by_month":  {k: round(v, 2) for k, v in sorted(by_month.items())},
        "timeline":  timeline,
        "skipped_symbols": skipped_symbols,
    }


def clear_cache() -> None:
    """Clear the in-memory dividends cache. Call after a new CSV is uploaded."""
    _mem.clear()


@router.get("/api/dividends/debug")
def debug_dividends(symbol: str = Query(..., description="Clean symbol, e.g. GOOGL")):
    txns = _load_txns()
    if "portfolio" in txns.columns:
        txns = txns[~txns["portfolio"].isin(_SKIP_PORTS)].copy()

    sym_upper = symbol.strip().upper()
    mask = (
        txns["symbol"].str.upper().str.contains(sym_upper, na=False) |
        txns["yf_symbol"].str.upper().str.contains(sym_upper, na=False)
    )
    matched = txns[mask].copy()

    rows = []
    for _, r in matched.iterrows():
        rows.append({
            "date":      str(r["date"].date()),
            "portfolio": r.get("portfolio", ""),
            "symbol":    r.get("symbol", ""),
            "yf_symbol": r.get("yf_symbol", ""),
            "type":      r.get("type", ""),
            "quantity":  float(r.get("quantity", 0)),
            "price":     float(r.get("price", 0)),
            "currency":  r.get("currency", "INR"),
        })

    yf_syms = sorted(matched["yf_symbol"].unique().tolist()) if not matched.empty else []
    return JSONResponse(content={
        "query":              symbol,
        "yf_symbols_found":   yf_syms,
        "transaction_count":  len(rows),
        "transactions":       sorted(rows, key=lambda x: x["date"]),
    })


@router.get("/api/dividends")
def get_dividends(
    force_refresh: bool = Query(False),
    portfolio: str = Query(None),
    csv_hash: str = Query("demo"),
    since_hints: str = Query(None, description="JSON map of yf_symbol -> caller's last-known "
                                                  "ex-date, used when this backend's own disk "
                                                  "cache is empty (e.g. just redeployed)"),
    symbols: str = Query(None, description="Comma-separated yf_symbols to process; "
                                           "skips in-memory cache (partial/batched request)"),
):
    symbols_set = set(symbols.split(',')) if symbols else None
    cache_key = f"dividends:{csv_hash}:{portfolio or ''}"
    now       = time.monotonic()

    if not force_refresh and not symbols_set:
        cached = _mem.get(cache_key)
        if cached and (now - cached[1]) < _CACHE_TTL:
            return JSONResponse(content=cached[0])

    hints: dict[str, str] = {}
    if since_hints:
        try:
            hints = json.loads(since_hints)
        except Exception:
            hints = {}

    try:
        txns = _load_txns(csv_hash)
    except _PortfolioNotCached:
        return JSONResponse(
            status_code=404,
            content={"error": "Portfolio not in cache. Please re-import your CSV first."},
        )
    usd_inr = get_usd_inr_rate()
    result  = _compute(txns, usd_inr, portfolio=portfolio, force=force_refresh, since_hints=hints,
                       symbols_filter=symbols_set)

    # Only cache full (non-batched) results with no skipped symbols.
    if not symbols_set and not result["skipped_symbols"]:
        _mem[cache_key] = (result, now)
    return JSONResponse(content=result)
