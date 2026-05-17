# CLAUDE.md

## BOOT PROTOCOL — Read This First, Do Nothing Else

1. Read `ARCHITECTURE.md` — active file map, navigation flow, invariants.
2. Read `app_UI.md` — all UI design decisions, colours, layouts, component styles.
3. Do **not** explore files, run analysis, or check git status unless the user asks.
4. Assume all existing code is correct unless the user shows an error.
5. Ask the user what they want to do next.

> For full architecture detail see **ARCHITECTURE.md**.

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

## Session State (2026-05-17)

Last changes (not yet pushed — run `/ship` to deploy):
- app.py: manual refresh button top-right; `_load_bundle` has NO TTL (manual-only)
- dashboard/metrics.py: tile redesign — 2×2 grid (Invested / P&L / Return / XIRR), side-by-side CTAs
- dashboard/metrics.py: `xirr_seg` + `xirr_multi_seg` fixed — `~isin(SKIP_PORTS)` + filter txns by syms/ports sets
- dashboard/summary_page.py: full rewrite — see summary_page key functions below
- src/xirr.py: `portfolio_xirr` now accepts `terminal_override` + `terminal_date` optional params

## summary_page.py — Key Functions & Decisions

**Metrics available:** Portfolio Value | Invested | Profit / Loss | Return % | XIRR Trend

**Helpers:**
- `_fmt_num(v)` — ₹ format: ≥1Cr → "₹X.XX Cr", ≥1L → "₹X.XX L", else "₹X,XXX"
- `_auto_scale(s)` → (divisor, hover_suffix, tick_suffix) — picks Cr/L based on series magnitude
- `_stat(label, value, color)` — one-line HTML stat above chart
- `_line_fig(x, y, name, color, fmt, suffix, divisor, fill)` — divisor scales y; fill=False for Value/Invested
- `_style(fig, title, y_tick_suffix)` — rangemode="normal" so Y axis fits data, not forced to 0

**Stat shown per chart:**
- Portfolio Value → gain in period (val[-1] - val[0])
- Invested → invested in period (inv[-1] - inv[0])
- Profit / Loss → gain/loss change in period (pnl[-1] - pnl[0])
- Return % → return gain in period (ret[-1] - ret[0])
- XIRR Trend → current XIRR (s[-1])

**XIRR Trend — segment fix:**
- `_build_xirr_trend_multi(txns_seg, port_h, usd_inr)` — uses historical val_series at each month T as terminal (not today's value), prevents artificial downtrend from multi-portfolio segments
- `_build_xirr_trend(txns, port_h, usd_inr, portfolio)` — single portfolio, uses today's terminal (unchanged)

**render(bundle, port)** — single portfolio entry point
**_render_multi(bundle, filtered_h)** — segment entry; builds combined val+inv series, same chart/stat logic
**render_page(bundle)** — routes to render() or _render_multi() based on sel_portfolio / sel_segment

## Active Files

```
app.py                      Thin router — sidebar, bundle load, page router
validate.py                 Terminal CLI (no Streamlit)
src/
  engine.py                 build() → PortfolioBundle
  cache.py                  Disk cache (data/.cache.pkl)
  data_loader.py            CSV/Excel ingestion, MSP auto-detect
  portfolio.py              FIFO engine, enrich_holdings()
  price_fetcher.py          yfinance wrappers
  schema.py                 Frozen schema + validation
  xirr.py                   XIRR calculation
dashboard/
  ui_state.py               Navigation state (session_state + URL sync)
  classify.py               USD_PORTS, SKIP_PORTS, segment() — single source of truth
  metrics.py                Overview tiles, XIRR, breakdown
  charts.py                 Price line + BUY/SELL bubble chart
  portfolio_page.py         page=portfolios
  holdings_page.py          page=holdings
  transactions_page.py      page=transactions (Transactions + Charts tabs)
data/
  msp_v2.csv                Transaction source (do not rename)
  .cache.pkl                Persistent cache (do not delete)
```

---

## Navigation

```
portfolios → holdings → transactions
                         ├─ Tab: Transactions table
                         └─ Tab: Charts (price history + BUY/SELL bubbles)
```

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
5. **UI changes = edit files only.** Do not run `git`, `streamlit`, or any deploy commands unless explicitly asked.

## Commands

| Command | What it does |
|---------|-------------|
| `/save_state` | Updates app_UI.md, ARCHITECTURE.md, CLAUDE.md with session changes |
| `/ship` | Mobile optimisation → git commit → git push → Streamlit auto-deploys |

---

## Session End — Save State

Before closing a session where code changed, run `/save_state` or manually:
- Update `ARCHITECTURE.md` if files were added/removed or flow changed.
- Update `CLAUDE.md` Validated Numbers / Constraints if anything changed.
- Do not update these files if nothing architectural changed.

---

## Git

```powershell
git add -p && git commit -m "description" && git push
```
