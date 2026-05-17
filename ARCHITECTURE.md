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
  charts.py                 Price line + BUY/SELL bubble chart + range selector
  portfolio_page.py         page=portfolios
  holdings_page.py          page=holdings (Holdings tab + Summary tab)
  transactions_page.py      page=transactions (Transactions + Charts tabs)
  summary_page.py           page=summary — portfolio/segment value, invested, P&L, XIRR charts

data/
  msp_v2.csv                Transaction source file (source of truth)
  .cache.pkl                Persistent cache (do not delete)

.streamlit/config.toml      Theme, headless, no usage stats
.claude/commands/ship.md    Custom /ship slash command (mobile audit → commit → push)
```

---

## Navigation Flow

```
app.py  (session_state["page"])
  ├─ "portfolios"   → portfolio_page.render(bundle)
  │      └─ metrics.render(bundle)
  │            ├─ Every tile → "Holdings →" + "Summary →" buttons
  │            ├─ Portfolio tile "Holdings →"  → navigate("holdings", portfolio=X)
  │            ├─ Portfolio tile "Summary →"   → navigate("summary",  portfolio=X)
  │            ├─ Aggregate tile "Holdings →"  → navigate("holdings", segment=KEY)
  │            └─ Aggregate tile "Summary →"   → navigate("summary",  segment=KEY)
  ├─ "holdings"     → holdings_page.render(bundle)
  │      ├─ sel_segment set → _render_segment() — Cumulative/Standalone toggle
  │      │      └─ row click → navigate("transactions", portfolio=X, symbol=Y)
  │      └─ sel_portfolio set → tabs: Holdings | Summary
  │             ├─ Holdings tab: Cumulative/Standalone table → row click → transactions
  │             └─ Summary tab: summary_page.render(bundle, port)
  ├─ "summary"      → summary_page.render_page(bundle)
  │      ├─ Metric selector: Portfolio Value | Invested | P&L | XIRR Trend
  │      ├─ Range selector: 1m → All (slices cached series instantly)
  │      ├─ sel_portfolio set → single-portfolio charts
  │      └─ sel_segment set  → aggregated segment charts (XIRR not available)
  └─ "transactions" → transactions_page.render(bundle)
         ├─ Tab 1: Transactions table
         └─ Tab 2: Charts (price history + BUY/SELL bubbles + range selector)
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

## Cache Layers

### Disk cache (data/.cache.pkl)

| Layer   | TTL       | Invalidated by                   |
|---------|-----------|----------------------------------|
| fifo    | permanent | source file mtime change         |
| prices  | 30 min    | TTL expiry or Refresh button     |
| fx      | 30 min    | same as prices                   |
| info    | 7 days    | TTL expiry                       |

### Streamlit in-memory cache (@st.cache_data)

| What                     | TTL    | Where                        |
|--------------------------|--------|------------------------------|
| `_load_bundle(currency)`                    | **none** | app.py — manual Refresh button only         |
| `_compute_all(...)`                         | 30 min   | metrics.py                                  |
| `_batch_xirr(...)`                          | 30 min   | holdings_page.py                            |
| `_fetch_history(symbol, start)`             | 1 hr     | charts.py — lazy per symbol                 |
| `_build_value_series(port_h, txns, fx)`          | 30 min   | summary_page.py — historical qty × price         |
| `_build_invested_series(port_h, txns, fx)`       | 30 min   | summary_page.py — historical qty × avg_cost      |
| `_build_xirr_trend(txns, port_h, fx, portfolio)` | 30 min   | summary_page.py — monthly XIRR, today's terminal |
| `_build_xirr_trend_multi(txns_seg, port_h, fx)`  | 30 min   | summary_page.py — segment XIRR, historical terminal |

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
- Tile content: Current Value (large) + 2×2 grid — Invested / P&L / Return% / XIRR
- Tile background tinted green/red by gain/loss; left border colored
- Each tile: two side-by-side CTAs — `Holdings →` | `Summary →` via `col.columns(2, gap="small")`
- By Portfolio breakdown renders max 2 tiles per row (mobile safe)
- **Refresh button**: top-right of every page (above page router in app.py); clears disk prices+fx + Streamlit cache

### holdings page
- Two entry modes: portfolio-specific (`sel_portfolio`) or segment-based (`sel_segment`)
- Summary card: label / current value / gain+%
- Toggle: **Cumulative** (default, grouped by symbol) | **Standalone** (per symbol+portfolio)
- Cumulative columns: Symbol / Invested / Value / G/L / Return% / XIRR / Qty / Portfolios
- Standalone columns: Symbol / Portfolio / Qty / Avg Cost / LTP / Invested / Value / G/L / Return% / XIRR
- Row click → immediately navigates to transactions page (no button)
- `sel_segment` preserved through holdings → transactions → back; cleared when navigating to holdings via portfolio tile
- Dataframe selection keys (`h_sel`, `seg_cum_sel`, `seg_std_sel`) cleared in `navigate()` to prevent stale-selection bug

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

| Slash command  | File                          | Does                                                  |
|----------------|-------------------------------|-------------------------------------------------------|
| `/save_state`  | prompts/save_state.md         | Update app_UI.md → ARCHITECTURE.md → CLAUDE.md       |
| `/ship`        | .claude/commands/ship.md      | Mobile audit → git commit → git push → auto-deploy   |

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
