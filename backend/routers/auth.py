"""
Google Sign-In — verifies the ID token the frontend gets from Google
Identity Services and issues our own session JWT (env `JWT_SECRET`).

Access control is entirely email-based (2026-08-13, replacing an earlier
invite-token-in-URL design that turned out to be confusing and fragile —
the token only worked if it was still present in the URL at the exact
moment someone clicked sign-in). The only way an email can create an
account now is:
  1. It's already been pre-approved via the Admin panel (users_store.py), or
  2. It's in the static ADMIN_EMAILS allowlist (auth_deps.py) — this is the
     bootstrap path, since an admin has to be able to sign in at all before
     they can use the Admin panel to approve anyone else.

Requires env `GOOGLE_CLIENT_ID` (the Web application OAuth Client ID from
Google Cloud Console) to verify tokens against — see backend/auth_deps.py
for how the issued session JWT is checked on every gated request.
"""

from __future__ import annotations

import os
import time

import jwt
from fastapi import APIRouter, Depends, HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from pydantic import BaseModel

from backend import users_store as store
from backend.auth_deps import ADMIN_EMAILS, JWT_ALGORITHM, JWT_SECRET, get_current_user

router = APIRouter()

_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60  # 30 days


class GoogleLoginRequest(BaseModel):
    id_token: str


@router.post("/api/auth/google")
def google_login(body: GoogleLoginRequest):
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        raise HTTPException(503, "Google Sign-In not configured on this server")

    try:
        claims = google_id_token.verify_oauth2_token(
            body.id_token, google_requests.Request(), client_id
        )
    except ValueError:
        raise HTTPException(401, "invalid Google ID token")

    email = claims.get("email")
    if not email or not claims.get("email_verified"):
        raise HTTPException(401, "Google account email not verified")
    google_sub = claims["sub"]

    existing = store.get_user(email)
    if existing is None:
        if email.lower() not in ADMIN_EMAILS:
            raise HTTPException(403, "You're not on the approved list yet — contact the admin for access.")
    elif existing.get("revoked"):
        raise HTTPException(403, "Your access has been revoked — contact the admin if you think this is a mistake.")

    store.upsert_user(email, google_sub)

    session_token = jwt.encode(
        {"email": email, "exp": int(time.time()) + _SESSION_TTL_SECONDS},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )
    return {"token": session_token, "email": email}


@router.get("/api/auth/me")
def whoami(email: str = Depends(get_current_user)):
    return {"email": email}
