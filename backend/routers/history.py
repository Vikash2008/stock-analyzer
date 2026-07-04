"""
GET /api/history?yf_symbol=INFY.NS&start=2020-01-01
GET /api/history?yf_symbol=INFY.NS&period=1d   (intraday 5-min bars)

Returns price history for the Charts tab.
Uses query param (not path param) so dots in yf_symbol are URL-safe.

Daily history now reads/writes backend.price_store — the same shared, full-history store
portfolio_history.py's aggregate chart uses, instead of a second independent copy of the same
public market data. Re-fetches only pull data since the last cached bar and merge it in, instead
of re-downloading the whole range every time. Whether a re-fetch happens at all is gated by
market_hours.is_stale() — open-market symbols recheck every 30 min (matching the frontend's own
auto-refresh tick), closed-market symbols only recheck once per exchange close.
"""

from __future__ import annotations

import asyncio
import time
from typing import Optional

import pandas as pd
import yfinance as yf
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from backend import price_store
from backend.market_hours import is_stale
from src.price_fetcher import get_prices_and_prev_close

router = APIRouter()

_intraday_cache: dict[str, tuple[dict, float]] = {}
_INTRADAY_TTL = 3600.0  # 1 hour  — intraday
_FETCH_TIMEOUT = 20.0   # per-request cap on the underlying yfinance call — a single slow/stuck
                        # symbol can no longer hang a request indefinitely; the background thread
                        # still finishes and populates the cache for the next request either way.
_sem          = asyncio.Semaphore(6)  # max concurrent yfinance fetches — was capped at 3 on Render's
                                       # 512MB free tier (8 concurrent pinned it at ~513MB, ~15.4MB/call
                                       # observed). Raised to 6 after the 2026-07 move to the Oracle VM
                                       # (1GB RAM, double Render's), leaving headroom below the 8 that
                                       # previously maxed out the smaller instance.

# The intraday cache is local to this file (a different fetch shape — today's 5-min bars, not
# daily history — kept separate per the plan's Category 3 decision). Never had entries removed —
# cap it to the most-recently-fetched N symbols.
_MAX_INTRADAY_SYMBOLS = 120


def _evict_oldest(cache: dict, max_size: int, ts_of) -> None:
    if len(cache) <= max_size:
        return
    for sym, _ in sorted(cache.items(), key=lambda kv: ts_of(kv[1]))[: len(cache) - max_size]:
        cache.pop(sym, None)


_SINCE_FLOOR = pd.Timestamp("2000-01-01")


def _valid_since(since: Optional[str], start_dt: pd.Timestamp) -> Optional[pd.Timestamp]:
    """Parse+sanity-check a client-supplied `since` hint. Returns None (ignore the hint
    and do a normal fetch) unless it's a real date, not in the future, not absurdly old,
    and actually later than the range we'd fetch anyway — never trusted beyond that."""
    if not since:
        return None
    try:
        dt = pd.Timestamp(since)
    except (ValueError, TypeError):
        return None
    if dt < _SINCE_FLOOR or dt > pd.Timestamp.now().normalize():
        return None
    if dt <= start_dt:
        return None
    return dt


def _fetch_incremental(yf_symbol: str, start: str, since: Optional[str] = None) -> dict:
    """Ensure the shared price_store covers yf_symbol, then shape this endpoint's response
    from it. price_store holds full (untrimmed) history now, shared with portfolio_history.py —
    no more "resident trimmed window vs caller's real history" distinction to track here."""
    start_dt = pd.Timestamp(start) - pd.Timedelta(days=30)
    since_dt = _valid_since(since, start_dt)
    needed_from = since_dt if since_dt is not None else start_dt

    price_store.ensure_prices([yf_symbol], needed_from.strftime("%Y-%m-%d"))
    entry = price_store.get_entry(yf_symbol)

    if not entry or not entry["dates"]:
        return {"dates": [], "prices": []}

    if not price_store.covers(yf_symbol, needed_from):
        # Fetch didn't reach back far enough — a genuinely bad/delisted symbol, or a transient
        # failure. Return whatever's resident, flagged partial so the caller merges instead of
        # treating this as a complete replacement of its own (possibly deeper) local history.
        fallback = dict(entry)
        fallback["partial_since"] = (since_dt or pd.Timestamp(entry["dates"][0])).strftime("%Y-%m-%d")
        return fallback

    if since_dt is not None:
        # Caller already has everything before `since` themselves — send only the delta,
        # not the full multi-year series, over the wire.
        result = _slice_response(entry, since_dt.strftime("%Y-%m-%d"))
        result["partial_since"] = since_dt.strftime("%Y-%m-%d")
        return result

    return _slice_response(entry, start)


def _slice_response(entry: dict, start: str) -> dict:
    dates, prices = entry["dates"], entry["prices"]
    i = 0
    while i < len(dates) and dates[i] < start:
        i += 1
    return {"dates": dates[i:], "prices": prices[i:]}


def _envelope(d: dict) -> dict:
    """Add the same freshness fields portfolio_history.py's response already carries, so the
    frontend can treat both chart types uniformly (Category 7 UI states). guardRejected is
    always False here — unlike portfolio_history.py's atomic per-request recompute, this
    endpoint's data can only grow via price_store's merge (never silently overwritten by a
    worse result), so there's no equivalent "reject and revert" scenario to protect against;
    the field is present for envelope consistency, not because this path needs the guard."""
    return {**d, "dataAsOf": time.time(), "guardRejected": False}


def _fetch_intraday_bars(yf_symbol: str) -> dict:
    try:
        df = yf.download(yf_symbol, period="1d", interval="5m", progress=False, auto_adjust=True)
        if df.empty:
            return {"dates": [], "prices": []}
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [c[0] for c in df.columns]
        closes = df["Close"].dropna().copy()
        del df  # full OHLCV frame no longer needed — free it before returning, not on GC
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
    since:     Optional[str] = Query(None, description="Caller's last locally-cached date (YYYY-MM-DD) — "
                                                          "lets a request be answered from the server's "
                                                          "short resident window even when it doesn't reach "
                                                          "back to `start`, since the caller already has "
                                                          "everything older than `since` themselves"),
):
    now = time.monotonic()

    if period == "1d":
        cache_key = f"{yf_symbol}:intraday"
        cached = _intraday_cache.get(cache_key)
        if cached and (now - cached[1]) < _INTRADAY_TTL:
            return JSONResponse(content=cached[0])
        try:
            async with _sem:
                data = await asyncio.wait_for(_fetch_intraday(yf_symbol), timeout=_FETCH_TIMEOUT)
        except asyncio.TimeoutError:
            # Underlying thread keeps running and will populate the cache for next request —
            # this just stops the current one from hanging on a single slow/stuck symbol.
            return JSONResponse(content={"dates": [], "prices": [], "error": "timeout"})
        _intraday_cache[cache_key] = (data, now)
        _evict_oldest(_intraday_cache, _MAX_INTRADAY_SYMBOLS, lambda v: v[1])
        return JSONResponse(content=data)

    if not start:
        return JSONResponse(content=_envelope({"dates": [], "prices": [], "error": "start required"}))

    start_dt = pd.Timestamp(start) - pd.Timedelta(days=30)
    since_dt = _valid_since(since, start_dt)
    needed_from = since_dt if since_dt is not None else start_dt

    cached = price_store.get_entry(yf_symbol)
    if (
        price_store.covers(yf_symbol, needed_from)
        and not is_stale(yf_symbol, cached["fetched_at"], cached["last_bar_date"])
    ):
        result = _slice_response(cached, start)
        if since_dt is not None:
            # Caller already has everything before `since` — flag so it merges the delta
            # instead of treating this slice as a full replacement of its own local history.
            result["partial_since"] = since_dt.strftime("%Y-%m-%d")
        return JSONResponse(content=_envelope(result))

    try:
        async with _sem:
            entry = await asyncio.wait_for(
                asyncio.to_thread(_fetch_incremental, yf_symbol, start, since), timeout=_FETCH_TIMEOUT
            )
    except asyncio.TimeoutError:
        # The background thread isn't killed — it'll finish and populate price_store for the
        # next request either way. Serve whatever's already resident rather than hanging.
        if cached:
            result = _slice_response(cached, start)
            result["partial_since"] = (since_dt or pd.Timestamp(cached["dates"][0])).strftime("%Y-%m-%d")
            return JSONResponse(content=_envelope(result))
        return JSONResponse(content=_envelope({"dates": [], "prices": [], "error": "timeout"}))
    if "error" in entry:
        return JSONResponse(content=_envelope(entry))
    if entry.get("partial_since"):
        # Delta-only result for a cold cache, sized off the caller's own `since` hint —
        # not a full range, the caller must merge it into what it already has, not replace.
        return JSONResponse(content=_envelope(entry))
    return JSONResponse(content=_envelope(_slice_response(entry, start)))
