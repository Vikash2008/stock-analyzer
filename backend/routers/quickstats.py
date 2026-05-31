"""
GET /api/quickstats?yf_symbol=APOLLOHOSP.NS
GET /api/quickstats?yf_symbol=META&force_refresh=true

Returns key valuation stats (P/E, MCap, 52W range, analyst target) for the
Report tab. Lightweight — only ticker.info, no financial statements.

Caching:
  In-memory : 60s burst (same process)
  Disk      : 24h per symbol (via Cache "quickstats" permanent layer)
"""

from __future__ import annotations

import math
import time

import yfinance as yf
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from src.cache import Cache

router = APIRouter()

_mem: dict[str, tuple[dict, float]] = {}
_MEM_TTL  = 60.0       # 60s in-memory burst
_DISK_TTL = 86400.0    # 24h per-symbol disk


def _clean(v):
    if v is None:
        return None
    try:
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    except (TypeError, ValueError):
        return v


def _fmt_cap(v, currency: str):
    if not v:
        return None
    if currency == "INR":
        cr = v / 1e7
        if cr >= 100_000:
            return f"₹{cr / 1_00_000:.1f}L Cr"
        return f"₹{int(cr):,} Cr"
    else:
        if v >= 1e12:
            return f"${v / 1e12:.2f}T"
        if v >= 1e9:
            return f"${v / 1e9:.1f}B"
        return f"${v / 1e6:.0f}M"


def _fetch(yf_symbol: str) -> dict:
    is_indian = yf_symbol.upper().endswith(".NS") or yf_symbol.upper().endswith(".BO")
    currency = "INR" if is_indian else "USD"
    try:
        ticker = yf.Ticker(yf_symbol)
        info = ticker.info or {}
    except Exception:
        info = {}

    current = _clean(info.get("currentPrice") or info.get("regularMarketPrice"))
    target  = _clean(info.get("targetMeanPrice"))
    upside  = (
        round((target - current) / current * 100, 1)
        if target and current
        else None
    )
    mkt_cap = _clean(info.get("marketCap"))

    rec_key = (info.get("recommendationKey") or "").lower()
    rec_map = {
        "strong_buy":   "Strong Buy",
        "buy":          "Buy",
        "hold":         "Hold",
        "underperform": "Underperform",
        "sell":         "Sell",
    }
    rec_label = rec_map.get(rec_key) or (rec_key or None)

    return {
        "yf_symbol":            yf_symbol,
        "currency":             currency,
        "trailing_pe":          _clean(info.get("trailingPE")),
        "forward_pe":           _clean(info.get("forwardPE")),
        "market_cap":           mkt_cap,
        "market_cap_display":   _fmt_cap(mkt_cap, currency),
        "week_52_high":         _clean(info.get("fiftyTwoWeekHigh")),
        "week_52_low":          _clean(info.get("fiftyTwoWeekLow")),
        "current_price":        current,
        "beta":                 _clean(info.get("beta")),
        "dividend_yield":       _clean(info.get("dividendYield")),
        "target_mean_price":    target,
        "recommendation":       rec_label,
        "num_analyst_opinions": info.get("numberOfAnalystOpinions"),
        "upside_pct":           upside,
        "partial":              not bool(info),
    }


@router.get("/api/quickstats")
def get_quickstats(
    yf_symbol:     str  = Query(...),
    force_refresh: bool = Query(False),
):
    key = yf_symbol.upper()
    now = time.monotonic()

    # In-memory burst cache
    if not force_refresh and key in _mem:
        cached_data, ts = _mem[key]
        if now - ts < _MEM_TTL:
            return JSONResponse(content=cached_data)

    # Disk cache — per-symbol TTL check inside the stored dict
    disk = Cache()
    if not force_refresh:
        store = disk.get("quickstats") or {}
        entry = store.get(key)
        if entry and (time.time() - entry.get("ts", 0)) < _DISK_TTL:
            result = entry["data"]
            _mem[key] = (result, now)
            return JSONResponse(content=result)

    # Fetch fresh from yfinance
    result = _fetch(yf_symbol)

    # Merge into disk cache store
    store = disk.get("quickstats") or {}
    store[key] = {"data": result, "ts": time.time()}
    disk.set("quickstats", store)

    _mem[key] = (result, now)
    return JSONResponse(content=result)
