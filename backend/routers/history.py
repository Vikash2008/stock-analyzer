"""
GET /api/history?yf_symbol=INFY.NS&start=2020-01-01
GET /api/history?yf_symbol=INFY.NS&period=1d   (intraday 5-min bars)

Returns price history for the Charts tab.
Uses query param (not path param) so dots in yf_symbol are URL-safe.

Daily history: one in-memory entry per symbol holding the full known series.
Re-fetches only pull data since the last cached bar and merge it in, instead
of re-downloading the whole range every time. Whether a re-fetch happens at
all is gated by market_hours.is_stale() — open-market symbols recheck every
30 min (matching the frontend's own auto-refresh tick), closed-market symbols
only recheck once per exchange close.
"""

from __future__ import annotations

import asyncio
import time
from typing import Optional

import pandas as pd
import yfinance as yf
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from backend.market_hours import is_stale
from src.price_fetcher import get_prices_and_prev_close

router = APIRouter()

_series_cache: dict[str, dict] = {}     # yf_symbol -> {dates, prices, fetched_at, last_bar_date}
_intraday_cache: dict[str, tuple[dict, float]] = {}
_INTRADAY_TTL = 3600.0  # 1 hour  — intraday
_sem          = asyncio.Semaphore(4)  # max 4 concurrent yfinance fetches


def _download(yf_symbol: str, start) -> dict:
    try:
        df = yf.download(yf_symbol, start=start, progress=False, auto_adjust=True)
        # Some yfinance versions return empty for index symbols (^NDX, ^GSPC etc.)
        # with auto_adjust=True; retry without it as a fallback.
        if df.empty:
            df = yf.download(yf_symbol, start=start, progress=False, auto_adjust=False)
        if df.empty:
            return {"dates": [], "prices": []}
        # Flatten multi-level columns (yfinance ≥ 0.2.38)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [c[0] for c in df.columns]
        closes = df["Close"].dropna()
        return {
            "dates":  closes.index.strftime("%Y-%m-%d").tolist(),
            "prices": [round(float(p), 4) for p in closes.tolist()],
        }
    except Exception as exc:
        return {"dates": [], "prices": [], "error": str(exc)}


def _fetch_incremental(yf_symbol: str, start: str) -> dict:
    """Fetch full or delta history for yf_symbol and merge into _series_cache."""
    cached = _series_cache.get(yf_symbol)
    start_dt = pd.Timestamp(start) - pd.Timedelta(days=30)

    if not cached:
        fresh = _download(yf_symbol, start_dt)
        if fresh.get("error") or not fresh["dates"]:
            return fresh
        entry = {
            "dates": fresh["dates"], "prices": fresh["prices"],
            "fetched_at": time.time(), "last_bar_date": fresh["dates"][-1],
        }
        _series_cache[yf_symbol] = entry
        return entry

    # Defensive: caller wants data older than what we have cached.
    if start_dt < pd.Timestamp(cached["dates"][0]):
        fresh = _download(yf_symbol, start_dt)
        if fresh.get("error"):
            return cached
        entry = {
            "dates": fresh["dates"], "prices": fresh["prices"],
            "fetched_at": time.time(), "last_bar_date": fresh["dates"][-1] if fresh["dates"] else cached["last_bar_date"],
        }
        _series_cache[yf_symbol] = entry
        return entry

    # Delta fetch — re-pull from the last cached bar onward (yfinance can revise
    # an in-progress daily bar), merge into the existing series.
    delta = _download(yf_symbol, cached["last_bar_date"])
    if delta.get("error"):
        # Keep serving the existing cache on a transient fetch failure.
        return cached

    merged = dict(zip(cached["dates"], cached["prices"]))
    merged.update(dict(zip(delta["dates"], delta["prices"])))
    dates  = sorted(merged.keys())
    prices = [merged[d] for d in dates]

    entry = {
        "dates": dates, "prices": prices,
        "fetched_at": time.time(),
        "last_bar_date": dates[-1] if dates else cached["last_bar_date"],
    }
    _series_cache[yf_symbol] = entry
    return entry


def _slice_response(entry: dict, start: str) -> dict:
    dates, prices = entry["dates"], entry["prices"]
    i = 0
    while i < len(dates) and dates[i] < start:
        i += 1
    return {"dates": dates[i:], "prices": prices[i:]}


def _fetch_intraday_bars(yf_symbol: str) -> dict:
    try:
        df = yf.download(yf_symbol, period="1d", interval="5m", progress=False, auto_adjust=True)
        if df.empty:
            return {"dates": [], "prices": []}
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [c[0] for c in df.columns]
        closes = df["Close"].dropna()
        idx = closes.index
        if idx.tz is not None:
            idx = idx.tz_convert('Asia/Kolkata')
        else:
            idx = idx.tz_localize('UTC').tz_convert('Asia/Kolkata')

        return {
            "dates":  idx.strftime("%H:%M").tolist(),
            "prices": [round(float(p), 4) for p in closes.tolist()],
        }
    except Exception as exc:
        return {"dates": [], "prices": [], "error": str(exc)}


def _fetch_prev_close(yf_symbol: str) -> Optional[float]:
    # Lightweight quote endpoint instead of a second full OHLCV download —
    # single small JSON response vs 5 days of bars just to read one number.
    try:
        _, prev_closes = get_prices_and_prev_close([yf_symbol])
        return prev_closes.get(yf_symbol)
    except Exception:
        return None


async def _fetch_intraday(yf_symbol: str) -> dict:
    bars, prev_close = await asyncio.gather(
        asyncio.to_thread(_fetch_intraday_bars, yf_symbol),
        asyncio.to_thread(_fetch_prev_close, yf_symbol),
    )
    if "error" in bars:
        return bars
    bars["prev_close"] = prev_close
    return bars


@router.get("/api/history")
async def get_history(
    yf_symbol: str = Query(...),
    start:     Optional[str] = Query(None, description="First transaction date (YYYY-MM-DD)"),
    period:    Optional[str] = Query(None, description="'1d' for intraday 5-min bars"),
):
    now = time.monotonic()

    if period == "1d":
        cache_key = f"{yf_symbol}:intraday"
        cached = _intraday_cache.get(cache_key)
        if cached and (now - cached[1]) < _INTRADAY_TTL:
            return JSONResponse(content=cached[0])
        async with _sem:
            data = await _fetch_intraday(yf_symbol)
        _intraday_cache[cache_key] = (data, now)
        return JSONResponse(content=data)

    if not start:
        return JSONResponse(content={"dates": [], "prices": [], "error": "start required"})

    cached = _series_cache.get(yf_symbol)
    if cached and not is_stale(yf_symbol, cached["fetched_at"], cached["last_bar_date"]):
        return JSONResponse(content=_slice_response(cached, start))

    async with _sem:
        entry = await asyncio.to_thread(_fetch_incremental, yf_symbol, start)
    if "error" in entry:
        return JSONResponse(content=entry)
    return JSONResponse(content=_slice_response(entry, start))
