"""
GET /api/history?yf_symbol=INFY.NS&start=2020-01-01

Returns price history for the Charts tab.
Uses query param (not path param) so dots in yf_symbol are URL-safe.

In-memory cache: 1 hour per symbol — price history rarely changes mid-session.
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
_TTL = 3600.0  # 1 hour


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


@router.get("/api/history")
def get_history(
    yf_symbol: str = Query(...),
    start:     str = Query(..., description="First transaction date (YYYY-MM-DD)"),
):
    cache_key = f"{yf_symbol}:{start[:7]}"  # month-level granularity is fine
    now = time.monotonic()
    cached = _cache.get(cache_key)
    if cached and (now - cached[1]) < _TTL:
        return JSONResponse(content=cached[0])

    data = _fetch(yf_symbol, start)
    _cache[cache_key] = (data, now)
    return JSONResponse(content=data)
