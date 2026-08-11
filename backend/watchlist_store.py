"""
Persisted store for the Watchlist feature — partitioned per client, same
pattern as backend/alerts_store.py.

This app has no login system, so "client_id" is the same stable random
UUID the frontend already generates once per browser for Price Alerts
(frontend/src/utils/clientId.ts) and sends with every watchlist request.

All state lives in data/.watchlist.json (plain JSON, human-inspectable).

Usage
-----
    from backend import watchlist_store as store
    store.get_items(client_id)
    store.add_item(client_id, {...})
    store.remove_item(client_id, yf_symbol)
"""

from __future__ import annotations

import json
import threading
import time
import uuid
from pathlib import Path
from typing import Optional

_FILE = Path("data/.watchlist.json")

_lock = threading.Lock()

_INSTANCE: Optional[dict] = None


def _load() -> dict:
    global _INSTANCE
    if _INSTANCE is not None:
        return _INSTANCE
    if _FILE.exists():
        try:
            with open(_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            data.setdefault("clients", {})
            _INSTANCE = data
            return _INSTANCE
        except Exception:
            pass
    _INSTANCE = {"clients": {}}
    return _INSTANCE


def _save() -> None:
    data = _load()
    _FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def _client(client_id: str) -> list[dict]:
    """Return this client's item list, creating it on first touch. Caller
    must hold _lock if mutating."""
    data = _load()
    if client_id not in data["clients"]:
        data["clients"][client_id] = []
    return data["clients"][client_id]


def get_items(client_id: str) -> list[dict]:
    return list(_client(client_id))


def add_item(client_id: str, item: dict) -> dict:
    with _lock:
        items = _client(client_id)
        existing = next((i for i in items if i["yf_symbol"] == item["yf_symbol"]), None)
        if existing is not None:
            return existing
        new_item = {
            "id":         uuid.uuid4().hex,
            "yf_symbol":  item["yf_symbol"],
            "symbol":     item.get("symbol", item["yf_symbol"]),
            "name":       item.get("name", ""),
            "exchange":   item.get("exchange", ""),
            "currency":   item.get("currency", "INR"),
            "added_at":   time.time(),
        }
        items.append(new_item)
        _save()
        return new_item


def remove_item(client_id: str, yf_symbol: str) -> bool:
    with _lock:
        data = _load()
        items = data["clients"].get(client_id, [])
        before = len(items)
        data["clients"][client_id] = [i for i in items if i["yf_symbol"] != yf_symbol]
        changed = len(data["clients"][client_id]) != before
        if changed:
            _save()
        return changed
