"""
Persisted store for price-alert rules, triggered notifications, push
subscriptions, and the delivery-mode setting — partitioned per client.

This app has no login system (users just upload their own CSV in-browser),
so "client_id" is a stable random UUID the frontend generates once per
browser/device (frontend/src/utils/clientId.ts) and sends with every alerts
request. Every user of the shared deployment gets their own isolated rules,
notification list, and push subscriptions — a triggered alert is only ever
visible to, and only ever pushed to, the client whose rule fired.

All state lives in data/.alerts.json (plain JSON, not pickle — small,
human-inspectable, no numpy/pandas types involved).

Usage
-----
    from backend import alerts_store as store
    store.get_rules(client_id)
    store.add_rule(client_id, {...})
    store.update_rule(client_id, rule_id, {"enabled": False})
"""

from __future__ import annotations

import json
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Optional

_FILE = Path("data/.alerts.json")

# Guards all mutation + the file write — evaluate() runs on the background
# price_refresh loop (via asyncio.to_thread) while API requests can mutate
# concurrently from the event loop's own thread pool.
_lock = threading.Lock()

_INSTANCE: Optional[dict] = None


def _empty_client() -> dict:
    return {
        "rules": [],
        "notifications": [],
        "subscriptions": [],
        "settings": {"delivery_mode": "in_app"},
    }


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


def _client(client_id: str) -> dict:
    """Return this client's namespace, creating it on first touch. Caller
    must hold _lock if mutating."""
    data = _load()
    if client_id not in data["clients"]:
        data["clients"][client_id] = _empty_client()
    return data["clients"][client_id]


def get_all_clients() -> dict[str, dict]:
    """Read-only snapshot of every client's namespace — used by the
    background evaluator, which has no single client_id of its own."""
    return dict(_load()["clients"])


# ── Rules ─────────────────────────────────────────────────────────────────

def get_rules(client_id: str) -> list[dict]:
    return list(_client(client_id)["rules"])


def add_rule(client_id: str, rule: dict) -> dict:
    with _lock:
        c = _client(client_id)
        new_rule = {
            "id":              uuid.uuid4().hex,
            "yf_symbol":       rule["yf_symbol"],
            "symbol":          rule["symbol"],
            "name":            rule.get("name", ""),
            "portfolio":       rule.get("portfolio", ""),
            "type":            rule["type"],            # 'pct_move' | 'abs_price'
            "direction":       rule["direction"],        # 'above' | 'below'
            "reference_value": rule.get("reference_value", 0),
            "threshold_value": rule["threshold_value"],
            "enabled":         True,
            "triggered":       False,
            "created_at":      time.time(),
        }
        c["rules"].append(new_rule)
        _save()
        return new_rule


def update_rule(client_id: str, rule_id: str, patch: dict) -> Optional[dict]:
    with _lock:
        c = _client(client_id)
        for r in c["rules"]:
            if r["id"] == rule_id:
                r.update(patch)
                _save()
                return r
        return None


def rearm_rule(client_id: str, rule_id: str, reference_value: Optional[float] = None) -> Optional[dict]:
    """Reset a one-shot-triggered rule so it can fire again."""
    patch: dict[str, Any] = {"triggered": False}
    if reference_value is not None:
        patch["reference_value"] = reference_value
    return update_rule(client_id, rule_id, patch)


def delete_rule(client_id: str, rule_id: str) -> bool:
    with _lock:
        c = _client(client_id)
        before = len(c["rules"])
        c["rules"] = [r for r in c["rules"] if r["id"] != rule_id]
        changed = len(c["rules"]) != before
        if changed:
            _save()
        return changed


# ── Notifications ─────────────────────────────────────────────────────────

def get_notifications(client_id: str) -> list[dict]:
    return sorted(_client(client_id)["notifications"], key=lambda n: n["triggered_at"], reverse=True)


def add_notification(client_id: str, notification: dict) -> dict:
    with _lock:
        c = _client(client_id)
        new_notification = {
            "id":           uuid.uuid4().hex,
            "rule_id":      notification["rule_id"],
            "yf_symbol":    notification["yf_symbol"],
            "symbol":       notification["symbol"],
            "name":         notification.get("name", ""),
            "portfolio":    notification.get("portfolio", ""),
            "message":      notification["message"],
            "triggered_at": time.time(),
            "read":         False,
        }
        c["notifications"].append(new_notification)
        _save()
        return new_notification


def mark_notification_read(client_id: str, notification_id: str) -> Optional[dict]:
    with _lock:
        c = _client(client_id)
        for n in c["notifications"]:
            if n["id"] == notification_id:
                n["read"] = True
                _save()
                return n
        return None


def dismiss_notification(client_id: str, notification_id: str) -> bool:
    with _lock:
        c = _client(client_id)
        before = len(c["notifications"])
        c["notifications"] = [n for n in c["notifications"] if n["id"] != notification_id]
        changed = len(c["notifications"]) != before
        if changed:
            _save()
        return changed


# ── Push subscriptions ───────────────────────────────────────────────────

def get_subscriptions(client_id: str) -> list[dict]:
    return list(_client(client_id)["subscriptions"])


def add_subscription(client_id: str, sub: dict) -> dict:
    """Upsert by endpoint — re-subscribing (e.g. after a key rotation) replaces the old entry."""
    with _lock:
        c = _client(client_id)
        c["subscriptions"] = [s for s in c["subscriptions"] if s["endpoint"] != sub["endpoint"]]
        new_sub = {
            "endpoint":   sub["endpoint"],
            "keys":       sub["keys"],
            "created_at": time.time(),
        }
        c["subscriptions"].append(new_sub)
        _save()
        return new_sub


def remove_subscription(client_id: str, endpoint: str) -> bool:
    with _lock:
        c = _client(client_id)
        before = len(c["subscriptions"])
        c["subscriptions"] = [s for s in c["subscriptions"] if s["endpoint"] != endpoint]
        changed = len(c["subscriptions"]) != before
        if changed:
            _save()
        return changed


# ── Settings ──────────────────────────────────────────────────────────────

def get_settings(client_id: str) -> dict:
    return dict(_client(client_id)["settings"])


def update_settings(client_id: str, patch: dict) -> dict:
    with _lock:
        c = _client(client_id)
        c["settings"].update(patch)
        _save()
        return dict(c["settings"])
