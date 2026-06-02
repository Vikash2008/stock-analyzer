"""
POST /api/gemini

Calls Gemini 2.5 Flash with Google Search grounding and returns the response inline.
Free tier: 1,500 req/day, 15 RPM.
"""

from __future__ import annotations

import asyncio
import os
import time
from pathlib import Path

# Load .env for local dev (no-op on Render where env vars are set directly)
_env_file = Path(__file__).resolve().parent.parent.parent / ".env"
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        if "=" in _line and not _line.startswith("#"):
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

from google import genai
from google.genai import types as genai_types
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter()

_cache: dict[tuple[str, str], tuple[dict, float]] = {}
_TTL = 3600.0  # 1 hour per (symbol, section)


class GeminiRequest(BaseModel):
    symbol: str
    section_id: str
    prompt: str
    force_refresh: bool = False


@router.post("/api/gemini")
async def gemini_query(req: GeminiRequest):
    key = (req.symbol, req.section_id)
    if not req.force_refresh and key in _cache and time.time() - _cache[key][1] < _TTL:
        return _cache[key][0]

    # Always prefer .env value so key rotations take effect without restart
    api_key = ""
    try:
        for _line in (Path(__file__).resolve().parent.parent.parent / ".env").read_text().splitlines():
            if _line.startswith("GEMINI_API_KEY="):
                api_key = _line.split("=", 1)[1].strip()
                break
    except Exception:
        pass
    if not api_key:
        api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        env_path = Path(__file__).resolve().parent.parent.parent / ".env"
        debug = f"checked {env_path} exists={env_path.exists()}"
        return JSONResponse({"error": f"GEMINI_API_KEY not configured — {debug}"}, status_code=500)

    try:
        client = genai.Client(api_key=api_key, http_options={"api_version": "v1beta"})
        loop = asyncio.get_running_loop()

        def _call():
            return client.models.generate_content(
                model="gemini-3.1-flash-lite",
                contents=req.prompt,
            )

        resp = await asyncio.wait_for(loop.run_in_executor(None, _call), timeout=25.0)
        text = resp.text

        sources: list[str] = []
        try:
            chunks = resp.candidates[0].grounding_metadata.grounding_chunks or []
            sources = [c.web.uri for c in chunks if hasattr(c, "web") and c.web.uri]
        except Exception:
            pass

        result: dict = {"text": text, "sources": sources}
        _cache[key] = (result, time.time())
        return result

    except asyncio.TimeoutError:
        return JSONResponse({"error": "Gemini is slow right now — try again"}, status_code=504)
    except Exception as exc:
        msg = str(exc)
        if "429" in msg or "quota" in msg.lower() or "resource_exhausted" in msg.lower():
            hint = "daily limit reached — try tomorrow" if "per_day" in msg.lower() or "perday" in msg.lower() else "rate limit — wait ~1 min and retry"
            return JSONResponse({"error": f"Gemini quota: {hint}"}, status_code=429)
        return JSONResponse({"error": msg[:300]}, status_code=500)
