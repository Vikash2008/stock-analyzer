# CLAUDE.md

## BOOT PROTOCOL — Every Session

**Always read (3 files):** `CLAUDE.md` · `QUICK_REF.md` · `FEATURE_MAP.md`

**Read based on task type — nothing else unless asked:**

| Task type | Also read |
|---|---|
| UI fix / component change | `DESIGN.md` — lines 1–375 only (stop before Design Decisions Log) |
| Backend fix / API / data logic | `ARCHITECTURE.md` — Active File Map + API Endpoints + Data Flow + Key Functions |
| Bug with file path given | That file only |
| New feature | `DESIGN.md` (lines 1–375) + `ARCHITECTURE.md` both |
| Backlog / roadmap | `ROADMAP.md` |

---

## TRIGGER RULES — Apply Immediately on Match

| Trigger | Action |
|---|---|
| "UI fix" / "UI only" / "quick fix" | Max 2 tool calls. Edit reported file only. No analysis. No adjacent code. |
| "Debug" / "bug" / "not working" | Read ONLY the reported file. Fix what's visible. No reading adjacent files to "understand context". No edge case analysis. Max 3 tool calls total. |
| Any code edit made | NEVER ship unless user explicitly says `/ship` |
| Task ambiguous OR failed once | STOP. Ask exactly 1 focused question. |
| File path unknown | Check `FEATURE_MAP.md` first. If unclear after 1 speculative read → ask. |
| "Working on: X" declared | Cache X's files in session. No re-reads on follow-up prompts for X. |
| User says "X is done" / "moving on from X" | Evict X from session context. |
| Multiple features cached and context full | Evict oldest declared feature first (FIFO). |
| Editing any `backend/*.py` | Remind user to restart uvicorn after. |
| Session ends with code changed | Offer `/save_state`. |
| Cannot determine approach in ~15s | STOP. Ask ONE question. No more thinking in circles. |
| Render OOM / memory / logs investigation | Ask for a fresh Render API key each session (never reuse/store one) — see `reference_render_api_access` memory for service ID + endpoints. Report all timestamps converted to IST, not raw UTC. |
| Any task that would use an Explore/Agent subagent | Don't. Use direct Read/Grep/Bash instead — subagents burn disproportionate tokens for this project. |

---

## CRITICAL RULES

1. **Do only what is asked.** No edge cases, adjacent cleanup, or unsolicited improvements.
2. **Files in context stay cached.** Never re-read a file already read this session.
3. **15-second thinking limit.** Can't determine approach? Ask ONE focused question. Stop.
4. **Exploration hard limit.** Unknown file → check `FEATURE_MAP.md` first. After 1 speculative read, still unclear → ask. Never read a 3rd exploratory file.
5. **No auto-ship.** Only run `/ship` when user explicitly asks.
6. **Prompt contract.** User provides Type + Problem + Expected. Fewer than 2 → ask first.
7. **Ask before complex tasks.** Ambiguous or failed once → ask. Two failures = mandatory pause.
8. **Ask questions frequently.** Not just before complex tasks — check in often rather than defaulting to autonomous proceeding.
9. **Never use Explore/Agent subagents for this project.** Direct Read/Grep/Bash only.
10. **Render API timestamps are UTC.** Always convert to IST before reporting times back to the user.

---

## PROMPT CONTRACT

User provides: **Type** (UI fix / Backend fix / New feature / Debug) · **Problem** · **Expected**

- All 3 given → `FEATURE_MAP.md` → file → fix. Done.
- Type + feature name → `FEATURE_MAP.md` → file → fix. Done.
- Fewer than 2 fields → ask for missing ones first.

---

## PROJECT

Multi-portfolio stock analyzer — Indian/US stocks. Full details in `QUICK_REF.md`.

Frontend: React 18 + Vite + TS + Tailwind · https://stock-analyzer-blush.vercel.app  
Backend: FastAPI + uvicorn · https://stock-analyzer-2nqw.onrender.com  
GitHub: https://github.com/Vikash2008/stock-analyzer (`master` → Vercel + Render auto-deploy)  
Cold start: Render free tier spins down after inactivity — first hit takes 60–90s.

---

## CONSTRAINTS

1. `backend/main.py` stays thin — CORS + router mounts only.
2. New API endpoint = new router in `backend/routers/` + mount in `main.py`.
3. `validate.py` is terminal-only — no Streamlit imports.
4. No features added unless user requests them.
5. UI changes = edit files only. No git/deploy unless `/ship` invoked.
6. Local dev: `src/engine.py`'s `_DATA_FILE` defaults to `data/msp_v2.csv` (real data) every session. `/ship` always reverts it to `data/demo_msp_v2.csv` first — the real file is gitignored and doesn't exist on Render.

---

## COMMANDS

| Command | What it does |
|---|---|
| `/get_ready` | Session start — reads 3 boot files, shows pending, confirms ready |
| `/save_state` | Updates doc + memory files → git commit (no push) |
| `/ship` | git commit → git push → Vercel + Render auto-deploy |
