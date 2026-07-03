"""
Unified per-symbol daily close-price store — the ONE place the backend reads/writes raw
historical prices from. Replaces two previously-independent copies of the same public market
data: history.py's `_series_cache` (trimmed to a short tail) and portfolio_history.py's
`_price_cache` (full history, untrimmed). Both endpoints now read the same resident data for the
same symbol instead of each fetching and storing it separately.

Public market data, not user-specific — safe to persist to disk and share across every caller.
"""
from __future__ import annotations

import ctypes
import gc
import pickle
import threading
import time
from pathlib import Path
from typing import Optional

import pandas as pd
import yfinance as yf

try:
    _libc: Optional[ctypes.CDLL] = ctypes.CDLL("libc.so.6")
except OSError:
    _libc = None  # not Linux (e.g. local Windows dev) — no-op

_STORE_FILE = Path("data/.price_store.pkl")
_lock = threading.Lock()
_SAVE_DEBOUNCE = 5.0
_last_write = 0.0


def _load() -> dict:
    if _STORE_FILE.exists():
        try:
            with open(_STORE_FILE, "rb") as f:
                return pickle.load(f)
        except Exception:
            pass
    return {}


def _persist() -> None:
    global _last_write
    now = time.time()
    if now - _last_write < _SAVE_DEBOUNCE:
        return
    with _lock:
        if now - _last_write < _SAVE_DEBOUNCE:
            return
        _STORE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_STORE_FILE, "wb") as f:
            pickle.dump(_store, f)
        _last_write = now


# yf_symbol -> {dates, prices, fetched_at, last_bar_date}. Full history, not trimmed — the
# aggregate-chart path needs deep history server-side (it never sends raw per-symbol prices to
# the frontend), so the store has to hold it in full anyway; a second, trimmed copy for the
# per-symbol chart path would just be redundant storage of the same data.
_store: dict[str, dict] = _load()

# Safety cap on distinct symbols resident. NOT the active-concurrent-user-sourced eviction
# design (deferred — see plan doc Category 1 items 2-4) — just a basic ceiling so an unbounded
# number of one-off Explore-page lookups can't grow this dict forever.
_MAX_SYMBOLS = 150


def _evict_oldest() -> None:
    if len(_store) <= _MAX_SYMBOLS:
        return
    for sym, _ in sorted(_store.items(), key=lambda kv: kv[1].get("fetched_at", 0))[: len(_store) - _MAX_SYMBOLS]:
        _store.pop(sym, None)


def _trim_memory() -> None:
    gc.collect()
    if _libc is not None:
        try:
            _libc.malloc_trim(0)
        except Exception:
            pass


# Chunk size caps how many tickers go into a single yf.download() call — the combined symbol
# set across every active user's portfolio could be 50-100+ distinct tickers; one oversized
# request risks tripping Yahoo's own per-request limits. One retry on a transient-looking
# failure (network blip, momentary rate limit) before giving up — distinguishes that from a
# clean "no data" response for a genuinely bad/delisted symbol, which is never retried.
_CHUNK_SIZE = 50
_MAX_RETRIES = 1
_RETRY_DELAY = 1.5


def _series_to_entry(s: "pd.Series") -> Optional[dict]:
    s = s.dropna()
    if s.empty:
        return None
    idx = s.index
    if hasattr(idx, "tz") and idx.tz is not None:
        idx = idx.tz_localize(None)
    return {
        "dates":  idx.strftime("%Y-%m-%d").tolist(),
        "prices": [round(float(p), 4) for p in s.tolist()],
    }


def _download_chunk(symbols: list[str], start) -> dict[str, dict]:
    if not symbols:
        return {}
    raw = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            raw = yf.download(symbols, start=start, auto_adjust=True, progress=False, threads=False)
            break
        except Exception as e:
            if attempt < _MAX_RETRIES:
                time.sleep(_RETRY_DELAY)
                continue
            print(f"[price_store] download failed for {len(symbols)} symbols after retry: {e}")
            return {}
    if raw is None or raw.empty:
        return {}

    out: dict[str, dict] = {}
    if isinstance(raw.columns, pd.MultiIndex):
        lvl0 = raw.columns.get_level_values(0)
        if "Close" not in lvl0:
            return {}
        close = raw["Close"]
        for sym in symbols:
            if sym not in close.columns:
                continue
            entry = _series_to_entry(close[sym])
            if entry:
                out[sym] = entry
    elif "Close" in raw.columns:
        # A single-symbol request can collapse to flat (non-MultiIndex) columns.
        entry = _series_to_entry(raw["Close"])
        if entry:
            out[symbols[0]] = entry

    return out


def download_symbols(symbols: list[str], start) -> dict[str, dict]:
    """Bulk-download close prices for `symbols` from `start`, chunked and retried.
    Returns yf_symbol -> {dates, prices}. Public — used directly for a full/never-seen fetch."""
    if not symbols:
        return {}
    out: dict[str, dict] = {}
    for i in range(0, len(symbols), _CHUNK_SIZE):
        out.update(_download_chunk(symbols[i:i + _CHUNK_SIZE], start))
    return out


def ensure_prices(symbols: list[str], needed_from: str) -> None:
    """Make sure the store has fresh, sufficiently-deep data for every symbol in `symbols` —
    fetching only what's missing or new instead of redownloading full history every call. This
    is the single shared fallback path: a symbol truly never seen before gets one on-demand
    fetch here, seeding the store for every future reader — any user, any chart type."""
    missing_syms: list[str] = []
    stale_syms:   list[str] = []
    for s in symbols:
        entry = _store.get(s)
        if not entry or not entry.get("dates") or entry["dates"][0] > needed_from:
            missing_syms.append(s)
        else:
            stale_syms.append(s)

    if missing_syms:
        fresh = download_symbols(missing_syms, needed_from)
        now = time.time()
        for sym, entry in fresh.items():
            _store[sym] = {
                **entry, "fetched_at": now,
                "last_bar_date": entry["dates"][-1] if entry["dates"] else None,
            }

    if stale_syms:
        # One bulk delta call covers all of them, from the earliest last-cached-bar among
        # them — symbols already fully current just get overlapping/no new data back.
        since = min((_store[s]["dates"][-1] for s in stale_syms if _store[s]["dates"]), default=None)
        if since is not None:
            delta = download_symbols(stale_syms, since)
            now = time.time()
            for sym in stale_syms:
                d = delta.get(sym)
                if not d or not d["dates"]:
                    continue
                cached = _store[sym]
                merged = dict(zip(cached["dates"], cached["prices"]))
                merged.update(dict(zip(d["dates"], d["prices"])))
                dates = sorted(merged.keys())
                _store[sym] = {
                    "dates": dates, "prices": [merged[dt] for dt in dates],
                    "fetched_at": now, "last_bar_date": dates[-1] if dates else cached.get("last_bar_date"),
                }

    _evict_oldest()
    _persist()
    _trim_memory()


def get_entry(yf_symbol: str) -> Optional[dict]:
    """Read-only access to a symbol's full resident history, or None if never fetched."""
    return _store.get(yf_symbol)


def covers(yf_symbol: str, needed_from: "pd.Timestamp") -> bool:
    entry = _store.get(yf_symbol)
    return bool(entry and entry["dates"] and pd.Timestamp(entry["dates"][0]) <= needed_from)
