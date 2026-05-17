# Architecture — Multi-Portfolio Stock Analyzer

> Single source of truth for active components and finalized design.
> Everything not listed here is either dead code or not yet built.

---

## Active File Map

```
app.py                      Entry point — sidebar, bundle load, page router
validate.py                 Terminal CLI (independent of Streamlit)

src/
  engine.py                 build(currency, force_refresh) → PortfolioBundle
  cache.py                  Disk cache (data/.cache.pkl), per-layer TTLs
  data_loader.py            CSV/Excel ingestion, MSP auto-detect
  portfolio.py              FIFO engine, enrich_holdings()
  price_fetcher.py          yfinance wrappers
  schema.py                 Frozen schema + validation
  xirr.py                   XIRR calculation

dashboard/
  ui_state.py               Navigation state (session_state + URL sync)
  classify.py               USD_PORTS, SKIP_PORTS, US_MF_SYMS, segment()
  metrics.py                Portfolio overview tiles, XIRR, breakdown
  charts.py                 Price line + BUY/SELL bubble chart
  portfolio_page.py         page=portfolios
  holdings_page.py          page=holdings
  transactions_page.py      page=transactions (Transactions + Charts tabs)

data/
  msp_v2.csv                Transaction source file (source of truth)
  .cache.pkl                Persistent cache (do not delete)

.streamlit/config.toml      Theme, headless, no usage stats
```

---

## Navigation Flow

```
app.py  (session_state["page"])
  ├─ "portfolios"   → portfolio_page.render(bundle)
  │      └─ metrics.render(bundle)
  │            ├─ Portfolio tile "View Holdings →" → navigate("holdings", portfolio=X)
  │            └─ Aggregate tile "View Holdings →" → navigate("holdings", segment=KEY)
  ├─ "holdings"     → holdings_page.render(bundle)
  │      ├─ sel_segment set → _render_segment() — Cumulative/Standalone toggle
  │      │      └─ row click → navigate("transactions", portfolio=X, symbol=Y)
  │      └─ sel_portfolio set → portfolio holdings — Cumulative/Standalone toggle
  │             └─ row click → navigate("transactions", portfolio=X, symbol=Y)
  └─ "transactions" → transactions_page.render(bundle)
         ├─ Tab 1: Transactions table
         └─ Tab 2: Charts (price history + BUY/SELL bubbles)
```

### Session state keys
| Key             | Set by                        | Cleared by                  |
|-----------------|-------------------------------|------------------------------|
| `page`          | navigate()                    | —                            |
| `sel_portfolio` | navigate(portfolio=X)         | —                            |
| `sel_symbol`    | navigate(symbol=Y)            | —                            |
| `sel_segment`   | navigate(segment=KEY)         | navigate to "portfolios" only|

---

## Data Flow

```
msp_v2.csv
  → data_loader.py   (parse, validate schema, normalise columns)
  → portfolio.py     (FIFO per portfolio → holdings, realized P&L)
  → price_fetcher.py (yfinance live prices + FX)
  → engine.py        (enrich with disp_* columns, return PortfolioBundle)
  → cache.py         (persist to data/.cache.pkl)
  → dashboard        (read-only, never mutates bundle)
```

---

## PortfolioBundle Fields

| Field         | Type          | Description                          |
|---------------|---------------|--------------------------------------|
| holdings      | DataFrame     | One row per (portfolio, symbol)      |
| transactions  | DataFrame     | All raw transactions post-FIFO       |
| realized      | DataFrame     | Closed positions                     |
| usd_inr       | float         | Live FX rate (fallback ~95.5)        |
| as_of         | datetime      | Price fetch timestamp                |
| cache_status  | str           | Human-readable cache summary         |

---

## Cache Layers (data/.cache.pkl)

| Layer   | TTL       | Invalidated by                   |
|---------|-----------|----------------------------------|
| fifo    | permanent | source file mtime change         |
| prices  | 30 min    | TTL expiry or Refresh button     |
| fx      | 30 min    | same as prices                   |
| info    | 7 days    | TTL expiry                       |

---

## Key Invariants (Never Break These)

1. **FIFO isolation per portfolio** — `_run_fifo()` called once per portfolio group; sells in one portfolio never consume lots from another.

2. **Equity is a duplicate** — The `Equity` portfolio is an aggregate of all others. It is processed in isolation like any portfolio. XIRR excludes `SKIP_PORTS` to avoid double-counting.

3. **USD portfolios** — `Vested`, `IndMoney US`, `IndMoney Mummy` store values in USD. `disp_*` columns convert to display currency. FX fallback is ~95.5 (not 84.0 or 85.5 — those are wrong).

4. **classify.py is the single source of truth** for `USD_PORTS`, `SKIP_PORTS`, `segment()`. Do not duplicate in other files.

5. **yf_symbol format** — NSE → `SYMBOL.NS`, BSE → `SYMBOL.BO`, US → uppercase (e.g., `META` not `Meta`).

---

## Finalized UI Sections

### portfolios page
- Full-width Total tile + 2-col Stocks / MF tiles
- Breakdown toggle: By Category (2×2) or By Portfolio (🇮🇳/🇺🇸 grouped)
- Tile background tinted green/red by gain/loss
- XIRR shown on all tiles (hidden when empty string passed)
- Portfolio tiles link to holdings page; aggregate tiles show inline holdings drawer

### holdings page
- Two entry modes: portfolio-specific (`sel_portfolio`) or segment-based (`sel_segment`)
- Summary card: label / current value / gain+%
- Toggle: **Cumulative** (default, grouped by symbol) | **Standalone** (per symbol+portfolio)
- Cumulative columns: Symbol / Invested / Value / G/L / Return% / XIRR / Qty / Portfolios
- Standalone columns: Symbol / Portfolio / Qty / Avg Cost / LTP / Invested / Value / G/L / Return% / XIRR
- Row click → immediately navigates to transactions page (no button)
- `sel_segment` preserved through holdings → transactions → back navigation

### transactions page
- Breadcrumb + back button
- Symbol overview card (value, gain, qty, avg cost, LTP)
- **Tab 1 — Transactions**: table sorted newest-first (date sorted before string format)
- **Tab 2 — Charts**: price history line + BUY (green) / SELL (red) bubbles, bubble size ∝ tx_value

### charts.render(sym_txns, yf_symbol, current_price)
- `_fetch_history(yf_symbol, start)` — `@st.cache_data(ttl=3600)`, lazy per symbol
- Price history fetched from first transaction date minus 30 days
- Empty history → warning shown, bubble chart still renders

---

## Constraints (Active)

| # | Rule |
|---|------|
| 1 | `app.py` stays thin — sidebar + bundle load + page router only |
| 2 | Logic belongs in `src/` or `dashboard/`, never inline in `app.py` |
| 3 | New dashboard section = new `dashboard/section.py` + one call in `app.py` |
| 4 | `validate.py` is terminal-only — no Streamlit imports |
| 5 | `src/charts.py` deleted — do not recreate; chart code lives in `dashboard/charts.py` |
| 6 | No features added unless user requests them |

---

## Commands (prompts/)

| Slash command  | File                    | Does                                                  |
|----------------|-------------------------|-------------------------------------------------------|
| `/save_state`  | prompts/save_state.md   | Update app_UI.md → ARCHITECTURE.md → CLAUDE.md       |
| `/ship`        | prompts/ship.md         | Mobile audit → git commit → git push → auto-deploy   |

## Running

```powershell
pip install -r requirements.txt
streamlit run app.py --browser.gatherUsageStats false --server.headless true
python validate.py summary
python validate.py portfolio Zerodha
```

## Deployment

- GitHub: https://github.com/Vikash2008/stock-analyzer (private, branch `master`)
- Streamlit Cloud: auto-redeploys on push to `master`, entry `app.py`
- Cold start: ~30–60s (ephemeral filesystem, cache rebuilds)
- Use `/ship` to mobile-optimise + commit + deploy in one command
