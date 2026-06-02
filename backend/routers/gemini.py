"""
POST /api/gemini

Calls Gemini 1.5 Flash with Google Search grounding and returns the response inline.
Free tier: 1,500 req/day, 15 RPM.
"""

from __future__ import annotations

import os
import time

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
def gemini_query(req: GeminiRequest):
    key = (req.symbol, req.section_id)
    if not req.force_refresh and key in _cache and time.time() - _cache[key][1] < _TTL:
        return _cache[key][0]

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return JSONResponse({"error": "GEMINI_API_KEY not configured"}, status_code=502)

    try:
        client = genai.Client(api_key=api_key)
        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=req.prompt,
            config=genai_types.GenerateContentConfig(
                tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
            ),
        )
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
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=502)
