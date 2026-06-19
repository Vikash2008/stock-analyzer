"""
Persistent disk cache with per-layer TTLs.

All state lives in data/.cache.pkl. On restart the app reads from this file
directly — no re-fetching unless the relevant TTL has expired.

Layers and TTLs
---------------
  fifo      : permanent — recomputed only when source file mtime changes
  prices    : 30 min    — market prices; refresh button available in UI
  info      : 7 days    — sector / company name; rarely changes
  fx        : 30 min    — USD/INR rate

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
import time
from pathlib import Path
from typing import Any, Optional

_FILE = Path("data/.cache.pkl")

_TTL: dict[str, Optional[float]] = {
    "fifo":        None,        # never expires — mtime-gated instead
    "prices":      1800.0,      # 30 min — matches frontend auto-refresh interval
    "prev_closes": 1800.0,      # 30 min
    "info":        86400 * 7,   # 7 days
    "fx":          1800.0,      # 30 min
    "quickstats":  None,        # permanent layer — per-symbol TTL managed in router (24h)
}

# Per-symbol layers use a dynamic key prefix (qs:{SYMBOL}, divs:{SYMBOL}) instead of a
# fixed layer name, so they fall outside _TTL above and is_fresh() treats them as
# permanent — they were never actually evicted. TTLs here must match the routers that
# write them (backend/routers/quickstats.py _DISK_TTL, backend/routers/dividends.py
# _SYM_DIV_TTL) so prune() can age them out the same way those routers already intend to.
# hist: (backend/routers/history.py _series_cache) — actual re-fetch necessity is judged
# by market_hours.is_stale(), not this TTL; this just ages out symbols nobody's looked
# at in a week so the disk file doesn't grow forever.
_PREFIX_TTL: dict[str, float] = {
    "qs:":   86400.0,
    "divs:": 30 * 86400.0,
    "hist:": 7 * 86400.0,
}

# Each uploaded CSV gets its own permanent fifo:{hash}:* entry that's never otherwise
# removed — cap how many distinct hashes we keep so repeated re-uploads/testing don't
# accumulate forever.
_MAX_FIFO_HASHES = 5

# Module-level singleton: loaded from disk once per process lifetime.
# Mutations (set/invalidate) update this dict in-place, so all Cache
# instances in the same process share the same live state.
_INSTANCE: Optional[dict] = None


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
        self.prune()
        _FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_FILE, "wb") as f:
            pickle.dump(self._data, f)

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

        # Cap distinct uploaded-CSV FIFO entries — keep only the most recently set N.
        # "demo" is excluded — it's the bundled committed file, always kept.
        fifo_hashes = sorted(
            (k.split(":", 2)[1] for k in self._data
             if k.startswith("fifo:") and k.endswith(":ts") and k != "fifo:ts"
             and k.split(":", 2)[1] != "demo"),
            key=lambda h: self._data.get(f"fifo:{h}:ts", 0),
            reverse=True,
        )
        for stale_hash in fifo_hashes[_MAX_FIFO_HASHES:]:
            for suffix in ("txns", "raw", "real", "lots", "version", "ts"):
                self._data.pop(f"fifo:{stale_hash}:{suffix}", None)

    # ── Read / write ──────────────────────────────────────────────────────────

    def get(self, layer: str) -> Optional[Any]:
        """Return cached value if fresh, else None."""
        if not self.is_fresh(layer):
            return None
        return self._data.get(f"{layer}:value")

    def set(self, layer: str, value: Any) -> None:
        """Write value and record timestamp. Saves to disk immediately."""
        self._data[f"{layer}:value"] = value
        self._data[f"{layer}:ts"]    = time.time()
        self.save()

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
        self._data.pop(f"{layer}:ts", None)
        self.save()

    # ── FIFO mtime / hash gate ────────────────────────────────────────────────
    # source is either a Path (keyed by mtime) or a str MD5 hash (uploaded CSV)
    # Bump _FIFO_VERSION whenever FIFO logic changes to force a cache miss.
    _FIFO_VERSION = "2"

    def fifo_is_fresh(self, source: "Path | str") -> bool:
        key = source if isinstance(source, str) else "demo"
        if f"fifo:{key}:txns" not in self._data:
            return False
        if self._data.get(f"fifo:{key}:version") != self._FIFO_VERSION:
            return False
        if isinstance(source, Path):
            return self._data.get("fifo:demo:mtime") == source.stat().st_mtime
        return True  # hash key — existence is sufficient

    def set_fifo(self, source: "Path | str", txns, holdings_raw, realized, fx_lots=None) -> None:
        key = source if isinstance(source, str) else "demo"
        if isinstance(source, Path):
            self._data["fifo:demo:mtime"] = source.stat().st_mtime
        self._data[f"fifo:{key}:txns"]    = txns
        self._data[f"fifo:{key}:raw"]     = holdings_raw
        self._data[f"fifo:{key}:real"]    = realized
        self._data[f"fifo:{key}:lots"]    = fx_lots or []
        self._data[f"fifo:{key}:version"] = self._FIFO_VERSION
        self._data[f"fifo:{key}:ts"]      = time.time()
        self._data["fifo:ts"]             = time.time()
        self.save()

    def get_fifo(self, source: "Path | str" = "demo"):
        """Return (txns, holdings_raw, realized, fx_lots) or None."""
        key    = source if isinstance(source, str) else "demo"
        k_txns = f"fifo:{key}:txns"
        k_raw  = f"fifo:{key}:raw"
        k_real = f"fifo:{key}:real"
        if all(x in self._data for x in (k_txns, k_raw, k_real)):
            lots = self._data.get(f"fifo:{key}:lots", [])
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
