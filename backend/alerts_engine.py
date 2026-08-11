"""
Price-alert evaluation, run from inside price_refresh.py's _refresh_once()
right after that cycle's price dict is computed — reuses those already-fetched
prices, no extra yfinance calls.

Loops over every client's rules (this app has no login system, so "client"
means one browser/device — see backend/alerts_store.py's module docstring).
A triggered notification is only ever visible to, and only ever pushed to,
the client whose rule fired — never broadcast to every subscriber.

    from backend import alerts_engine
    alerts_engine.evaluate(merged_prices)   # {yf_symbol: price}
"""

from __future__ import annotations

import json
import os
from typing import Optional

from backend import alerts_store as store


def _currency_symbol(yf_symbol: str) -> str:
    return "₹" if yf_symbol.endswith(".NS") or yf_symbol.endswith(".BO") else "$"


def _check_condition(rule: dict, price: float) -> Optional[float]:
    """Returns the pct change (for pct_move rules) if the rule's condition is
    met, or a truthy sentinel (0.0) for abs_price rules, else None."""
    if rule["type"] == "pct_move":
        reference = rule.get("reference_value") or 0
        if reference <= 0:
            return None
        pct_change = (price - reference) / reference * 100
        if rule["direction"] == "above" and pct_change >= rule["threshold_value"]:
            return pct_change
        if rule["direction"] == "below" and pct_change <= -rule["threshold_value"]:
            return pct_change
        return None

    # abs_price
    threshold = rule["threshold_value"]
    if rule["direction"] == "above" and price >= threshold:
        return 0.0
    if rule["direction"] == "below" and price <= threshold:
        return 0.0
    return None


def _build_message(rule: dict, price: float, pct_change: float) -> str:
    cur = _currency_symbol(rule["yf_symbol"])
    symbol = rule["symbol"]
    if rule["type"] == "pct_move":
        verb = "up" if rule["direction"] == "above" else "down"
        return (
            f"{symbol} is {verb} {abs(pct_change):.1f}% from {cur}{rule['reference_value']:.2f} "
            f"(now {cur}{price:.2f})"
        )
    crossed = "above" if rule["direction"] == "above" else "below"
    return f"{symbol} crossed {crossed} {cur}{rule['threshold_value']:.2f} (now {cur}{price:.2f})"


def evaluate(prices: dict[str, float]) -> dict[str, list[dict]]:
    """Check every enabled, non-triggered rule for every client against the
    given price dict. Returns {client_id: [new AlertNotification, ...]} for
    whichever clients got at least one new notification (also persisted +
    pushed to that client's own subscriptions only)."""
    results: dict[str, list[dict]] = {}

    for client_id, client in store.get_all_clients().items():
        new_notifications: list[dict] = []

        for rule in client["rules"]:
            if not rule.get("enabled") or rule.get("triggered"):
                continue
            price = prices.get(rule["yf_symbol"])
            if price is None:
                continue
            result = _check_condition(rule, price)
            if result is None:
                continue

            message = _build_message(rule, price, result)
            notification = store.add_notification(client_id, {
                "rule_id":   rule["id"],
                "yf_symbol": rule["yf_symbol"],
                "symbol":    rule["symbol"],
                "name":      rule.get("name", ""),
                "portfolio": rule.get("portfolio", ""),
                "message":   message,
            })
            store.update_rule(client_id, rule["id"], {"triggered": True})
            new_notifications.append(notification)

        if not new_notifications:
            continue
        results[client_id] = new_notifications

        if store.get_settings(client_id).get("delivery_mode") == "in_app_push":
            for notification in new_notifications:
                _send_push(client_id, notification)

    return results


# ── Web Push ─────────────────────────────────────────────────────────────

def _vapid_config() -> Optional[tuple[str, str]]:
    private_key = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
    subject     = os.environ.get("VAPID_SUBJECT", "").strip()
    if not private_key or not subject:
        return None
    return private_key, subject


def _send_push(client_id: str, notification: dict) -> None:
    config = _vapid_config()
    if config is None:
        print("[alerts_engine] VAPID keys not configured — skipping push send")
        return
    private_key, subject = config

    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        print("[alerts_engine] pywebpush not installed — skipping push send")
        return

    payload = json.dumps({
        "title": f"{notification['symbol']} price alert",
        "body":  notification["message"],
        "url":   f"/transactions/{notification['portfolio']}/{notification['symbol']}",
    })

    for sub in store.get_subscriptions(client_id):
        try:
            webpush(
                subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
                data=payload,
                vapid_private_key=private_key,
                vapid_claims={"sub": subject},
            )
        except WebPushException as e:
            status = getattr(e.response, "status_code", None)
            if status in (404, 410):
                store.remove_subscription(client_id, sub["endpoint"])
            else:
                print(f"[alerts_engine] push send failed for {sub['endpoint'][:40]}...: {e}")
        except Exception as e:
            print(f"[alerts_engine] push send failed for {sub['endpoint'][:40]}...: {e}")
