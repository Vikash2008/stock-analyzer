"""
Watchlist API — star/unstar any stock (not necessarily held), list it, and
fetch live quotes for the starred symbols.

Every endpoint resolves the caller via get_current_user (backend/auth_deps.py)
from their session JWT — same convention as backend/routers/alerts.py (see
that file's docstring for why this replaced the old client-supplied
`client_id` query param on 2026-08-13). This router is pure CRUD over
backend/watchlist_store.py plus one on-demand quote lookup.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend import watchlist_store as store
from backend.auth_deps import get_current_user

router = APIRouter()


class AddWatchlistItemRequest(BaseModel):
    yf_symbol: str
    symbol:    str = ""
    name:      str = ""
    exchange:  str = ""
    currency:  str = "INR"


@router.get("/api/watchlist")
def list_items(client_id: str = Depends(get_current_user)):
    return {"items": store.get_items(client_id)}


@router.post("/api/watchlist")
def add_item(body: AddWatchlistItemRequest, client_id: str = Depends(get_current_user)):
    item = store.add_item(client_id, body.model_dump())
    return {"item": item}


@router.delete("/api/watchlist/{yf_symbol}")
def remove_item(yf_symbol: str, client_id: str = Depends(get_current_user)):
    if not store.remove_item(client_id, yf_symbol):
        raise HTTPException(404, "watchlist item not found")
    return {"ok": True}


@router.get("/api/watchlist/quotes")
def watchlist_quotes(client_id: str = Depends(get_current_user)):
    from src.price_fetcher import get_prices_and_prev_close

    symbols = [i["yf_symbol"] for i in store.get_items(client_id)]
    if not symbols:
        return {"quotes": {}}

    prices, prev_closes = get_prices_and_prev_close(symbols)
    quotes: dict[str, dict] = {}
    for sym in symbols:
        price = prices.get(sym)
        prev  = prev_closes.get(sym)
        change_pct = None
        if price is not None and prev not in (None, 0):
            change_pct = (price - prev) / prev * 100
        quotes[sym] = {"price": price, "prev_close": prev, "change_pct": change_pct}
    return {"quotes": quotes}
