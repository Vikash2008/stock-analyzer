"""
Admin-only user management — list/add/revoke/restore/delete entries in
users_store.py. Gated by get_current_admin (backend/auth_deps.py), which
checks the signed-in email against the static ADMIN_EMAILS env var — admin
status is not something grantable through the app itself.

Adding an email here (see users_store.admin_add_user) is the only way an
email can create an account at all — routers/auth.py rejects any email not
already in the store (except the static ADMIN_EMAILS bootstrap case).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend import users_store as store
from backend.auth_deps import get_current_admin

router = APIRouter()


class AddUserRequest(BaseModel):
    email: str


@router.get("/api/admin/users")
def list_users(_admin: str = Depends(get_current_admin)):
    return {"users": store.list_users()}


@router.post("/api/admin/users")
def add_user(body: AddUserRequest, _admin: str = Depends(get_current_admin)):
    email = body.email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(400, "invalid email")
    return {"user": store.admin_add_user(email)}


@router.post("/api/admin/users/{email}/revoke")
def revoke_user(email: str, admin: str = Depends(get_current_admin)):
    if email.lower() == admin.lower():
        raise HTTPException(400, "cannot revoke your own admin account")
    user = store.set_revoked(email, True)
    if user is None:
        raise HTTPException(404, "user not found")
    return {"user": user}


@router.post("/api/admin/users/{email}/restore")
def restore_user(email: str, _admin: str = Depends(get_current_admin)):
    user = store.set_revoked(email, False)
    if user is None:
        raise HTTPException(404, "user not found")
    return {"user": user}


@router.delete("/api/admin/users/{email}")
def delete_user(email: str, admin: str = Depends(get_current_admin)):
    if email.lower() == admin.lower():
        raise HTTPException(400, "cannot delete your own admin account")
    if not store.delete_user(email):
        raise HTTPException(404, "user not found")
    return {"ok": True}
