"""
GET /api/portfolio

Query params:
  currency       "INR" | "USD"   default: "INR"
  force_refresh  bool            default: false

Caching strategy (two layers):
  1. data/.cache.pkl (disk, existing)  — handles price TTL (30 min), FIFO mtime gate
  2. _mem_cache (module-level dict)    — avoids calling engine.build() on burst requests
     TTL = 60s per currency key; negligible memory (two serialised bundles ~200 KB each)
"""

from __future__ import annotations

import time

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from src.engine import build
from backend.serializers import serialize_bundle

router = APIRouter()

_mem_cache: dict[str, tuple[dict, float]] = {}
_MEM_TTL = 60.0  # seconds


@router.get("/api/portfolio")
def get_portfolio(
    currency: str = Query("INR", pattern="^(INR|USD)$"),
    force_refresh: bool = Query(False),
):
    now = time.monotonic()

    if not force_refresh:
        cached = _mem_cache.get(currency)
        if cached and (now - cached[1]) < _MEM_TTL:
            return JSONResponse(content=cached[0])

    bundle = build(currency=currency, force_refresh_prices=force_refresh)
    data = serialize_bundle(bundle)
    _mem_cache[currency] = (data, now)

    return JSONResponse(content=data)
