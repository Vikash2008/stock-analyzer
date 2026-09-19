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
_MAX_SYMBOLS = 400


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

# A symbol that comes back with zero data (delisted, mistyped, NAV-only) used to never get
# written to the store at all, so every single request re-ran the full yfinance lookup for it —
# confirmed live as a recurring 15-20s stall per request (IBREALEST.NS, "ET MONEY.NS"). Now an
# empty result is cached (dates: []) with a miss_count, and re-tried on a 3-strikes schedule:
# 3 quick misses 5 min apart (catches a transient blip fast), then one more chance a day later
# (catches a longer outage), then marked permanent and never retried again. Every miss is
# printed with the symbol name so a genuinely-bad symbol is traceable in the debug/journal logs.
_NEGATIVE_RETRY_TTL = 300.0      # spacing for the first _NEGATIVE_MAX_QUICK_MISSES attempts
_NEGATIVE_MAX_QUICK_MISSES = 3
_NEGATIVE_DAILY_TTL = 24 * 3600  # spacing for the one final attempt after the quick misses


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
    now = time.time()
    missing_syms: list[str] = []
    stale_syms:   list[str] = []
    for s in symbols:
        entry = _store.get(s)
        if entry is None:
            missing_syms.append(s)
        elif not entry.get("dates"):
            # Known no-data symbol. Permanent (confirmed over 2 separate days) -> never again.
            # Otherwise on the 5-min quick-retry schedule until _NEGATIVE_MAX_QUICK_MISSES,
            # then the one-day-later final check.
            if entry.get("permanent"):
                continue
            miss_count = entry.get("miss_count", 1)
            ttl = _NEGATIVE_RETRY_TTL if miss_count < _NEGATIVE_MAX_QUICK_MISSES else _NEGATIVE_DAILY_TTL
            if now - entry.get("fetched_at", 0) > ttl:
                missing_syms.append(s)
        elif entry["dates"][0] > needed_from:
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
        for sym in missing_syms:
            if sym not in fresh:
                miss_count = _store.get(sym, {}).get("miss_count", 0) + 1
                permanent = miss_count > _NEGATIVE_MAX_QUICK_MISSES
                if permanent:
                    print(f"[price_store] {sym}: still no price data after a day-later recheck — marking permanently delisted, will not retry again")
                else:
                    retry_in = "5 min" if miss_count < _NEGATIVE_MAX_QUICK_MISSES else "1 day"
                    print(f"[price_store] {sym}: no price data (attempt {miss_count}/{_NEGATIVE_MAX_QUICK_MISSES}) — will retry in {retry_in}")
                _store[sym] = {
                    "dates": [], "prices": [], "fetched_at": now, "last_bar_date": None,
                    "miss_count": miss_count, "permanent": permanent,
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
