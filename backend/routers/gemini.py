"""
POST /api/gemini

Attempt 1: gemini-2.5-flash with Google Search grounding (free tier: ~250 RPD, 10 RPM).
Attempt 2: gemini-3.1-flash-lite without grounding (free tier: ~500 RPD) — fallback when grounding quota exhausted.
"""

from __future__ import annotations

import asyncio
import json
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
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

router = APIRouter()

_cache: dict[tuple, tuple[dict, float]] = {}
_TTL = 3600.0

def _load_keys() -> list[str]:
    return [
        os.environ.get("GEMINI_KEY_1", os.environ.get("GEMINI_KEY_MAIN", "")),
        os.environ.get("GEMINI_KEY_2", os.environ.get("GEMINI_KEY_BACKUP", "")),
        os.environ.get("GEMINI_KEY_3", ""),
    ]


class GeminiRequest(BaseModel):
    symbol: str
    section_id: str
    prompt: str
    force_refresh: bool = False
    force_lite: bool = False
    force_31: bool = False
    key_index: int = 0


class ChatRequest(BaseModel):
    symbol: str
    question: str
    context_text: str
    force_lite: bool = False
    force_31: bool = False
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


def _clean_error_message(err: str) -> str:
    """Turns a raw Gemini SDK exception string (often a stringified nested JSON error body)
    into a short, complete sentence safe to show in the UI — never a mid-word character cut."""
    m = err.lower()
    if "429" in err or "quota" in m or "resource_exhausted" in m:
        return "Gemini API quota exceeded for today — please try again later."
    if "503" in err or "overloaded" in m or "unavailable" in m:
        return "Gemini's servers are temporarily overloaded — please try again in a moment."
    if "timeout" in m:
        return "Gemini took too long to respond — please try again."
    if _is_fatal_error(err):
        return "Gemini API key is invalid or unauthorized — check the API key configuration."
    first_line = err.strip().splitlines()[0] if err.strip() else "Gemini request failed."
    return first_line if len(first_line) <= 200 else first_line[:200] + "…"


@router.post("/api/gemini")
async def gemini_query(req: GeminiRequest):
    key = (req.symbol, req.section_id, req.force_lite, req.force_31, req.key_index)
    if not req.force_refresh and key in _cache and time.time() - _cache[key][1] < _TTL:
        return _cache[key][0]

    api_key = _read_api_key(req.key_index)
    if not api_key:
        return JSONResponse({"error": "GEMINI_API_KEY not configured"}, status_code=500)

    client = genai.Client(api_key=api_key, http_options={"api_version": "v1beta"})
    loop = asyncio.get_running_loop()

    # ── force_31=True: jump directly to gemini-3.1-flash-lite ─────────────
    if req.force_31:
        for _attempt in range(2):
            try:
                plain_resp = await asyncio.wait_for(
                    loop.run_in_executor(None, lambda: client.models.generate_content(
                        model="gemini-3.1-flash-lite", contents=req.prompt,
                    )),
                    timeout=25.0,
                )
                text, _ = _extract_text(plain_resp)
                if text:
                    result = {"text": text, "sources": [], "grounded": False, "model": "gemini-3.1-flash-lite"}
                    _cache[key] = (result, time.time())
                    return result
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

    # ── Attempt 1: gemini-2.5-flash with Google Search grounding ─────────
    # Only when force_lite=False. No auto-fallback — frontend offers 3.1 Lite explicitly.
    if not req.force_lite:
        _heavy = req.section_id in ("peers",)
        grounded_resp = None
        _fail_reason = "unavailable"
        _fail_detail = ""
        for _thinking in (True, False):
            try:
                cfg = genai_types.GenerateContentConfig(
                    tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
                    thinking_config=genai_types.ThinkingConfig(
                        thinking_budget=8192 if _thinking else 0
                    ),
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
                _fail_reason = "timeout"
                if not _thinking:
                    grounded_resp = None
            except Exception as exc:
                err = str(exc)
                if _is_fatal_error(err):
                    return JSONResponse({"error": err[:400]}, status_code=500)
                if "429" in err or "quota" in err.lower() or "resource_exhausted" in err.lower():
                    _fail_reason = "quota"
                elif "503" in err or "unavailable" in err.lower() or "overloaded" in err.lower():
                    _fail_reason = "overloaded"
                else:
                    _fail_reason = "error"
                _fail_detail = err[:300]
                print(f"[gemini] 2.5-flash EXCEPTION ({_fail_reason}) — symbol={req.symbol!r} section={req.section_id!r} err={err[:300]!r}")
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
                result = {"text": text, "sources": sources, "grounded": True, "model": "gemini-2.5-flash"}
                _cache[key] = (result, time.time())
                return result
            _fail_reason = "empty"
            print(f"[gemini] 2.5-flash empty text, extract_reason={extract_reason!r}, "
                  f"candidates={len(getattr(grounded_resp, 'candidates', []))}")

        # 2.5 Flash failed — signal frontend with specific reason so user knows why
        return {"error": f"gemini25_{_fail_reason}", "detail": _fail_detail, "text": "", "sources": [], "grounded": False}

    # ── force_lite=True: gemini-2.5-flash-lite WITH grounding ────────────
    # Better fallback than 3.1-lite — supports Google Search grounding.
    # If 2.5-flash-lite also fails → silent auto-fallback to 3.1-flash-lite (no grounding).
    lite_resp = None
    try:
        lite_cfg = genai_types.GenerateContentConfig(
            tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
        )
        lite_resp = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: client.models.generate_content(
                    model="gemini-2.5-flash-lite",
                    contents=req.prompt,
                    config=lite_cfg,
                ),
            ),
            timeout=40.0,
        )
    except Exception as exc:
        print(f"[gemini] 2.5-flash-lite EXCEPTION — symbol={req.symbol!r} section={req.section_id!r} err={str(exc)[:200]!r}")

    if lite_resp is not None:
        text, _ = _extract_text(lite_resp)
        lite_sources: list[str] = []
        try:
            chunks = lite_resp.candidates[0].grounding_metadata.grounding_chunks or []
            lite_sources = [c.web.uri for c in chunks if hasattr(c, "web") and c.web.uri]
        except Exception:
            pass
        if text:
            result = {"text": text, "sources": lite_sources, "grounded": True, "model": "gemini-2.5-flash-lite"}
            _cache[key] = (result, time.time())
            return result

    # Last resort: gemini-3.1-flash-lite without grounding
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

    # ── force_31=True: jump directly to gemini-3.1-flash-lite ─────────────
    if req.force_31:
        for _attempt in range(2):
            try:
                plain_resp = await asyncio.wait_for(
                    loop.run_in_executor(None, lambda: client.models.generate_content(
                        model="gemini-3.1-flash-lite", contents=prompt,
                    )),
                    timeout=25.0,
                )
                text, _ = _extract_text(plain_resp)
                if text:
                    return {"text": text, "sources": [], "grounded": False, "model": "gemini-3.1-flash-lite"}
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

    # Attempt 1: gemini-2.5-flash with Google Search grounding (1a: budget=8192, 1b: budget=0)
    # No auto-fallback — if 2.5 fails, return gemini25_unavailable so caller can retry with force_lite.
    if not req.force_lite:
        grounded_resp = None
        for _thinking in (True, False):
            try:
                cfg = genai_types.GenerateContentConfig(
                    tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
                    thinking_config=genai_types.ThinkingConfig(
                        thinking_budget=8192 if _thinking else 0
                    ),
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

        return {"error": "gemini25_unavailable", "text": "", "sources": [], "grounded": False}

    # force_lite=True: gemini-2.5-flash-lite WITH grounding → fallback to 3.1-flash-lite
    chat_lite_resp = None
    try:
        chat_lite_cfg = genai_types.GenerateContentConfig(
            tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
        )
        chat_lite_resp = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: client.models.generate_content(
                    model="gemini-2.5-flash-lite",
                    contents=prompt,
                    config=chat_lite_cfg,
                ),
            ),
            timeout=40.0,
        )
    except Exception as exc:
        print(f"[gemini/chat] 2.5-flash-lite EXCEPTION — symbol={req.symbol!r} err={str(exc)[:200]!r}")

    if chat_lite_resp is not None:
        text, _ = _extract_text(chat_lite_resp)
        chat_lite_sources: list[str] = []
        try:
            chunks = chat_lite_resp.candidates[0].grounding_metadata.grounding_chunks or []
            chat_lite_sources = [c.web.uri for c in chunks if hasattr(c, "web") and c.web.uri]
        except Exception:
            pass
        if text:
            return {"text": text, "sources": chat_lite_sources, "grounded": True, "model": "gemini-2.5-flash-lite"}

    # Last resort: gemini-3.1-flash-lite without grounding
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


# ── Streaming helpers ──────────────────────────────────────────────────────

def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"

def _chunk_text(chunk) -> str:
    try:
        parts = chunk.candidates[0].content.parts or []
        return "".join(p.text for p in parts if not getattr(p, "thought", False) and getattr(p, "text", None))
    except (IndexError, AttributeError):
        return getattr(chunk, "text", None) or ""

def _chunk_sources(chunk) -> list[str]:
    try:
        gc = chunk.candidates[0].grounding_metadata.grounding_chunks or []
        return [c.web.uri for c in gc if hasattr(c, "web") and c.web.uri]
    except Exception:
        return []


@router.post("/api/gemini/stream")
async def gemini_stream(req: GeminiRequest):
    cache_key = (req.symbol, req.section_id, req.force_lite, req.force_31, req.key_index)
    _sse_headers = {"X-Accel-Buffering": "no", "Cache-Control": "no-cache"}

    async def event_gen():
        if not req.force_refresh and cache_key in _cache and time.time() - _cache[cache_key][1] < _TTL:
            cached = _cache[cache_key][0]
            yield _sse({"text": cached["text"]})
            yield _sse({"done": True, "sources": cached.get("sources", []), "model": cached.get("model"), "grounded": cached.get("grounded", False)})
            return

        api_key = _read_api_key(req.key_index)
        if not api_key:
            yield _sse({"error": "Gemini API key is not configured — check the backend environment settings."})
            return

        c = genai.Client(api_key=api_key, http_options={"api_version": "v1beta"})
        full_text = ""
        sources: list[str] = []
        model_used = ""
        grounded = False

        if req.force_31:
            try:
                stream = await c.aio.models.generate_content_stream(model="gemini-3.1-flash-lite", contents=req.prompt)
                async for chunk in stream:
                    t = _chunk_text(chunk)
                    if t: full_text += t; yield _sse({"text": t})
            except Exception as exc:
                yield _sse({"error": _clean_error_message(str(exc))}); return
            _cache[cache_key] = ({"text": full_text, "sources": [], "grounded": False, "model": "gemini-3.1-flash-lite"}, time.time())
            yield _sse({"done": True, "sources": [], "model": "gemini-3.1-flash-lite", "grounded": False})
            return

        if req.force_lite:
            # Explicit lite request (e.g. a default-model setting) — no silent fallback past
            # this point; a failure here surfaces the same manual 3.1 option as the automatic
            # flash→lite cascade below, instead of quietly downgrading to ungrounded 3.1.
            lite_cfg = genai_types.GenerateContentConfig(tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())])
            try:
                last = None
                stream = await c.aio.models.generate_content_stream(model="gemini-2.5-flash-lite", contents=req.prompt, config=lite_cfg)
                async for chunk in stream:
                    t = _chunk_text(chunk); last = chunk
                    if t: full_text += t; yield _sse({"text": t})
                if last: sources = _chunk_sources(last)
            except Exception as exc:
                yield _sse({"error": "gemini_both_failed", "detail": _clean_error_message(str(exc))}); return
            if not full_text:
                yield _sse({"error": "gemini_both_failed", "detail": "Gemini 2.5 Flash Lite returned an empty response."}); return
            _cache[cache_key] = ({"text": full_text, "sources": sources, "grounded": True, "model": "gemini-2.5-flash-lite"}, time.time())
            yield _sse({"done": True, "sources": sources, "model": "gemini-2.5-flash-lite", "grounded": True})
            return

        # ── Default: gemini-2.5-flash, automatically falling back to gemini-2.5-flash-lite
        # on failure (with a visible progress note) — no further silent fallback to 3.1 Lite;
        # that's a manual choice surfaced via a button once both grounded tiers are exhausted.
        _fail_reason = "unavailable"
        for thinking_budget in (8192, 0):
            if full_text: break
            cfg = genai_types.GenerateContentConfig(
                tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
                thinking_config=genai_types.ThinkingConfig(thinking_budget=thinking_budget),
            )
            last = None
            try:
                stream = await c.aio.models.generate_content_stream(model="gemini-2.5-flash", contents=req.prompt, config=cfg)
                async for chunk in stream:
                    t = _chunk_text(chunk); last = chunk
                    if t: full_text += t; yield _sse({"text": t})
                if full_text:
                    if last: sources = _chunk_sources(last)
                    model_used = "gemini-2.5-flash"; grounded = True
            except Exception as exc:
                err = str(exc)
                if _is_fatal_error(err): yield _sse({"error": _clean_error_message(err)}); return
                if full_text: break
                _fail_reason = "quota" if ("429" in err or "quota" in err.lower() or "resource_exhausted" in err.lower()) else "overloaded" if ("503" in err or "unavailable" in err.lower() or "overloaded" in err.lower()) else "error"

        if not full_text:
            yield _sse({"progress": f"Gemini 2.5 Flash {_fail_reason} — automatically retrying with 2.5 Flash Lite…"})
            lite_cfg = genai_types.GenerateContentConfig(tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())])
            try:
                last = None
                stream = await c.aio.models.generate_content_stream(model="gemini-2.5-flash-lite", contents=req.prompt, config=lite_cfg)
                async for chunk in stream:
                    t = _chunk_text(chunk); last = chunk
                    if t: full_text += t; yield _sse({"text": t})
                if full_text:
                    if last: sources = _chunk_sources(last)
                    model_used = "gemini-2.5-flash-lite"; grounded = True
                else:
                    yield _sse({"error": "gemini_both_failed", "detail": "Gemini 2.5 Flash and 2.5 Flash Lite both returned an empty response."}); return
            except Exception as exc2:
                err2 = str(exc2)
                if _is_fatal_error(err2): yield _sse({"error": _clean_error_message(err2)}); return
                yield _sse({"error": "gemini_both_failed", "detail": _clean_error_message(err2)}); return

        _cache[cache_key] = ({"text": full_text, "sources": sources, "grounded": grounded, "model": model_used}, time.time())
        yield _sse({"done": True, "sources": sources, "model": model_used, "grounded": grounded})

    return StreamingResponse(event_gen(), media_type="text/event-stream", headers=_sse_headers)


@router.post("/api/gemini/chat/stream")
async def gemini_chat_stream(req: ChatRequest):
    _sse_headers = {"X-Accel-Buffering": "no", "Cache-Control": "no-cache"}
    if req.force_lite:
        _prompt = (
            f"You are a financial research assistant.\n\nBackground research on {req.symbol}:\n"
            f"--- CONTEXT ---\n{req.context_text[:4000]}\n--- END CONTEXT ---\n\n"
            f"User question: {req.question}\n\nAnswer concisely using context + knowledge. Markdown, lead with numbers. No preamble."
        )
    else:
        _prompt = (
            f"You are a financial research assistant with access to Google Search.\n\nBackground on {req.symbol} (reference only):\n"
            f"--- CONTEXT ---\n{req.context_text}\n--- END CONTEXT ---\n\n"
            f"User question: {req.question}\n\nInstructions:\n"
            f"- Use Google Search for live data beyond the context.\n"
            f"- Lead with specific numbers and figures. Markdown. No preamble."
        )

    async def event_gen():
        api_key = _read_api_key(req.key_index)
        if not api_key:
            yield _sse({"error": "GEMINI_API_KEY not configured"}); return

        c = genai.Client(api_key=api_key, http_options={"api_version": "v1beta"})
        full_text = ""; sources: list[str] = []

        if req.force_31:
            try:
                stream = await c.aio.models.generate_content_stream(model="gemini-3.1-flash-lite", contents=_prompt)
                async for chunk in stream:
                    t = _chunk_text(chunk)
                    if t: full_text += t; yield _sse({"text": t})
            except Exception as exc:
                yield _sse({"error": str(exc)[:400]}); return
            yield _sse({"done": True, "sources": [], "model": "gemini-3.1-flash-lite", "grounded": False})
            return

        if req.force_lite:
            lite_cfg = genai_types.GenerateContentConfig(tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())])
            last = None; model_used = "gemini-2.5-flash-lite"; grounded = True
            try:
                stream = await c.aio.models.generate_content_stream(model="gemini-2.5-flash-lite", contents=_prompt, config=lite_cfg)
                async for chunk in stream:
                    t = _chunk_text(chunk); last = chunk
                    if t: full_text += t; yield _sse({"text": t})
                if last: sources = _chunk_sources(last)
            except Exception:
                full_text = ""; model_used = "gemini-3.1-flash-lite"; grounded = False
                try:
                    stream = await c.aio.models.generate_content_stream(model="gemini-3.1-flash-lite", contents=_prompt)
                    async for chunk in stream:
                        t = _chunk_text(chunk)
                        if t: full_text += t; yield _sse({"text": t})
                except Exception as exc2:
                    yield _sse({"error": str(exc2)[:400]}); return
            yield _sse({"done": True, "sources": sources, "model": model_used, "grounded": grounded})
            return

        cfg = genai_types.GenerateContentConfig(
            tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
            thinking_config=genai_types.ThinkingConfig(thinking_budget=8192),
        )
        last = None
        try:
            stream = await c.aio.models.generate_content_stream(model="gemini-2.5-flash", contents=_prompt, config=cfg)
            async for chunk in stream:
                t = _chunk_text(chunk); last = chunk
                if t: full_text += t; yield _sse({"text": t})
            if last: sources = _chunk_sources(last)
        except Exception as exc:
            if not full_text:
                yield _sse({"error": "gemini25_unavailable", "detail": str(exc)[:300]}); return

        if not full_text:
            yield _sse({"error": "gemini25_unavailable", "detail": ""}); return

        yield _sse({"done": True, "sources": sources, "model": "gemini-2.5-flash", "grounded": True})

    return StreamingResponse(event_gen(), media_type="text/event-stream", headers=_sse_headers)
