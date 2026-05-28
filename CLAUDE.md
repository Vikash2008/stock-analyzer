# CLAUDE.md

## BOOT PROTOCOL — Execution Mode (Every Session)

1. Read **always** at session start: this file (`CLAUDE.md`), `ARCHITECTURE.md`, `DESIGN.md`, `ROADMAP.md`, and `~/.claude/projects/C--Users-Admin-stock-analyzer/memory/project_react_fastapi.md`.
2. Then read files directly related to the task being asked.
3. Do **not** perform a full repository scan unless explicitly requested.
4. Assume all existing code is correct unless the user shows an error.
5. Ask the user what they want to do next (one question max if ambiguous).

## Critical Rules — Apply to Every Session and Every Prompt

1. **Do only what is asked.** If the request says "UI fix only", do UI fix only — no corner-case checks, no edge-case handling, nothing else.
2. **Keep working files in context.** Once a file is read, never re-read it in the same session unless the user explicitly changes it. Use the already-read content.
3. **If stuck for more than ~30 seconds, ask.** Do not keep thinking in circles — ask one focused question and wait for the answer.
4. **Use context, not files.** Work from what is already in context. Do not read files to "confirm" things already known from this session.
5. **All files read in a session stay in context.** Never re-read a file already read this session — cache aggressively, save time.

---

## Working Style — Follow This Every Session

- **Execution-first.** No over-analysis, no unrelated file exploration, no edge-case evaluation, no architecture redesign.
- **Do exactly what is asked.** Smallest possible code change. No optional improvements or suggestions.
- **Do not over-assess.** If the task is a UI change, edit only the reported lines. Do not audit adjacent code or refactor surrounding logic.
- **No unsolicited cleanup.** Do not fix things that weren't broken, rename variables, or improve code that wasn't touched by the task.
- **Speed over thoroughness.** Optimize for fast response and minimal token usage.
- **No edge cases.** Do not evaluate or handle edge cases unless the user explicitly reports one.
- **Cache aggressively.** Re-use any file already read in the session — do not re-read it.
- **One question max if ambiguous.** Ask one specific question. Do not ask for confirmation on obvious steps.
- **Ship after every change.** After any code edit, immediately run `/ship` — no confirmation needed. User verifies on Pixel 10 via Vercel URL.
- **Output rule.** Direct implementation or fix. No long explanations. No alternative approaches.
- **UI-only fix rule.** When the user says "UI fix", "UI only", or "quick UI fix": edit the reported file directly, no re-reads, no analysis, max 2 tool calls total. Do not debate CSS approaches, do not read adjacent files, do not explain tradeoffs. Just make the change.

---

## Project Goal

Multi-portfolio stock analyzer — Indian (NSE/BSE) and US stocks.
Reads transactions from `data/msp_v2.csv`, computes FIFO holdings and realized P&L
per portfolio, fetches live prices via yfinance, displays results in a React PWA.

---

## Stack

| Layer | Tech | URL |
|-------|------|-----|
| Frontend | React 18 + Vite + TypeScript + Tailwind + Recharts | https://stock-analyzer-blush.vercel.app |
| Backend | FastAPI + uvicorn | https://stock-analyzer-2nqw.onrender.com |
| Data engine | Python — `src/` (FIFO, yfinance, cache) | — |
| Hosting | Vercel (frontend) + Render free tier (backend) | — |

---

## Setup & Running

```powershell
# Backend
pip install -r backend/requirements_backend.txt
uvicorn backend.main:app --reload --port 8000

# Frontend (separate terminal, from frontend/)
# Node.js v24 installed at C:\Program Files\nodejs — add to PATH if needed:
# $env:PATH = "C:\Program Files\nodejs;$env:PATH"
npm install
npm run dev   # http://localhost:5173

# Data validation
python validate.py summary
python validate.py portfolio Zerodha
python validate.py validate
python validate.py -r   # force price refresh
```

## Deployment

- **GitHub**: https://github.com/Vikash2008/stock-analyzer (private, branch `master`)
- **Vercel**: auto-redeploys on push to `master` — entry `frontend/`, output `dist`
- **Render**: auto-redeploys on push to `master` — start `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- **Cold start**: Render free tier spins down after inactivity — first hit takes 60–90s

---

## Critical Invariants

1. **FIFO per portfolio** — `_run_fifo()` runs once per portfolio group; never mix portfolios before FIFO.
2. **Equity is a duplicate** — aggregate of all other portfolios; exclude from XIRR via `SKIP_PORTS`.
3. **USD portfolios** — `Vested`, `IndMoney US`, `IndMoney Mummy`; FX fallback ~95.5 (never 84.0 or 85.5).
4. **classify.py** — single source of truth for `USD_PORTS`, `SKIP_PORTS`, `segment()`. Also ported to `frontend/src/utils/segments.ts`.
5. **yf_symbol** — NSE: `.NS`, BSE: `.BO`, US: uppercase (e.g. `META` not `Meta`).
6. **Single fetch on load** — all filtering (segment, portfolio) is client-side React state; no extra API calls on navigation.
7. **CORS** — `ALLOWED_ORIGIN` env var on Render must match Vercel production URL exactly.

---

## Validated Numbers (as of May 2026)

- USD/INR live rate: ~95.95
- Zerodha invested: ₹37,09,666
- Equity invested: ₹1,33,22,568

---

## Constraints

1. `backend/main.py` stays thin — CORS + router mounts only.
2. New API endpoint = new router in `backend/routers/` + mount in `main.py`.
3. `validate.py` is terminal-only — no Streamlit imports.
4. No features added unless user requests them.
5. **UI changes = edit files only.** Do not run `git` or deploy commands unless `/ship` is explicitly invoked.

---

## Commands

| Command | What it does |
|---------|-------------|
| `/get_ready` | Session start — reads all 6 boot files in parallel + outputs last session context + pending backlog |
| `/save_state` | Updates DESIGN.md, ARCHITECTURE.md, CLAUDE.md with session changes |
| `/ship` | Git commit → git push → Vercel + Render auto-deploy |

---

## Session End — Save State

Before closing a session where code changed, run `/save_state` or update manually:
- `ARCHITECTURE.md` — if files added/removed or API changed
- `DESIGN.md` — if any UI/design decisions changed
- `ROADMAP.md` — if items completed, added, or reprioritized
- `CLAUDE.md` — if invariants, validated numbers, or constraints changed

## Git

```powershell
git add <files>; git commit -m "description"; git push
```
