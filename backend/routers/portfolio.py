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

    demo_csv = Path("data/demo_msp_v2.csv").read_text(encoding="utf-8")
    bundle = build(currency=currency, force_refresh_prices=force_refresh, csv_content=demo_csv)
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
    cache_key = f"{currency}:{csv_hash}"

    now = time.monotonic()
    if not force_refresh:
        cached = _mem_cache.get(cache_key)
        if cached and (now - cached[1]) < _MEM_TTL:
            return JSONResponse(content=cached[0])

    try:
        bundle = build(currency=currency, force_refresh_prices=force_refresh, csv_content=csv_content)
    except ValueError as e:
        # Schema validation (missing required columns, unrecognised transaction types) —
        # surface the real message instead of a generic 500.
        return JSONResponse(status_code=400, content={"error": str(e)})
    data = serialize_bundle(bundle)
    data["csv_hash"] = csv_hash
    _mem_cache[cache_key] = (data, now)

    # No portfolio-history invalidation needed here: that cache is now keyed by csv_hash
    # (see portfolio_history.py), so identical content always maps to the same valid entry —
    # nothing to clear on a routine re-POST of unchanged content. The old code compared this
    # request's hash against a single global "last seen" hash, which under concurrent
    # multi-user traffic would flip on every *other* user's request too, forcing this user's
    # already-correct chart cache to be wiped and recomputed for no reason.

    return JSONResponse(content=data)


@router.get("/api/demo-csv")
def get_demo_csv():
    demo_path = Path("data/demo_msp_v2.csv")
    return FileResponse(
        path=str(demo_path),
        media_type="text/csv",
        filename="demo_portfolio.csv",
        headers={"Content-Disposition": "attachment; filename=demo_portfolio.csv", "Cache-Control": "no-store"},
    )
