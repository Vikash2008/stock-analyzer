"""
POST /api/gemini

Attempt 1: gemini-2.5-flash with Google Search grounding (free tier: ~250 RPD, 10 RPM).
Attempt 2: gemini-3.1-flash-lite without grounding (free tier: ~500 RPD) — fallback when grounding quota exhausted.
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

_cache: dict[tuple, tuple[dict, float]] = {}
_TTL = 3600.0

def _load_keys() -> list[str]:
    return [
        os.environ.get("GEMINI_KEY_MAIN", ""),
        os.environ.get("GEMINI_KEY_BACKUP", ""),
    ]


class GeminiRequest(BaseModel):
    symbol: str
    section_id: str
    prompt: str
    force_refresh: bool = False
    force_lite: bool = False
    key_index: int = 0


def _read_api_key(index: int = 0) -> str:
    keys = _load_keys()
    return keys[index] if 0 <= index < len(keys) else keys[0]


def _extract_text(resp) -> str:
    try:
        t = resp.text
        if t:
            return t
    except Exception:
        pass
    try:
        parts = resp.candidates[0].content.parts
        texts = [p.text for p in parts if hasattr(p, "text") and p.text]
        if texts:
            return "\n".join(texts)
    except Exception:
        pass
    return ""


def _is_fatal_error(msg: str) -> bool:
    m = msg.lower()
    return "unauthenticated" in m or "api_key" in m or "permission_denied" in m or "403" in m or "401" in m


@router.post("/api/gemini")
async def gemini_query(req: GeminiRequest):
    key = (req.symbol, req.section_id, req.force_lite, req.key_index)
    if not req.force_refresh and key in _cache and time.time() - _cache[key][1] < _TTL:
        return _cache[key][0]

    api_key = _read_api_key(req.key_index)
    if not api_key:
        return JSONResponse({"error": "GEMINI_API_KEY not configured"}, status_code=500)

    client = genai.Client(api_key=api_key, http_options={"api_version": "v1beta"})
    loop = asyncio.get_running_loop()

    # ── Attempt 1: gemini-2.5-flash with Google Search grounding ─────────
    grounded_resp = None
    if not req.force_lite:
        try:
            grounded_resp = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: client.models.generate_content(
                        model="gemini-2.5-flash",
                        contents=req.prompt,
                        config=genai_types.GenerateContentConfig(
                            tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
                        ),
                    ),
                ),
                timeout=25.0,
            )
        except asyncio.TimeoutError:
            pass  # fall through to attempt 2
        except Exception as exc:
            err = str(exc)
            if _is_fatal_error(err):
                return JSONResponse({"error": err[:400]}, status_code=500)
            # 503 overload, 429 grounding/RPM quota, or any transient error → fall through to attempt 2

    if grounded_resp is not None:
        text = _extract_text(grounded_resp)
        sources: list[str] = []
        try:
            chunks = grounded_resp.candidates[0].grounding_metadata.grounding_chunks or []
            sources = [c.web.uri for c in chunks if hasattr(c, "web") and c.web.uri]
        except Exception:
            pass
        if text:
            result = {"text": text, "sources": sources, "grounded": True, "model": "gemini-2.5-flash"}
            _cache[key] = (result, time.time())
            return result

    # ── Attempt 2: gemini-3.1-flash-lite without grounding ───────────────
    # (500 RPD on free tier — reliable fallback when grounding quota exhausted)
    plain_resp = None
    for _attempt in range(2):
        try:
            plain_resp = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: client.models.generate_content(
                        model="gemini-3.1-flash-lite",
                        contents=req.prompt,
                    ),
                ),
                timeout=25.0,
            )
            break
        except asyncio.TimeoutError:
            if _attempt == 1:
                return JSONResponse({"error": "Gemini timed out — try again"}, status_code=504)
        except Exception as exc:
            if _attempt == 1:
                return JSONResponse({"error": str(exc)[:400]}, status_code=500)
            await asyncio.sleep(3)
    if plain_resp is None:
        return JSONResponse({"error": "Gemini unavailable — try again"}, status_code=503)

    text = _extract_text(plain_resp)
    if not text:
        return JSONResponse({"error": "Gemini returned an empty response — try again"}, status_code=500)

    result = {"text": text, "sources": [], "grounded": False, "model": "gemini-3.1-flash-lite"}
    _cache[key] = (result, time.time())
    return result
