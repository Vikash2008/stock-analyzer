"""
Persisted store for registered app users — the source of truth for who is
allowed to sign in, and the target of manual revocation.

Replaces the anonymous per-browser client_id as the real identity backing
alerts_store.py and watchlist_store.py (2026-08-13). Keyed by email (the
verified Google account email) since that's what Vikash recognizes when
manually managing data/.users.json.

To revoke someone: open data/.users.json and set their "revoked" to true
(or delete their entry outright). Takes effect on their very next request,
not just their next login — backend/auth_deps.py's get_current_user checks
is_allowed() on every call, not only at sign-in.

Usage
-----
    from backend import users_store as store
    store.get_user(email)
    store.upsert_user(email, google_sub)
    store.is_allowed(email)
"""

from __future__ import annotations

import json
import threading
import time
from pathlib import Path
from typing import Optional

_FILE = Path("data/.users.json")

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
            data.setdefault("users", {})
            _INSTANCE = data
            return _INSTANCE
        except Exception:
            pass
    _INSTANCE = {"users": {}}
    return _INSTANCE


def _save() -> None:
    data = _load()
    _FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def get_user(email: str) -> Optional[dict]:
    return _load()["users"].get(email)


def upsert_user(email: str, google_sub: str) -> dict:
    """Create on first login, refresh last_login on repeat logins. Never
    clears an existing `revoked` flag — re-authenticating doesn't un-revoke."""
    with _lock:
        data = _load()
        existing = data["users"].get(email)
        if existing is None:
            existing = {
                "email":      email,
                "google_sub": google_sub,
                "joined_at":  time.time(),
                "revoked":    False,
            }
            data["users"][email] = existing
        existing["google_sub"]  = google_sub
        existing["last_login"]  = time.time()
        _save()
        return existing


def is_allowed(email: str) -> bool:
    user = get_user(email)
    return user is not None and not user.get("revoked", False)


# ── Admin operations (backend/routers/admin.py) ─────────────────────────────

def list_users() -> list[dict]:
    return sorted(_load()["users"].values(), key=lambda u: u["joined_at"])


def admin_add_user(email: str) -> dict:
    """Pre-approve an email before it's ever signed in — this is the only way
    an email can create an account (routers/auth.py rejects any email not
    already in the store, except the static ADMIN_EMAILS bootstrap case).
    `google_sub` stays empty until the person actually signs in for the
    first time."""
    with _lock:
        data = _load()
        if email in data["users"]:
            return data["users"][email]
        user = {
            "email":      email,
            "google_sub": "",
            "joined_at":  time.time(),
            "revoked":    False,
        }
        data["users"][email] = user
        _save()
        return user


def set_revoked(email: str, revoked: bool) -> Optional[dict]:
    with _lock:
        data = _load()
        user = data["users"].get(email)
        if user is None:
            return None
        user["revoked"] = revoked
        _save()
        return user


def delete_user(email: str) -> bool:
    with _lock:
        data = _load()
        if email not in data["users"]:
            return False
        del data["users"][email]
        _save()
        return True
