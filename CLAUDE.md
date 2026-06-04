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
6. **Ask clarifying questions before complex or repeated tasks.** If a task is ambiguous, touches data logic, or has already failed once — stop and ask focused questions BEFORE writing code. Do not attempt the same approach repeatedly. Two failed attempts = mandatory clarification pause. Ask what the expected output is, what data is available, and what the user has already verified. This is non-negotiable.

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
2. **Equity is a duplicate** — aggregate of stock portfolios (Zerodha + AngelOne + Groww + IndMoney Ind + USD_PORTS); exclude from XIRR via `SKIP_PORTS`. Difference from sum ≤ 0.2 L (FX rounding).
3. **MF_Portfolio is a duplicate** — aggregate of MF portfolios (MF_Vikash + MF_Mahak + others); also in `SKIP_PORTS`.
4. **USD portfolios** — `Vested`, `IndMoney US`, `IndMoney Mummy`; FX fallback ~95.5 (never 84.0 or 85.5).
5. **Indian stock portfolios** — `Zerodha`, `AngelOne`, `Groww`, `IndMoney Ind`, `Upstox`; not in `USD_PORTS`; classify as `indian_stock`.
6. **classify.py** — single source of truth for `USD_PORTS`, `SKIP_PORTS`, `segment()`. Also ported to `frontend/src/utils/segments.ts`.
7. **yf_symbol** — NSE: `.NS`, BSE: `.BO`, US: uppercase (e.g. `META` not `Meta`).
8. **Realized records use clean symbol** — `portfolio.py` stores `tx["symbol"]` (no `.NS`/`.BO`) in realized records; rmap keys are `portfolio:cleanSymbol`.
9. **Single fetch on load** — all filtering (segment, portfolio) is client-side React state; no extra API calls on navigation.
10. **CORS** — `ALLOWED_ORIGIN` env var on Render must match Vercel production URL exactly.
11. **classifyClean vs getSegmentType** — both must agree for all known symbols; classifyClean uses clean symbol (`MON100`, `MAFANG`); getSegmentType uses yf_symbol (`MON100.NS`, `MAFANG.NS`). Keep `US_ETF_CLEAN` in sync with `US_ETF_SYMS`.

---

## Number Correctness Rules (verify after any gains/realized change)

These rules must hold at all times. If any fails, there is a bug in aggregation logic.

### Portfolio Page
| Rule | Check |
|------|-------|
| P1 | Hero current = Stocks current + MF current |
| P2 | Hero invested = Stocks invested + MF invested |
| P3 | Hero totalGain = Stocks totalGain + MF totalGain |
| P4 | Stocks totalGain = Indian Stocks + US Stocks |
| P5 | MF totalGain = Indian MF + US MF |
| P6 | Hero todayGain = sum of all holding.disp_today_gain (non-SKIP) |
| P7 | By Broker: sum of all broker cards = Hero |
| P8 | By Type: sum of all type cards = Hero |

### Holdings Page
| Rule | Check |
|------|-------|
| H1 | Summary current = sum of open HoldingCard current values |
| H2 | Summary invested = sum of open HoldingCard invested values |
| H3 | Summary todayGain = sum of HoldingCard todayGains |
| H4 | Summary totalGain = unrealized + realizedGain |
| H5 | open.totalGain + closed.totalGain = all.totalGain |
| H6 | open.realized + closed.realized = all.realized |

### Transactions Page
| Rule | Check |
|------|-------|
| T1 | currentValue = qty × currentPrice (backend-computed) |
| T2 | totalGain = (currentValue − invested) + realizedGain |
| T3 | invested = avgCost × openQty (backend-computed) |

### Cross-Page (most important — navigate and compare)
| Rule | Check |
|------|-------|
| X1 | Hero totalGain = Holdings(/segment/total) summary totalGain |
| X2 | Stocks tile totalGain = Holdings(/segment/stk) summary totalGain |
| X3 | Indian Stocks card totalGain = Holdings(/segment/indian_stock) summary totalGain |
| X4 | US Stocks card totalGain = Holdings(/segment/us_stock) summary totalGain |
| X5 | HoldingCard totalGain = TransactionsPage summary totalGain |
| X6 | HoldingCard currentValue = TransactionsPage currentValue |
| X7 | HoldingCard todayGain = TransactionsPage todayGain |

### Data Layer
| Rule | Check |
|------|-------|
| D1 | `Equity` and `MF_Portfolio` excluded from every aggregation |
| D2 | USD portfolio gains in INR = native value × `usd_inr` (never hardcoded FX) |
| D3 | rmap keyed by `portfolio:cleanSymbol` (no `.NS`/`.BO`) — confirmed in `portfolio.py` |
| D4 | `data.total_gain` = unrealized only; frontend adds realized on top for true total |
| D5 | Equity.invested ≈ sum of non-SKIP non-Equity portfolios (tolerance ≤ 0.2 L) |

---

## Validated Numbers (as of May 2026)

- USD/INR live rate: ~95.38
- Zerodha invested: ₹37,09,666
- Equity invested: ₹1,33,22,568
- Hero invested (all non-SKIP): ~₹1,44,95,000 (Equity + MF_Vikash + MF_Mahak)
- Tech sector XIRR (stk segment, open+closed): ~42% — open-only = +43.2%, open+closed = +42.0%; UI shows 42.4% ✓
- Note: `analyze_sectors.py` includes MF_Mahak's tech MFs (0P0001NCLP, 0P0001JMZB) which the UI stk segment excludes (they're indian_mf); use the stk-specific pool for comparison

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
