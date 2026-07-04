"""
GET /api/dividends?symbols=A.NS,B.NS&force_refresh=false&since_hints=...&closed_symbols=...

Fetches raw dividend history per symbol via yfinance — purely symbol-scoped, no portfolio or
CSV awareness at all. Portfolio/holding-period math (which ex-dates you actually held shares
for, how much that's worth in a given portfolio/segment/bucket view) is computed entirely
client-side from this raw data plus the caller's own transaction history (see
frontend/src/utils/dividends.ts) — the same per-symbol series is shared across every view
instead of being re-fetched and re-derived once per portfolio scope.

Scope: stocks only (NSE/BSE/US). MF IDCW plans are excluded —
yfinance does not have reliable IDCW data for Indian MFs.

Caching: per-symbol raw dividends, 30-day disk cache per symbol ("divs:{YF_SYMBOL}"). No
result-level cache on top — assembling N symbols' already-cached series is cheap, so there's
nothing expensive left to memoize at the request level.
"""

from __future__ import annotations

import concurrent.futures
import json
import sys
import time

import pandas as pd
import yfinance as yf
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from src.cache import Cache

_DIVS_START  = "2015-01-01"  # matches chart/benchmark start convention elsewhere in the app
_SYM_DIV_TTL = 30 * 86400.0  # 30 days disk cache per symbol
_FORCE_DEDUPE_SEC = 300.0    # a force-refresh batch hits the same symbol once per caller within
                              # this window — treats an already-just-refreshed symbol as done
                              # rather than refetching it again for an overlapping request.
_DIVS_BATCH_TIMEOUT = 30.0    # total wall-clock budget for one /api/dividends call's symbol
                              # fetches — a slow/stuck symbol just gets skipped for this response
                              # rather than the whole request (and the backend process) hanging.

router = APIRouter()


def _clean_symbol(yf_sym: str) -> str:
    return yf_sym.split(".")[0]


def _exchange_and_currency(yf_sym: str) -> tuple[str, str]:
    """Same rule data_loader.py uses when the CSV has no explicit currency column — a symbol's
    dividend currency is a property of the exchange it's listed on, not of any user's CSV."""
    if yf_sym.endswith(".NS"):
        return "NSE", "INR"
    if yf_sym.endswith(".BO"):
        return "BSE", "INR"
    return "US", "USD"


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
    history.py's chart cache: a symbol the caller says is fully exited (`closed_symbols`) is
    fetched once and never refetched (no new dividends can ever land on a position no one holds
    anymore); still-open symbols only pull the window since the last cached ex-date.

    `client_since` is the caller's own last-known ex-date for this symbol (their IndexedDB
    cache, which survives a redeploy — this backend's disk cache doesn't). When this backend's
    own cache is empty (e.g. right after a deploy) but the client already has data, use their
    date as the fetch-from point instead of re-pulling the full 2015-onward history."""
    entry = _read_cache_entry(yf_sym)

    cached_series = None
    if entry and entry.get("data"):
        d = entry["data"]
        cached_series = pd.Series(d["values"], index=pd.to_datetime(d["dates"]))

    # Closed position (per caller) — already fetched once, nothing new can ever land on it.
    if entry and entry.get("closed"):
        return cached_series

    # Open position still within its freshness window — serve cache as-is, no network call.
    # Forced refreshes use a much shorter window so a symbol requested twice in close
    # succession (e.g. overlapping batches) gets fetched once, not once per request.
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


@router.get("/api/dividends/debug")
def debug_dividends(symbol: str = Query(..., description="yf_symbol, e.g. GOOGL or INFY.NS")):
    entry = _read_cache_entry(symbol)
    return JSONResponse(content={"query": symbol, "cache_entry": entry})


@router.get("/api/dividends")
def get_dividends(
    symbols: str = Query(..., description="Comma-separated yf_symbols to fetch"),
    force_refresh: bool = Query(False),
    closed_symbols: str = Query(None, description="Comma-separated yf_symbols the caller knows "
                                                    "are fully exited everywhere — cached "
                                                    "permanently, never re-fetched"),
    since_hints: str = Query(None, description="JSON map of yf_symbol -> caller's last-known "
                                                  "ex-date, used when this backend's own disk "
                                                  "cache is empty (e.g. just redeployed)"),
):
    sym_keys = [s for s in symbols.split(",") if s]
    if not sym_keys:
        return JSONResponse(content={"dividends_by_symbol": {}, "skipped_symbols": [], "as_of": time.time()})

    hints: dict[str, str] = {}
    if since_hints:
        try:
            hints = json.loads(since_hints)
        except Exception:
            hints = {}

    closed_set = set(closed_symbols.split(",")) if closed_symbols else set()

    # Pre-seed with whatever's already cached (cheap, no network) so a symbol whose fetch
    # doesn't finish within the batch budget falls back to last-known-good data instead of
    # silently dropping out of the response entirely.
    divs_map: dict[str, pd.Series | None] = {s: _read_cached_divs(s) for s in sym_keys}
    ex = concurrent.futures.ThreadPoolExecutor(max_workers=10)
    futures = {
        ex.submit(_fetch_symbol_divs, s, force_refresh, s in closed_set, hints.get(s)): s
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

    dividends_by_symbol: dict[str, dict] = {}
    for yf_sym in sym_keys:
        divs = divs_map.get(yf_sym)
        if divs is None or divs.empty:
            continue
        exchange, currency = _exchange_and_currency(yf_sym)
        events = [
            {"ex_date": pd.Timestamp(d).strftime("%Y-%m-%d"), "div_per_share": round(float(v), 4)}
            for d, v in divs.items()
        ]
        dividends_by_symbol[yf_sym] = {
            "symbol":   _clean_symbol(yf_sym),
            "exchange": exchange,
            "currency": currency,
            "events":   sorted(events, key=lambda e: e["ex_date"]),
        }

    return JSONResponse(content={
        "dividends_by_symbol": dividends_by_symbol,
        "skipped_symbols": sorted(_pending_syms),
        "as_of": time.time(),
    })
