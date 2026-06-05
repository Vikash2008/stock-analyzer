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
        os.environ.get("GEMINI_KEY_3", ""),
    ]


class GeminiRequest(BaseModel):
    symbol: str
    section_id: str
    prompt: str
    force_refresh: bool = False
    force_lite: bool = False
    key_index: int = 0


class ChatRequest(BaseModel):
    symbol: str
    question: str
    context_text: str
    force_lite: bool = False
    key_index: int = 0


def _read_api_key(index: int = 0) -> str:
    keys = _load_keys()
    return keys[index] if 0 <= index < len(keys) else keys[0]


def _extract_text(resp) -> tuple[str, str]:
    """Return (text, debug_reason). Filters thinking parts for gemini-2.5-flash."""
    # Primary: .text property (SDK should exclude thought parts)
    try:
        t = resp.text
        if t and t.strip():
            return t.strip(), "resp.text"
    except Exception as exc:
        pass

    # Fallback: iterate parts, skip thought=True parts (thinking model artefacts)
    try:
        parts = resp.candidates[0].content.parts
        answer = [p.text for p in parts
                  if getattr(p, "text", None) and not getattr(p, "thought", False)]
        if answer:
            return "\n".join(answer).strip(), "parts_no_thought"
        # Last resort: any text parts at all
        all_t = [p.text for p in parts if getattr(p, "text", None)]
        if all_t:
            return "\n".join(all_t).strip(), "parts_all"
        n_parts = len(parts)
        return "", f"empty_parts(n={n_parts})"
    except Exception as exc2:
        return "", f"parts_error({exc2!r})"


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
    # 1a: with thinking (45s / 70s for peers); 1b: no-thinking retry (55s / 85s for peers)
    _heavy = req.section_id in ("peers",)
    grounded_resp = None
    if not req.force_lite:
        for _thinking in (True, False):
            try:
                cfg = genai_types.GenerateContentConfig(
                    tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
                    **({"thinking_config": genai_types.ThinkingConfig(thinking_budget=0)} if not _thinking else {}),
                )
                grounded_resp = await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda cfg=cfg: client.models.generate_content(
                            model="gemini-2.5-flash",
                            contents=req.prompt,
                            config=cfg,
                        ),
                    ),
                    timeout=(70.0 if _thinking else 85.0) if _heavy else (45.0 if _thinking else 55.0),
                )
                break  # success — stop retrying
            except asyncio.TimeoutError:
                label = "with thinking" if _thinking else "no-thinking retry"
                print(f"[gemini] 2.5-flash TIMEOUT ({label}) — symbol={req.symbol!r} section={req.section_id!r}")
                if not _thinking:
                    grounded_resp = None  # both attempts failed
            except Exception as exc:
                err = str(exc)
                if _is_fatal_error(err):
                    return JSONResponse({"error": err[:400]}, status_code=500)
                print(f"[gemini] 2.5-flash EXCEPTION — symbol={req.symbol!r} section={req.section_id!r} err={err[:200]!r}")
                break  # non-timeout error — no point retrying with no-thinking

    if grounded_resp is not None:
        text, extract_reason = _extract_text(grounded_resp)
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
        # 2.5 Flash returned empty text — log reason and fall through to 3.1 Lite
        print(f"[gemini] 2.5-flash empty text, extract_reason={extract_reason!r}, "
              f"candidates={len(getattr(grounded_resp, 'candidates', []))}")

    # ── Attempt 2: gemini-3.1-flash-lite without grounding ───────────────
    # (500 RPD on free tier — reliable fallback when grounding quota exhausted)
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
            text, extract_reason = _extract_text(plain_resp)
            if text:
                result = {"text": text, "sources": [], "grounded": False, "model": "gemini-3.1-flash-lite"}
                _cache[key] = (result, time.time())
                return result
            print(f"[gemini] 3.1-lite empty text (attempt {_attempt}), extract_reason={extract_reason!r}, "
                  f"candidates={len(getattr(plain_resp, 'candidates', []))}")
            if _attempt == 0:
                await asyncio.sleep(2)
        except asyncio.TimeoutError:
            if _attempt == 1:
                return JSONResponse({"error": "Gemini timed out — try again"}, status_code=504)
        except Exception as exc:
            if _attempt == 1:
                return JSONResponse({"error": str(exc)[:400]}, status_code=500)
            await asyncio.sleep(3)

    return JSONResponse({"error": "Gemini returned an empty response — try again"}, status_code=500)


@router.post("/api/gemini/chat")
async def gemini_chat(req: ChatRequest):
    """Free-form Q&A using card context + Google Search grounding. No caching."""
    api_key = _read_api_key(req.key_index)
    if not api_key:
        return JSONResponse({"error": "GEMINI_API_KEY not configured"}, status_code=500)

    if req.force_lite:
        prompt = (
            f"You are a financial research assistant.\n\n"
            f"Background research on {req.symbol} (for reference):\n"
            f"--- CONTEXT ---\n{req.context_text[:4000]}\n--- END CONTEXT ---\n\n"
            f"User question: {req.question}\n\n"
            f"Answer using the context and your knowledge. Use markdown formatting. "
            f"Lead with specific numbers and figures. No preamble."
        )
    else:
        prompt = (
            f"You are a financial research assistant with access to Google Search.\n\n"
            f"Background research on {req.symbol} (for reference only):\n"
            f"--- CONTEXT ---\n{req.context_text}\n--- END CONTEXT ---\n\n"
            f"User question: {req.question}\n\n"
            f"Instructions:\n"
            f"- The context above is background only. Do NOT limit your answer to what is already in the context.\n"
            f"- Actively use Google Search to find data that directly answers the question, especially historical figures, year-on-year trends, and recent data not present in the context.\n"
            f"- If the context lacks specific figures requested (e.g. 3-year growth data, quarterly numbers), search annual reports, investor presentations, or news to find them.\n"
            f"- Use markdown formatting. Lead with specific numbers and figures. No preamble."
        )

    client = genai.Client(api_key=api_key, http_options={"api_version": "v1beta"})
    loop = asyncio.get_running_loop()

    # Attempt 1: gemini-2.5-flash with Google Search grounding (1a: thinking, 1b: no-thinking)
    grounded_resp = None
    if not req.force_lite:
        for _thinking in (True, False):
            try:
                cfg = genai_types.GenerateContentConfig(
                    tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
                    **({"thinking_config": genai_types.ThinkingConfig(thinking_budget=0)} if not _thinking else {}),
                )
                grounded_resp = await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda cfg=cfg: client.models.generate_content(
                            model="gemini-2.5-flash",
                            contents=prompt,
                            config=cfg,
                        ),
                    ),
                    timeout=45.0 if _thinking else 55.0,
                )
                break
            except asyncio.TimeoutError:
                label = "with thinking" if _thinking else "no-thinking retry"
                print(f"[gemini/chat] 2.5-flash TIMEOUT ({label}) — symbol={req.symbol!r}")
                if not _thinking:
                    grounded_resp = None
            except Exception as exc:
                err = str(exc)
                if _is_fatal_error(err):
                    return JSONResponse({"error": err[:400]}, status_code=500)
                print(f"[gemini/chat] 2.5-flash EXCEPTION — symbol={req.symbol!r} err={err[:200]!r}")
                break

    if grounded_resp is not None:
        text, extract_reason = _extract_text(grounded_resp)
        sources: list[str] = []
        try:
            chunks = grounded_resp.candidates[0].grounding_metadata.grounding_chunks or []
            sources = [c.web.uri for c in chunks if hasattr(c, "web") and c.web.uri]
        except Exception:
            pass
        if text:
            return {"text": text, "sources": sources, "grounded": True, "model": "gemini-2.5-flash"}
        print(f"[gemini/chat] 2.5-flash empty text, extract_reason={extract_reason!r}")

    # Fallback: gemini-3.1-flash-lite (no grounding — 500 RPD free tier)
    for _attempt in range(2):
        try:
            resp = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: client.models.generate_content(
                        model="gemini-3.1-flash-lite",
                        contents=prompt,
                    ),
                ),
                timeout=25.0,
            )
            text, extract_reason = _extract_text(resp)
            if text:
                return {"text": text, "sources": [], "grounded": False, "model": "gemini-3.1-flash-lite"}
            # Empty text — log and retry on first attempt
            print(f"[gemini/chat] 3.1-lite empty text (attempt {_attempt}), extract_reason={extract_reason!r}, "
                  f"candidates={len(getattr(resp, 'candidates', []))}")
            if _attempt == 0:
                await asyncio.sleep(2)
        except asyncio.TimeoutError:
            if _attempt == 1:
                return JSONResponse({"error": "Gemini timed out — try again"}, status_code=504)
        except Exception as exc:
            if _attempt == 1:
                return JSONResponse({"error": str(exc)[:400]}, status_code=500)
            await asyncio.sleep(3)

    return JSONResponse({"error": "Gemini returned an empty response — try again"}, status_code=500)
