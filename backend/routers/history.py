"""
GET /api/history?yf_symbol=INFY.NS&start=2020-01-01
GET /api/history?yf_symbol=INFY.NS&period=1d   (intraday 5-min bars)

Returns price history for the Charts tab.
Uses query param (not path param) so dots in yf_symbol are URL-safe.

Daily history: one in-memory entry per symbol, trimmed to a short recent window
(_RETENTION_DAYS) — the client's own localStorage holds the deep multi-year
history, so the server only needs enough of a tail to serve cheap deltas.
Re-fetches only pull data since the last cached bar and merge it in, instead
of re-downloading the whole range every time. Whether a re-fetch happens at
all is gated by market_hours.is_stale() — open-market symbols recheck every
30 min (matching the frontend's own auto-refresh tick), closed-market symbols
only recheck once per exchange close.
"""

from __future__ import annotations

import asyncio
import ctypes
import gc
import pickle
import threading
import time
from pathlib import Path
from typing import Optional

import pandas as pd
import yfinance as yf
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from backend.market_hours import is_stale
from src.price_fetcher import get_prices_and_prev_close

router = APIRouter()

# glibc's malloc doesn't hand freed memory back to the OS on its own — after a multi-symbol
# chart-fetch burst, the process's reported RSS can stay elevated near its peak for a long
# time even though the actual resident cache (trimmed to _RETENTION_DAYS) is tiny. Forcing a
# trim after each burst settles closes that gap. Debounced — malloc_trim itself walks the
# whole heap and isn't free, so it shouldn't run on every single fetch.
try:
    _libc: Optional[ctypes.CDLL] = ctypes.CDLL("libc.so.6")
except OSError:
    _libc = None  # not Linux (e.g. local Windows dev) — no-op

_TRIM_DEBOUNCE = 30.0
_last_trim = 0.0


def _trim_memory() -> None:
    global _last_trim
    now = time.time()
    if now - _last_trim < _TRIM_DEBOUNCE:
        return
    _last_trim = now
    gc.collect()
    if _libc is not None:
        try:
            _libc.malloc_trim(0)
        except Exception:
            pass

# _series_cache is persisted directly to its own file (not mirrored into src.cache's shared
# Cache singleton) — that singleton stays resident in RAM for the whole process, so mirroring
# the same full-size daily series into it duplicated this entire cache's memory footprint for
# no benefit (the mirror was only ever read once, to reseed this dict after a restart).
_HIST_FILE = Path("data/.hist_cache.pkl")
_hist_lock = threading.Lock()
_HIST_SAVE_DEBOUNCE = 5.0
_last_hist_write = 0.0


def _load_series_cache() -> dict:
    if _HIST_FILE.exists():
        try:
            with open(_HIST_FILE, "rb") as f:
                return pickle.load(f)
        except Exception:
            pass
    return {}


def _persist_series_cache() -> None:
    global _last_hist_write
    now = time.time()
    if now - _last_hist_write < _HIST_SAVE_DEBOUNCE:
        return
    with _hist_lock:
        if now - _last_hist_write < _HIST_SAVE_DEBOUNCE:
            return
        _HIST_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_HIST_FILE, "wb") as f:
            pickle.dump(_series_cache, f)
        _last_hist_write = now


_series_cache: dict[str, dict] = _load_series_cache()  # yf_symbol -> {dates, prices, fetched_at, last_bar_date}
_intraday_cache: dict[str, tuple[dict, float]] = {}
_INTRADAY_TTL = 3600.0  # 1 hour  — intraday
_FETCH_TIMEOUT = 20.0   # per-request cap on the underlying yfinance call — a single slow/stuck
                        # symbol can no longer hang a request indefinitely; the background thread
                        # still finishes and populates the cache for the next request either way.
_sem          = asyncio.Semaphore(3)  # max concurrent yfinance fetches — was briefly raised to 8 to
                                       # clear mass-refetch bursts faster, but each concurrent
                                       # yf.download() holds a full OHLCV DataFrame in memory; 8 at
                                       # once pinned Render's 512MB free-tier instance at its ceiling
                                       # (~15.4MB/call observed). Reverted to 4, then to 3 — a first
                                       # post-deploy cold burst (every symbol cold on both client and
                                       # server caches at once) still plateaued at ~513MB; trading a
                                       # bit more burst-clear time for a lower peak. See _download()'s
                                       # del df + the disk-backed cache + _trim_memory() for the rest
                                       # of the fix to the slow-burst problem this was trying to solve.

# Neither cache above ever had entries removed — every distinct symbol ever requested
# (not just current portfolio holdings, but every Explore/Quick-Stats lookup too) stayed
# in memory for the life of the process. Cap each to the most-recently-fetched N symbols —
# lowered from 300: the real portfolio only has ~80-90 distinct symbols, so 300 was mostly
# holding one-off Explore-page lookups that don't need to survive long-term.
_MAX_SERIES_SYMBOLS = 120
_MAX_INTRADAY_SYMBOLS = 120


def _evict_oldest(cache: dict, max_size: int, ts_of) -> None:
    if len(cache) <= max_size:
        return
    for sym, _ in sorted(cache.items(), key=lambda kv: ts_of(kv[1]))[: len(cache) - max_size]:
        cache.pop(sym, None)


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
        closes = df["Close"].dropna().copy()
        del df  # full OHLCV frame no longer needed — free it before returning, not on GC
        return {
            "dates":  closes.index.strftime("%Y-%m-%d").tolist(),
            "prices": [round(float(p), 4) for p in closes.tolist()],
        }
    except Exception as exc:
        return {"dates": [], "prices": [], "error": str(exc)}


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


# Resident window kept in RAM/disk. The client's own localStorage is the long-term home
# for the deep multi-year history (it already persists every symbol's full series there
# with a 7/30-day TTL) — the backend only needs enough of a tail to serve cheap deltas on
# the next request. A client without a usable local cache (first-ever load, or one older
# than this) pays one full re-fetch instead of getting it from a warm resident cache;
# that fetch is transient (freed right after, per _download's `del df`), not retained.
_RETENTION_DAYS = 15


def _trim(entry: dict) -> dict:
    dates, prices = entry["dates"], entry["prices"]
    if len(dates) <= _RETENTION_DAYS:
        return entry
    return {**entry, "dates": dates[-_RETENTION_DAYS:], "prices": prices[-_RETENTION_DAYS:]}


def _save_entry(yf_symbol: str, entry: dict) -> dict:
    _series_cache[yf_symbol] = _trim(entry)
    _evict_oldest(_series_cache, _MAX_SERIES_SYMBOLS, lambda e: e["fetched_at"])
    _persist_series_cache()
    _trim_memory()
    return entry  # caller gets the untrimmed entry for this response


def _covers(entry: Optional[dict], needed_from: pd.Timestamp) -> bool:
    """Does the resident (possibly trimmed) entry reach back far enough to answer this
    request without a fresh fetch?"""
    return bool(entry and entry["dates"] and pd.Timestamp(entry["dates"][0]) <= needed_from)


def _fetch_incremental(yf_symbol: str, start: str, since: Optional[str] = None) -> dict:
    """Fetch full or delta history for yf_symbol and merge into _series_cache."""
    cached = _series_cache.get(yf_symbol)  # already seeded from disk at process start
    start_dt = pd.Timestamp(start) - pd.Timedelta(days=30)
    since_dt = _valid_since(since, start_dt)
    needed_from = since_dt if since_dt is not None else start_dt

    if not _covers(cached, needed_from):
        # Resident window (if any) doesn't reach back far enough for this request — full
        # fetch from the earliest date actually needed. Returned to the caller in full;
        # only the trimmed recent window is kept resident afterward.
        fresh = _download(yf_symbol, needed_from)
        if fresh.get("error") or not fresh["dates"]:
            return fresh if not cached else cached
        entry = {
            "dates": fresh["dates"], "prices": fresh["prices"],
            "fetched_at": time.time(), "last_bar_date": fresh["dates"][-1],
        }
        if since_dt is not None and cached is None:
            # Caller's own browser already has data through `since_dt` — flag this as
            # delta-only so the caller merges instead of replacing its own cache, but
            # still keep the (trimmed) resident window from it like any other fetch.
            _save_entry(yf_symbol, entry)
            fresh["partial_since"] = since_dt.strftime("%Y-%m-%d")
            return fresh
        return _save_entry(yf_symbol, entry)

    # Resident window covers what's needed — delta-merge from the last cached bar onward
    # (yfinance can revise an in-progress daily bar).
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
    result = _save_entry(yf_symbol, entry)
    if since_dt is not None:
        # `cached` here is only the trimmed resident window, not the caller's full
        # history — flag delta-only so the caller merges instead of replacing its cache.
        result["partial_since"] = since_dt.strftime("%Y-%m-%d")
    return result


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
        return JSONResponse(content={"dates": [], "prices": [], "error": "start required"})

    start_dt = pd.Timestamp(start) - pd.Timedelta(days=30)
    since_dt = _valid_since(since, start_dt)
    needed_from = since_dt if since_dt is not None else start_dt

    cached = _series_cache.get(yf_symbol)
    if (
        _covers(cached, needed_from)
        and not is_stale(yf_symbol, cached["fetched_at"], cached["last_bar_date"])
    ):
        return JSONResponse(content=_slice_response(cached, start))

    try:
        async with _sem:
            entry = await asyncio.wait_for(
                asyncio.to_thread(_fetch_incremental, yf_symbol, start, since), timeout=_FETCH_TIMEOUT
            )
    except asyncio.TimeoutError:
        # Same as above — the thread isn't killed, it'll finish and cache in the background.
        # Serve whatever we already had rather than hanging the request indefinitely.
        if cached:
            return JSONResponse(content=_slice_response(cached, start))
        return JSONResponse(content={"dates": [], "prices": [], "error": "timeout"})
    if "error" in entry:
        return JSONResponse(content=entry)
    if entry.get("partial_since"):
        # Delta-only result for a cold cache, sized off the caller's own `since` hint —
        # not a full range, the caller must merge it into what it already has, not replace.
        return JSONResponse(content=entry)
    return JSONResponse(content=_slice_response(entry, start))
