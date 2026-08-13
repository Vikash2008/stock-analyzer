"""
Price alerts API — rules (create/edit/delete/rearm), notifications
(list/read/dismiss), the delivery-mode setting, and Web Push subscription
management.

Every endpoint resolves the caller via get_current_user (backend/auth_deps.py)
from their session JWT — as of 2026-08-13 this replaced the old
client-supplied `client_id` query param (blind trust was fine for a
throwaway anonymous UUID, not fine now that real accounts exist). All state
is still partitioned per identity in backend/alerts_store.py — its
`client_id` parameter name is unchanged, it's just fed a verified email now
instead of a self-reported UUID — so different people sharing this
deployment never see each other's rules/notifications, and a push
notification only ever reaches the device whose rule fired.

Evaluation itself happens in backend/alerts_engine.py, called from
price_refresh.py's background loop — this router is pure CRUD over
backend/alerts_store.py.
"""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend import alerts_store as store
from backend.auth_deps import get_current_user

router = APIRouter()


# ── Rules ─────────────────────────────────────────────────────────────────

class CreateRuleRequest(BaseModel):
    yf_symbol:       str
    symbol:          str
    name:            str = ""
    portfolio:       str = ""
    type:            str            # 'pct_move' | 'abs_price'
    direction:       str            # 'above' | 'below'
    reference_value: float = 0
    threshold_value: float


class UpdateRuleRequest(BaseModel):
    type:            str | None = None
    direction:       str | None = None
    reference_value: float | None = None
    threshold_value: float | None = None
    enabled:         bool | None = None
    rearm:           bool | None = None   # if true, resets triggered=False


@router.get("/api/alerts/rules")
def list_rules(client_id: str = Depends(get_current_user)):
    return {"rules": store.get_rules(client_id)}


@router.post("/api/alerts/rules")
def create_rule(body: CreateRuleRequest, client_id: str = Depends(get_current_user)):
    if body.type not in ("pct_move", "abs_price"):
        raise HTTPException(400, "type must be 'pct_move' or 'abs_price'")
    if body.direction not in ("above", "below"):
        raise HTTPException(400, "direction must be 'above' or 'below'")
    rule = store.add_rule(client_id, body.model_dump())
    return {"rule": rule}


@router.patch("/api/alerts/rules/{rule_id}")
def edit_rule(rule_id: str, body: UpdateRuleRequest, client_id: str = Depends(get_current_user)):
    patch = body.model_dump(exclude_unset=True, exclude={"rearm"})
    if body.rearm:
        rule = store.rearm_rule(client_id, rule_id, patch.get("reference_value"))
    elif patch:
        rule = store.update_rule(client_id, rule_id, patch)
    else:
        rule = next((r for r in store.get_rules(client_id) if r["id"] == rule_id), None)
    if rule is None:
        raise HTTPException(404, "rule not found")
    return {"rule": rule}


@router.delete("/api/alerts/rules/{rule_id}")
def remove_rule(rule_id: str, client_id: str = Depends(get_current_user)):
    if not store.delete_rule(client_id, rule_id):
        raise HTTPException(404, "rule not found")
    return {"ok": True}


# ── Notifications ─────────────────────────────────────────────────────────

@router.get("/api/alerts/notifications")
def list_notifications(client_id: str = Depends(get_current_user)):
    return {"notifications": store.get_notifications(client_id)}


@router.post("/api/alerts/notifications/{notification_id}/read")
def read_notification(notification_id: str, client_id: str = Depends(get_current_user)):
    notification = store.mark_notification_read(client_id, notification_id)
    if notification is None:
        raise HTTPException(404, "notification not found")
    return {"notification": notification}


@router.post("/api/alerts/notifications/{notification_id}/dismiss")
def dismiss_notification(notification_id: str, client_id: str = Depends(get_current_user)):
    if not store.dismiss_notification(client_id, notification_id):
        raise HTTPException(404, "notification not found")
    return {"ok": True}


# ── Settings ──────────────────────────────────────────────────────────────

class SettingsRequest(BaseModel):
    delivery_mode: str   # 'in_app' | 'in_app_push'


@router.get("/api/alerts/settings")
def get_settings(client_id: str = Depends(get_current_user)):
    return store.get_settings(client_id)


@router.post("/api/alerts/settings")
def update_settings(body: SettingsRequest, client_id: str = Depends(get_current_user)):
    if body.delivery_mode not in ("in_app", "in_app_push"):
        raise HTTPException(400, "delivery_mode must be 'in_app' or 'in_app_push'")
    return store.update_settings(client_id, body.model_dump())


# ── Push subscriptions ───────────────────────────────────────────────────

class PushKeys(BaseModel):
    p256dh: str
    auth:   str


class SubscribeRequest(BaseModel):
    endpoint: str
    keys:     PushKeys


class UnsubscribeRequest(BaseModel):
    endpoint: str


@router.get("/api/alerts/vapid-public-key")
def vapid_public_key():
    key = os.environ.get("VAPID_PUBLIC_KEY", "").strip()
    if not key:
        raise HTTPException(503, "push notifications not configured on this server")
    return {"key": key}


@router.post("/api/alerts/subscribe")
def subscribe(body: SubscribeRequest, client_id: str = Depends(get_current_user)):
    sub = store.add_subscription(client_id, body.model_dump())
    return {"subscription": sub}


@router.post("/api/alerts/unsubscribe")
def unsubscribe(body: UnsubscribeRequest, client_id: str = Depends(get_current_user)):
    store.remove_subscription(client_id, body.endpoint)
    return {"ok": True}
