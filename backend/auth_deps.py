"""
FastAPI dependency for gated endpoints — resolves the caller's verified
email from the session JWT issued by backend/routers/auth.py, and re-checks
users_store on every call (not just at login) so a manual revocation takes
effect immediately, even against an already-issued token.
"""

from __future__ import annotations

import os

import jwt
from fastapi import Depends, Header, HTTPException

from backend import users_store as store

JWT_SECRET = os.environ.get("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"


def get_current_user(authorization: str | None = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "not signed in")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(401, "invalid or expired session")

    email = payload.get("email")
    if not email or not store.is_allowed(email):
        raise HTTPException(401, "access revoked or unknown user")
    return email


# Static allowlist, not the users_store — admin status isn't something an
# admin should be able to grant themselves via the app, so it lives only in
# an env var Vikash edits directly (comma-separated emails).
ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}


def get_current_admin(email: str = Depends(get_current_user)) -> str:
    if email.lower() not in ADMIN_EMAILS:
        raise HTTPException(403, "admin access required")
    return email
