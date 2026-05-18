# CLAUDE.md

## BOOT PROTOCOL — Execution Mode (Every Session)

1. Read **always** at session start: this file (`CLAUDE.md`), `ARCHITECTURE.md`, `app_UI.md`, and `~/.claude/projects/C--Users-Admin-stock-analyzer/memory/project_mobile_streamlit.md`.
2. Then read files directly related to the task being asked.
3. Do **not** perform a full repository scan unless explicitly requested.
4. Assume all existing code is correct unless the user shows an error.
5. Ask the user what they want to do next (one question max if ambiguous).

## Working Style — Follow This Every Session

- **Execution-first.** No over-analysis, no unrelated file exploration, no edge-case evaluation, no architecture redesign.
- **Do exactly what is asked.** Smallest possible code change. No optional improvements or suggestions.
- **Do not over-assess.** If the task is a UI change, edit only the reported lines. Do not audit adjacent code or refactor surrounding logic.
- **No unsolicited cleanup.** Do not fix things that weren't broken, rename variables, or improve code that wasn't touched by the task.
- **Speed over thoroughness.** Optimize for fast response and minimal token usage.
- **One question max if ambiguous.** Ask one specific question. Do not ask for confirmation on obvious steps.
- **Ship after every change.** After any code edit (UI or backend), immediately run `/ship` — no confirmation needed. Local dashboard is obsolete; the user only verifies on mobile via Streamlit Cloud.
- **Output rule.** Direct implementation or fix. No long explanations. No alternative approaches.

---

## Project Goal

Multi-portfolio stock analyzer — Indian (NSE/BSE) and US stocks.
Reads transactions from `data/msp_v2.csv`, computes FIFO holdings and realized P&L
per portfolio, fetches live prices via yfinance, displays results in a Streamlit dashboard.

---

## Setup & Running

```powershell
pip install -r requirements.txt
streamlit run app.py --browser.gatherUsageStats false --server.headless true

python validate.py summary
python validate.py portfolio Zerodha
python validate.py validate
python validate.py -r          # force price refresh
```

## Deployment

- **GitHub**: https://github.com/Vikash2008/stock-analyzer (private, branch `master`)
- **Streamlit Cloud**: auto-redeploys on push to `master`, entry `app.py`
- **Cold start**: ~30–60s (ephemeral filesystem, cache rebuilds)

---

## Critical Invariants

1. **FIFO per portfolio** — `_run_fifo()` runs once per portfolio group; never mix portfolios before FIFO.
2. **Equity is a duplicate** — aggregate of all other portfolios; exclude from XIRR via `SKIP_PORTS`.
3. **USD portfolios** — `Vested`, `IndMoney US`, `IndMoney Mummy`; FX fallback ~95.5 (never 84.0 or 85.5).
4. **classify.py** — single source of truth for `USD_PORTS`, `SKIP_PORTS`, `segment()`.
5. **yf_symbol** — NSE: `.NS`, BSE: `.BO`, US: uppercase (e.g. `META` not `Meta`).

---

## Validated Numbers (as of May 2026)

- USD/INR live rate: ~95.95
- Zerodha invested: ₹37,09,666
- Equity invested: ₹1,33,22,568

---

## Constraints

1. `app.py` stays thin — sidebar + bundle load + page router only.
2. New dashboard section = `dashboard/new_section.py` + one call in `app.py`.
3. `validate.py` is terminal-only — no Streamlit imports.
4. No features added unless user requests them.
5. **UI changes = edit files only.** Do not run `git`, `streamlit`, or any deploy commands unless `/ship` is explicitly invoked.

---

## Commands

| Command | What it does |
|---------|-------------|
| `/save_state` | Updates app_UI.md, ARCHITECTURE.md, CLAUDE.md with session changes |
| `/ship` | Mobile optimisation → git commit → git push → Streamlit auto-deploys |

---

## Session End — Save State

Before closing a session where code changed, run `/save_state` or update manually:
- `ARCHITECTURE.md` — if files added/removed or flow changed
- `app_UI.md` — if any UI decisions changed
- `CLAUDE.md` — if invariants, validated numbers, or constraints changed

## Git

```powershell
git add -p && git commit -m "description" && git push
```
