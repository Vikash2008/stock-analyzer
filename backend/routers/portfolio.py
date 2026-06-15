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

import hashlib
import time
from pathlib import Path

from fastapi import APIRouter, Query, Request
from fastapi.responses import FileResponse, JSONResponse

from src.engine import build
from backend.serializers import serialize_bundle
from backend.routers.dividends import clear_cache as _clear_div_cache

router = APIRouter()

_mem_cache: dict[str, tuple[dict, float]] = {}
_MEM_TTL = 60.0  # seconds
_MAX_CSV_BYTES = 5 * 1024 * 1024  # 5 MB guard


@router.get("/api/portfolio")
def get_portfolio(
    currency: str = Query("INR", pattern="^(INR|USD)$"),
    force_refresh: bool = Query(False),
):
    now = time.monotonic()
    cache_key = f"{currency}:demo"

    if not force_refresh:
        cached = _mem_cache.get(cache_key)
        if cached and (now - cached[1]) < _MEM_TTL:
            return JSONResponse(content=cached[0])

    bundle = build(currency=currency, force_refresh_prices=force_refresh)
    data = serialize_bundle(bundle)
    _mem_cache[cache_key] = (data, now)

    return JSONResponse(content=data)


@router.post("/api/portfolio")
async def post_portfolio(
    request: Request,
    currency: str = Query("INR", pattern="^(INR|USD)$"),
    force_refresh: bool = Query(False),
):
    body = await request.body()
    if len(body) > _MAX_CSV_BYTES:
        return JSONResponse(status_code=413, content={"error": "File too large (max 5 MB)"})

    csv_content = body.decode("utf-8", errors="replace")
    csv_hash = hashlib.md5(csv_content.encode()).hexdigest()
    cache_key = f"{currency}:{csv_hash[:12]}"

    now = time.monotonic()
    if not force_refresh:
        cached = _mem_cache.get(cache_key)
        if cached and (now - cached[1]) < _MEM_TTL:
            return JSONResponse(content=cached[0])

    bundle = build(currency=currency, force_refresh_prices=force_refresh, csv_content=csv_content)
    data = serialize_bundle(bundle)
    _mem_cache[cache_key] = (data, now)
    _clear_div_cache()

    return JSONResponse(content=data)


@router.get("/api/demo-csv")
def get_demo_csv():
    demo_path = Path("data/demo_msp_v2.csv")
    return FileResponse(
        path=str(demo_path),
        media_type="text/csv",
        filename="demo_portfolio.csv",
        headers={"Content-Disposition": "attachment; filename=demo_portfolio.csv"},
    )
