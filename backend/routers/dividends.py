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
_SKIP_PORTS  = {"Equity", "MF_Portfolio"}
_CACHE_TTL   = 86400.0        # 24h in-memory for computed result
_SYM_DIV_TTL = 30 * 86400.0  # 30 days disk cache per symbol

router = APIRouter()

_mem: dict[str, tuple[Any, float]] = {}


def _load_txns(csv_hash: str = "demo"):
    cached = Cache().get_fifo(csv_hash)
    if cached is not None:
        txns, _, _, _ = cached
        return txns
    return load_transactions(_DATA_FILE)


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


def _fetch_symbol_divs(yf_sym: str) -> pd.Series | None:
    """Fetch dividends for one symbol with 30-day disk cache. Returns tz-stripped Series."""
    cache_key = f"divs:{yf_sym}"
    try:
        entry = Cache().get(cache_key)
        if entry and (time.time() - entry.get("ts", 0)) < _SYM_DIV_TTL:
            d = entry.get("data")
            if not d:
                return None
            return pd.Series(d["values"], index=pd.to_datetime(d["dates"]))
    except Exception:
        pass

    try:
        raw = yf.Ticker(yf_sym).dividends
    except Exception as e:
        print(f"[dividends] {yf_sym}: fetch error — {e}", file=sys.stderr)
        return None

    if raw is None or (hasattr(raw, "empty") and raw.empty):
        _cache_sym_divs(yf_sym, None)
        return None

    if isinstance(raw, pd.DataFrame):
        col = "Dividends" if "Dividends" in raw.columns else raw.columns[0]
        raw = raw[col]

    if raw.empty:
        _cache_sym_divs(yf_sym, None)
        return None

    # Strip timezone without converting — preserves local market date
    idx = raw.index
    if hasattr(idx, "tz") and idx.tz is not None:
        idx = idx.tz_localize(None)
    series = pd.Series(raw.values, index=idx)

    _cache_sym_divs(yf_sym, series)
    return series


def _cache_sym_divs(yf_sym: str, series: pd.Series | None) -> None:
    try:
        Cache().set(f"divs:{yf_sym}", {
            "data": {
                "dates":  [str(d) for d in series.index],
                "values": [float(v) for v in series.values],
            } if series is not None else None,
            "ts": time.time(),
        })
    except Exception:
        pass


def _compute(txns: pd.DataFrame, usd_inr: float, portfolio: str | None = None) -> dict:
    if "portfolio" in txns.columns:
        txns = txns[~txns["portfolio"].isin(_SKIP_PORTS)].copy()
    if portfolio and "portfolio" in txns.columns:
        txns = txns[txns["portfolio"] == portfolio].copy()

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

    # Fetch all symbols in parallel — each call hits disk cache if within 30 days
    sym_keys = list(sym_meta.keys())
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        divs_list = list(ex.map(_fetch_symbol_divs, sym_keys))
    divs_map = dict(zip(sym_keys, divs_list))

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
):
    cache_key = f"dividends:{csv_hash}:{portfolio or ''}"
    now       = time.monotonic()

    if not force_refresh:
        cached = _mem.get(cache_key)
        if cached and (now - cached[1]) < _CACHE_TTL:
            return JSONResponse(content=cached[0])

    txns    = _load_txns(csv_hash)
    usd_inr = get_usd_inr_rate()
    result  = _compute(txns, usd_inr, portfolio=portfolio)

    _mem[cache_key] = (result, now)
    return JSONResponse(content=result)
