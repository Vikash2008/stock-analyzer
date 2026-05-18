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
    "fifo":        None,       # never expires — mtime-gated instead
    "prices":      1800.0,     # 30 minutes
    "prev_closes": 1800.0,     # 30 minutes — fetched alongside prices
    "info":        86400 * 7,  # 7 days
    "fx":          1800.0,     # 30 minutes
}

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
        _FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_FILE, "wb") as f:
            pickle.dump(self._data, f)

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

    # ── FIFO mtime gate ───────────────────────────────────────────────────────

    def fifo_is_fresh(self, source_path: Path) -> bool:
        stored = self._data.get("fifo:mtime")
        return stored == source_path.stat().st_mtime

    def set_fifo(self, source_path: Path, txns, holdings_raw, realized) -> None:
        self._data["fifo:mtime"]        = source_path.stat().st_mtime
        self._data["fifo:value:txns"]   = txns
        self._data["fifo:value:raw"]    = holdings_raw
        self._data["fifo:value:real"]   = realized
        self._data["fifo:ts"]           = time.time()
        self.save()

    def get_fifo(self):
        """Return (txns, holdings_raw, realized) or None."""
        k = ("fifo:value:txns", "fifo:value:raw", "fifo:value:real")
        if all(x in self._data for x in k):
            return (self._data[k[0]], self._data[k[1]], self._data[k[2]])
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
