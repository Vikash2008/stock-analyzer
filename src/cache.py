"""
Persistent disk cache with per-layer TTLs.

All state lives in data/.cache.pkl. On restart the app reads from this file
directly — no re-fetching unless the relevant TTL has expired.

Layers and TTLs
---------------
  fifo      : permanent — recomputed only when source file mtime changes
  prices    : 2 min     — market prices; refresh button available in UI
  info      : 7 days    — sector / company name; rarely changes
  fx        : 2 min     — USD/INR rate

Usage
-----
    from src.cache import Cache
    c = Cache()                    # load from disk
    c.get("prices")                # None if missing or expired
    c.set("prices", {...})         # write + save
    c.is_fresh("prices")           # bool
    c.invalidate("prices")         # force-expire one layer
"""

from __future__ import annotations

import pickle
import threading
import time
from pathlib import Path
from typing import Any, Optional

_FILE = Path("data/.cache.pkl")

# Guards all mutation of the shared _data dict and the pickle.dump below — set() is now
# called from multiple real OS threads at once (backend/routers/history.py's chart-fetch
# concurrency runs each request via asyncio.to_thread), and without this, one thread's
# prune()/dict-mutation could race another's pickle.dump() iterating the same dict
# ("RuntimeError: dictionary changed size during iteration").
_lock = threading.Lock()

# pickle.dump serializes the ENTIRE cache dict on every write, not just the changed key —
# fine for occasional writes (CSV upload, quickstats/dividends on their own cooldowns), but
# a multi-symbol chart-history burst calling set() once per symbol turned this into dozens
# of full re-serializations of an increasingly large dict within seconds. Coalesce rapid
# set() calls into far fewer actual disk writes; the in-memory _data dict (shared by every
# Cache() instance) still updates immediately either way, so get() always sees the latest
# value — only the disk write itself is debounced.
_SAVE_DEBOUNCE = 5.0  # seconds
_last_disk_write = 0.0

_TTL: dict[str, Optional[float]] = {
    "fifo":        None,        # never expires — mtime-gated instead
    "prices":      120.0,       # 2 min — backend always warm (Oracle VM), no cold-start cost to fetch often
    "prev_closes": 120.0,       # 2 min
    "info":        86400 * 7,   # 7 days
    "fx":          120.0,       # 2 min
    "quickstats":  None,        # permanent layer — per-symbol TTL managed in router (24h)
}

# Per-symbol layers use a dynamic key prefix (qs:{SYMBOL}, divs:{SYMBOL}) instead of a
# fixed layer name, so they fall outside _TTL above and is_fresh() treats them as
# permanent — they were never actually evicted. TTLs here must match the routers that
# write them (backend/routers/quickstats.py _DISK_TTL, backend/routers/dividends.py
# _SYM_DIV_TTL) so prune() can age them out the same way those routers already intend to.
# (hist: used to be mirrored here too — moved to its own dedicated file in
# backend/routers/history.py to stop double-holding the same data in RAM.)
_PREFIX_TTL: dict[str, float] = {
    "qs:":   86400.0,
    "divs:": 30 * 86400.0,
}

# Each uploaded CSV gets its own fifo entry (full txns/holdings/realized/fx_lots DataFrames),
# held in _RAM_FIFO below — cap how many distinct hashes we keep so repeated re-uploads/testing
# don't accumulate forever. Every Bucket/Label tag edit, holding delete, or Copy Holdings apply
# changes the CSV content and therefore mints a new hash — a single active editing session can
# produce many of these in a row.
#
# This was raised 5→30 in session 148 to stop mid-session eviction turning into a dead-end
# "re-import your CSV" error — but each entry pins a full portfolio snapshot in process memory,
# and 30 of them OOM-killed the 512Mi Render instance during a long edit session (session 149).
# Kept low again now that useSetTags.ts/dividends.py self-heal a cache-miss (re-seed from the
# browser's local CSV copy + retry once) instead of surfacing it as a hard failure — a miss just
# costs one extra round-trip, so we no longer need a large cap to avoid dead-ends.
_MAX_FIFO_HASHES = 5

# Module-level singleton: loaded from disk once per process lifetime.
# Mutations (set/invalidate) update this dict in-place, so all Cache
# instances in the same process share the same live state.
_INSTANCE: Optional[dict] = None

# Uploaded-CSV FIFO entries, keyed by content hash — RAM-only, deliberately never written to
# data/.cache.pkl. Real portfolio data must never leave the local machine / persist on any
# host's disk (see CLAUDE.md data policy) — only the bundled demo file's FIFO result is disk-
# cached (in _INSTANCE/_data below, key "fifo:demo:*"). Lost on every process restart, which is
# fine: a cache miss just costs one recompute from the browser's own localStorage CSV copy.
_RAM_FIFO: dict[str, dict] = {}

# The last-seen ticker list (no amounts/quantities, but still derived from a real uploaded
# portfolio) — used only to detect "did the symbol set change" for a force-refresh decision.
# RAM-only for the same reason _RAM_FIFO is: real-portfolio-derived data shouldn't touch disk,
# even a low-severity list like this one. Lost on restart — worst case, one extra force-refresh.
_known_symbols_ram: Optional[list[str]] = None


def get_known_symbols() -> Optional[list[str]]:
    return _known_symbols_ram


def set_known_symbols(symbols: list[str]) -> None:
    global _known_symbols_ram
    _known_symbols_ram = symbols


class Cache:
    def __init__(self) -> None:
        global _INSTANCE
        if _INSTANCE is None:
            _INSTANCE = self._load_from_disk()
        self._data = _INSTANCE

    # ── Persistence ───────────────────────────────────────────────────────────

    def _load_from_disk(self) -> dict:
        if _FILE.exists():
            try:
                with open(_FILE, "rb") as f:
                    return pickle.load(f)
            except Exception:
                pass
        return {}

    def save(self) -> None:
        """Force an immediate disk write, bypassing the debounce below — used for
        infrequent, latency-sensitive writes (CSV upload, explicit invalidate)."""
        with _lock:
            self._write_to_disk()

    def _write_to_disk(self) -> None:
        global _last_disk_write
        self.prune()
        _FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_FILE, "wb") as f:
            pickle.dump(self._data, f)
        _last_disk_write = time.time()

    def prune(self) -> None:
        """Actively drop expired/excess entries instead of just ignoring them on read —
        is_fresh() only gates what get() returns, it never removes anything, so without
        this the in-memory/disk cache grows forever for the life of the process."""
        now = time.time()

        # Named layers with a finite TTL (prices/prev_closes/info/fx)
        for layer, ttl in _TTL.items():
            if ttl is None:
                continue
            ts = self._data.get(f"{layer}:ts")
            if ts is not None and now - ts > ttl:
                self._data.pop(f"{layer}:value", None)
                self._data.pop(f"{layer}:ts", None)

        # Dynamic per-symbol layers (qs:SYMBOL, divs:SYMBOL)
        for prefix, ttl in _PREFIX_TTL.items():
            for ts_key in [k for k in self._data if k.startswith(prefix) and k.endswith(":ts")]:
                ts = self._data.get(ts_key, 0)
                if now - ts > ttl:
                    layer = ts_key[: -len(":ts")]
                    self._data.pop(f"{layer}:value", None)
                    self._data.pop(ts_key, None)

        self._prune_ram_fifo()

    def _prune_ram_fifo(self) -> None:
        """Cap distinct uploaded-CSV FIFO entries in _RAM_FIFO — keep only the most recent N."""
        if len(_RAM_FIFO) <= _MAX_FIFO_HASHES:
            return
        oldest = sorted(_RAM_FIFO, key=lambda h: _RAM_FIFO[h]["ts"])
        for stale_hash in oldest[: len(_RAM_FIFO) - _MAX_FIFO_HASHES]:
            _RAM_FIFO.pop(stale_hash, None)

    # ── Read / write ──────────────────────────────────────────────────────────

    def get(self, layer: str) -> Optional[Any]:
        """Return cached value if fresh, else None."""
        if not self.is_fresh(layer):
            return None
        return self._data.get(f"{layer}:value")

    def get_stale(self, layer: str) -> Optional[Any]:
        """Return the cached value regardless of TTL freshness, or None if never set.
        Used as a merge baseline when a fresh fetch comes back partial, so a bad cycle
        doesn't wipe out still-good data for symbols the fresh fetch missed."""
        return self._data.get(f"{layer}:value")

    def set(self, layer: str, value: Any) -> None:
        """Write value and record timestamp. The in-memory dict updates immediately
        (visible to every Cache() instance/get() call); the disk write itself is
        debounced — see _SAVE_DEBOUNCE above."""
        with _lock:
            self._data[f"{layer}:value"] = value
            self._data[f"{layer}:ts"]    = time.time()
            if time.time() - _last_disk_write >= _SAVE_DEBOUNCE:
                self._write_to_disk()

    def is_fresh(self, layer: str) -> bool:
        ttl = _TTL.get(layer)
        if f"{layer}:value" not in self._data:
            return False
        if ttl is None:
            return True   # permanent layer — freshness determined by caller
        age = time.time() - self._data.get(f"{layer}:ts", 0)
        return age < ttl

    def age(self, layer: str) -> Optional[float]:
        """Seconds since last write, or None if never written."""
        ts = self._data.get(f"{layer}:ts")
        return (time.time() - ts) if ts else None

    def invalidate(self, layer: str) -> None:
        """Force-expire a layer so the next get() triggers a re-fetch."""
        with _lock:
            self._data.pop(f"{layer}:ts", None)
            self._write_to_disk()

    # ── FIFO mtime / hash gate ────────────────────────────────────────────────
    # source is either a Path (keyed by mtime) or a str MD5 hash (uploaded CSV)
    # Bump _FIFO_VERSION whenever FIFO logic changes to force a cache miss.
    _FIFO_VERSION = "2"

    def fifo_is_fresh(self, source: "Path | str") -> bool:
        # A plain hash string (any str other than the "demo" sentinel used by validate.py's
        # get_fifo() default) means an uploaded CSV — check the RAM-only store instead of disk.
        if isinstance(source, str) and source != "demo":
            entry = _RAM_FIFO.get(source)
            return entry is not None and entry.get("version") == self._FIFO_VERSION
        if "fifo:demo:txns" not in self._data:
            return False
        if self._data.get("fifo:demo:version") != self._FIFO_VERSION:
            return False
        if isinstance(source, Path):
            return self._data.get("fifo:demo:mtime") == source.stat().st_mtime
        return True  # source == "demo" sentinel string — existence is sufficient

    def set_fifo(self, source: "Path | str", txns, holdings_raw, realized, fx_lots=None) -> None:
        if isinstance(source, str) and source != "demo":
            with _lock:
                _RAM_FIFO[source] = {
                    "txns":    txns,
                    "raw":     holdings_raw,
                    "real":    realized,
                    "lots":    fx_lots or [],
                    "version": self._FIFO_VERSION,
                    "ts":      time.time(),
                }
                self._prune_ram_fifo()
            return
        with _lock:
            if isinstance(source, Path):
                self._data["fifo:demo:mtime"] = source.stat().st_mtime
            self._data["fifo:demo:txns"]    = txns
            self._data["fifo:demo:raw"]     = holdings_raw
            self._data["fifo:demo:real"]    = realized
            self._data["fifo:demo:lots"]    = fx_lots or []
            self._data["fifo:demo:version"] = self._FIFO_VERSION
            self._data["fifo:demo:ts"]      = time.time()
            self._data["fifo:ts"]           = time.time()
            self._write_to_disk()

    def get_fifo(self, source: "Path | str" = "demo"):
        """Return (txns, holdings_raw, realized, fx_lots) or None."""
        if isinstance(source, str) and source != "demo":
            entry = _RAM_FIFO.get(source)
            if entry is None:
                return None
            return (entry["txns"], entry["raw"], entry["real"], entry["lots"])
        k_txns, k_raw, k_real = "fifo:demo:txns", "fifo:demo:raw", "fifo:demo:real"
        if all(k in self._data for k in (k_txns, k_raw, k_real)):
            lots = self._data.get("fifo:demo:lots", [])
            return (self._data[k_txns], self._data[k_raw], self._data[k_real], lots)
        return None

    # ── Diagnostics ───────────────────────────────────────────────────────────

    def status(self) -> str:
        lines = []
        for layer, ttl in _TTL.items():
            a = self.age(layer)
            if a is None:
                lines.append(f"  {layer:<8} not cached")
            elif ttl and a > ttl:
                lines.append(f"  {layer:<8} STALE  (age {int(a)}s, ttl {int(ttl)}s)")
            else:
                lines.append(f"  {layer:<8} fresh  (age {int(a)}s)")
        return "\n".join(lines)
