"""
GET /api/history?yf_symbol=INFY.NS&start=2020-01-01
GET /api/history?yf_symbol=INFY.NS&period=1d   (intraday 5-min bars)

Returns price history for the Charts tab.
Uses query param (not path param) so dots in yf_symbol are URL-safe.

In-memory cache: 1 hour for daily history, 5 min for intraday.
"""

from __future__ import annotations

import time
from typing import Optional

import pandas as pd
import yfinance as yf
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

router = APIRouter()

_cache: dict[str, tuple[dict, float]] = {}
_TTL         = 3600.0  # 1 hour  — daily history
_INTRADAY_TTL = 300.0  # 5 min   — intraday


def _fetch(yf_symbol: str, start: str) -> dict:
    try:
        start_dt = pd.Timestamp(start) - pd.Timedelta(days=30)
        df = yf.download(yf_symbol, start=start_dt, progress=False, auto_adjust=True)
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


def _fetch_intraday(yf_symbol: str) -> dict:
    try:
        df = yf.download(yf_symbol, period="1d", interval="5m", progress=False, auto_adjust=True)
        if df.empty:
            return {"dates": [], "prices": []}
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [c[0] for c in df.columns]
        closes = df["Close"].dropna()
        return {
            "dates":  closes.index.strftime("%H:%M").tolist(),
            "prices": [round(float(p), 4) for p in closes.tolist()],
        }
    except Exception as exc:
        return {"dates": [], "prices": [], "error": str(exc)}


@router.get("/api/history")
def get_history(
    yf_symbol: str = Query(...),
    start:     Optional[str] = Query(None, description="First transaction date (YYYY-MM-DD)"),
    period:    Optional[str] = Query(None, description="'1d' for intraday 5-min bars"),
):
    now = time.monotonic()

    if period == "1d":
        cache_key = f"{yf_symbol}:intraday"
        cached = _cache.get(cache_key)
        if cached and (now - cached[1]) < _INTRADAY_TTL:
            return JSONResponse(content=cached[0])
        data = _fetch_intraday(yf_symbol)
        _cache[cache_key] = (data, now)
        return JSONResponse(content=data)

    if not start:
        return JSONResponse(content={"dates": [], "prices": [], "error": "start required"})

    cache_key = f"{yf_symbol}:{start[:7]}"
    cached = _cache.get(cache_key)
    if cached and (now - cached[1]) < _TTL:
        return JSONResponse(content=cached[0])

    data = _fetch(yf_symbol, start)
    _cache[cache_key] = (data, now)
    return JSONResponse(content=data)
