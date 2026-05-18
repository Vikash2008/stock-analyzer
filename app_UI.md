# app_UI.md — UI Design Decisions

> Load at session start alongside ARCHITECTURE.md and CLAUDE.md.
> All visual/layout/interaction decisions are recorded here.
> Update this file at session end if any UI decisions changed.

---

## Theme & Global Styles (app.py)

- Layout: `wide`
- Header: hidden via CSS (`header[data-testid="stHeader"] { display: none }`)
- Top padding: `.block-container { padding-top: 1rem }`
- All Streamlit branding suppressed: `#MainMenu`, `footer`, `stToolbar`, `stDecoration`, `stBottom`, `stBottomBlockContainer`, `stStatusWidget`, `.viewerBadge_container__r5tak`, `.viewerBadge_link__qRIco`
- `toolbarMode = "minimal"` in `.streamlit/config.toml` (config-level branding suppression)

### Sidebar
- Background: `linear-gradient(180deg, #0d1b2e 0%, #162640 100%)`
- Text: `#b8cce8`
- Buttons: `#1e3a5f` bg, `#2a4a75` border, `#e2eaf5` text; hover → `#2563eb`
- Contents: currency radio (INR/USD), divider, USD/INR rate caption, cache expander

### Global button style
```css
font-size: 11px; padding: 3px 10px; border-radius: 6px;
border: 1px solid #e2e8f0; color: #334155; background: #ffffff;
box-shadow: 0 1px 2px rgba(0,0,0,0.04);
hover → background: #2563eb; color: #fff; border-color: #2563eb;
```

### Dataframe headers
```css
background: #f1f5f9; color: #475569; font-size: 11px;
font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
```

### Dataframe rows
```css
font-size: 12px; color: #1e293b;
```

### Mobile media query (@media max-width: 768px)
Targets CSS classes added to HTML markdown elements — desktop layout unchanged:
```css
.block-container { padding: 0.4rem 0.75rem }
.portfolio-tile  { padding: 8px 10px; border-radius: 8px }
.tile-label      { font-size: 9px; margin-bottom: 2px }
.tile-value      { font-size: 17px }
.tile-grid       { margin-top: 6px; gap: 3px 6px }
.tile-sublabel   { font-size: 9px }
.tile-subval     { font-size: 12px }
.summary-card    { padding: 10px 12px; border-radius: 8px }
.card-value      { font-size: 18px }
.stButton > button { font-size: 10px; padding: 2px 8px }
```

---

## Colour Palette

| Role                  | Hex        |
|-----------------------|------------|
| Gain text             | `#0a7a42`  |
| Loss text             | `#be1c1c`  |
| Gain border           | `#10b981`  |
| Loss border           | `#f43f5e`  |
| Gain tile bg          | `#f0fdf8`  |
| Loss tile bg          | `#fff5f5`  |
| Main text             | `#0f172a`  |
| Sub-label text        | `#94a3b8`  |
| Sub-value text        | `#334155`  |
| Muted / caption text  | `#64748b`  |
| Accent blue           | `#2563eb`  |
| Primary navy          | `#2e4a8a`  |
| Card border           | `#e2e8f0`  |
| Grid lines            | `#f1f5f9`  |
| Chart price line      | `#3b82f6`  |
| Chart BUY marker      | `#10b981`  |
| Chart SELL marker     | `#f43f5e`  |

---

## Portfolios Page (metrics.py)

### Card layout (mobile-first, matches page_portfolios.html)
- Hero card: full-width **Total Portfolio**
- Two full-width stacked cards: **Stocks** | **Mutual Funds**
- Breakdown toggle: `By Type` / `By Broker` (`st.radio`, horizontal)
- By Type: 4 full-width cards (Indian Stocks / US Stocks / Indian MF / US MF)
- By Broker: `🇮🇳 India` / `🇺🇸 US` section labels + one full-width card per broker, sorted by value desc

### Card style (CSS class: `portcard`, inline styles)
```
background: #f0fdf8 (gain) or #fff5f5 (loss)
border: 1px solid #e2e8f0; border-left: 4px solid #10b981 (gain) or #f43f5e (loss)
border-radius: 10px 10px 0 0; padding: 10px 12px; margin-bottom: 0
```
- Label row: 9px, `#94a3b8`, uppercase, letter-spacing 0.1em
- Row A: `font-size:20px` bold value left · today's gain right (colored green/red, or "N/A" muted)
- Row B: `font-size:10px` bold Total G/L+% in gain/loss color left · XIRR right (`#0a7a42`/`#be1c1c`/`#334155`)
- **No footer** on main tiles (Invested/Realized removed from overview cards)
- Button: full-width `st.button("Explore →", key=f"click_{key}", use_container_width=True)` fused below card via CSS

### Card navigation
- `Explore →` button → `ui_state.navigate("holdings", portfolio=X)` or `segment=Y`
- Segment keys: `total / stk / mf / indian_stock / us_stock / indian_mf / us_mf`

---

## Holdings Page (holdings_page.py)

### Summary card (`_summary_card`)
Same portcard style (green/red bg + left border). Shows: label, current value (20px), N/A today gain, G/L+%, Invested. No button.

### Holding cards (`_h_card`)
Same portcard style as overview tiles. Layout:
- Label row: `TICKER · company` left | `LTP value` right (9px, muted)
- Row A: current value (16px bold) left · N/A right
- Row B: Total G/L+% left · XIRR right (colored by sign)
- Footer: Invested · qty sh · avg/sh left | Realized right
- Button: small `→` right-aligned via `st.columns([3,1])`

### Toggle (segment view only)
- `Cumulative` (grouped by symbol across portfolios) | `Standalone` (per portfolio+symbol)
- Portfolio-specific view: no toggle, always one card per holding

### Navigation
- `→` button → `ui_state.navigate("transactions", portfolio=X, symbol=Y)`
- Back: `"← Overview"` (segment) or `"← All Portfolios"` (portfolio)
- Summary tab: `summary_page.render(bundle, port)` (unchanged)

---

## Transactions Page (transactions_page.py)

### Symbol overview card
Same portcard style (green/red bg + left border). Layout:
- Label row: `PORT · SYM · company` left | `LTP value` right
- Row A: current value (20px bold) · N/A today gain
- Row B: G/L+% in gain/loss color
- Footer: Invested · qty sh · avg/sh (single line, muted)
No button (it's the page header).

### Tab 1 — Transactions (tx-row HTML items)
Each row rendered as HTML (no dataframe):
- Left: BUY/SELL/DIVIDEND badge (green/red/blue) + date (11px bold) + `qty sh · price/sh` (10px muted)
- Right: amount in `_fmt()` (12px bold)
- Sorted newest-first
- Badge colors: BUY `#d1fae5`/`#065f46` · SELL `#fee2e2`/`#991b1b` · DIV `#dbeafe`/`#1e40af`

### Tab 2 — Charts
Unchanged: price history line + BUY/SELL bubbles via `charts.render()`.

---

## Charts (charts.py — BUY/SELL bubble chart)

- Price line: `#3b82f6`, width 2
- BUY marker: `#10b981`, opacity 0.85, white outline
- SELL marker: `#f43f5e`, opacity 0.85, white outline
- Bubble size: proportional to tx_value (range 10–46px)
- Chart height: 400px; margins l/r/t/b = 0/0/10/0
- Legend: horizontal, `y=1.01` (above chart area), left-aligned
- Background: `#ffffff`; grid: `#f1f5f9`
- Dark hover tooltip: bg `#1e293b`, text `#f8fafc`
- **Zoom disabled**: `fixedrange=True` on both axes — no touch box-select, no pinch zoom
- Range selector: radio below chart (`1d` → `All`), persisted in `chart_range_{yf_symbol}`
- History fetch: from `min(first_tx − 30d, 5y ago)`

---

## Summary Page (summary_page.py)

### Metrics
Portfolio Value | Invested | Profit / Loss | Return % | XIRR Trend

### Layout
1. **Metric selector** (above chart) — horizontal radio, 5 options
2. **Stat pill** — centered, one line: large colored value + small muted label (`+₹4.2L  gain in period`). Updates on metric switch.
3. **Chart** — line chart, height 380px
4. **Range selector** (below chart) — horizontal radio, `1m` → `All`

Metric and range selectors are intentionally split above/below the chart to prevent
visual crowding on mobile (was the cause of selector/legend overlap on narrow screens).

### Chart style
- All charts: `fixedrange=True` both axes, `dragmode=False`, `displayModeBar: False`
- Y-axis: `rangemode="normal"` (auto-fits data, never forces y=0 into view)
- Y-axis ticks: auto-scaled Cr/L via `_auto_scale()`, % suffix for Return/XIRR
- No chart legend (`showlegend=False`)
- Dark hover tooltip

### Stat per chart
| Metric          | Stat shown                         |
|-----------------|------------------------------------|
| Portfolio Value | Gain in period (val[-1] − val[0])  |
| Invested        | Invested in period (inv[-1] − inv[0]) |
| Profit / Loss   | P&L change in period               |
| Return %        | Return gain in period (ret[-1] − ret[0]) |
| XIRR Trend      | Current XIRR (s[-1])               |

### XIRR Trend — segment vs single-portfolio
- Single portfolio: `_build_xirr_trend()` — uses today's terminal value
- Segment (multiple portfolios): `_build_xirr_trend_multi()` — uses historical val_series at each month T as terminal (prevents artificial downtrend when early months have fewer portfolios)

---

## Number Formatting

### INR
| Amount   | Format     |
|----------|------------|
| ≥ 1 Cr   | `₹X.XX Cr` |
| ≥ 1 L    | `₹X.XX L`  |
| < 1 L    | `₹X,XXX`   |

### USD
| Amount | Format  |
|--------|---------|
| ≥ 1K   | `$X.XK` |
| < 1K   | `$X,XXX`|

---

## Gains Display Convention

### Three gain types

| Type        | Value                              | % Denominator                          |
|-------------|------------------------------------|-----------------------------------------|
| Unrealized  | `disp_current − disp_invested`     | `disp_invested`                         |
| Realized    | `sum(realized_pnl × fx)`          | `sum(qty × buy_price × fx)` (cost basis)|
| Total       | Unrealized + Realized              | `disp_invested + cost_of_sold`          |

> **FX rule:** for rows where `currency == "USD"`, multiply `realized_pnl` and `qty × buy_price` by `usd_inr` before summing.

### Display format

- Combined cell (tables): `₹X.XX L (+Y.Y%)` — value and % always on one line
- Sign: always explicit `+` or `−` prefix on both value and %
- Tile sub-grid cells: value on one line, % inline after a thin space `·`

### Tile grid layout (3×2)

```
INVESTED        | UNREALIZED  ·  +X%
REALIZED  ·+Y%  | TOTAL G/L  ·  +Z%
TOTAL RETURN %  | XIRR
```

- **TOTAL RETURN %** = `(unrealized + realized) / (disp_invested + cost_of_sold) × 100`
- Gain color `#0a7a42` / loss color `#be1c1c` applied to all three gain cells

### Holdings table columns (replaces G/L + Return %)

Replace the two columns `G/L` and `Return %` with three combined columns:

| Column      | Content                              |
|-------------|--------------------------------------|
| Unrealized  | `₹X.XX L (+Y.Y%)`                   |
| Realized    | `₹X.XX L (+Y.Y%)`                   |
| Total G/L   | `₹X.XX L (+Y.Y%)`                   |

### Summary page metric selector additions

Add after existing 5 metrics: `Realized Gains` · `Unrealized Gains` · `Total Gains`

- **Realized Gains** chart: cumulative `sum(realized_pnl × fx)` over time, grouped by `sell_date`
- **Unrealized Gains** chart: `val_series − inv_series` (same as existing P&L series)
- **Total Gains** chart: realized_series (reindexed + ffilled to market dates) + unrealized_series

---

## Navigation UX

- No back button on portfolios page (root)
- Holdings: `"← All Portfolios"` or `"← Overview"` depending on entry mode
- Transactions: `"← Back to {port} Holdings"` or `"← Back to Holdings"`
- URL query params synced on load (browser refresh preserves page state)
- `navigate()` clears all dataframe selection keys to prevent stale-selection bug

---

## Mobile / Responsive Rules

Applied automatically by `/ship` before every deploy:
- `st.columns(N)` — max 2 on any mobile-rendered page
- All HTML markdown fits within 375px (no fixed px widths wider than screen)
- `use_container_width=True` on every `st.dataframe` and `st.plotly_chart`
- Chart height ≤ 400px
- Mobile overrides via `@media (max-width: 768px)` only — desktop unchanged

---

## Key Decisions (non-obvious only)

| Date       | Decision |
|------------|----------|
| 2026-05-17 | `_load_bundle` has **no TTL** — refresh is manual-only via Refresh button. Prevents stale prices without user intent. |
| 2026-05-17 | `sel_segment` cleared only when navigating to `portfolios` — preserved through holdings→transactions→back flow. |
| 2026-05-17 | `navigate()` clears all dataframe selection keys — fixes stale Streamlit selection showing wrong holding on click. |
| 2026-05-17 | `xirr_seg`/`xirr_multi_seg`: filter holdings first, build syms+ports sets, filter txns by those sets. Do NOT call `segment()` on every txn row (wrong + slow). |
| 2026-05-17 | XIRR Trend for segments uses historical `val_series[T]` as terminal at each month T (not today's value). Using today's terminal inflates early months and causes artificial downtrend. |
| 2026-05-17 | Summary page: metric selector **above** chart, range selector **below** chart. Putting both above caused visual overlap on mobile narrow screens. |
| 2026-05-17 | All charts: `fixedrange=True` on both axes. `dragmode=False` alone does not suppress touch box-select on mobile — `fixedrange` is required. |
| 2026-05-17 | CSS classes added to tile/card HTML (`portfolio-tile`, `tile-value`, etc.) so `@media` queries can override inline styles without touching desktop. |
| 2026-05-17 | Tile grid expanded from 2×2 to 3×2: INVESTED · UNREALIZED(+%) · REALIZED(+%) · TOTAL G/L(+%) · TOTAL RTN% · XIRR. Each gain cell has its own color based on its own sign. |
| 2026-05-17 | Holdings table: replaced `G/L` + `Return %` with three combined columns — `Unrealized`, `Realized`, `Total G/L` — each formatted as `+₹X.XX L (+Y.Y%)`. |
| 2026-05-17 | Realized % denominator = cost basis of sold lots (`sum(qty × buy_price × fx)`). Total % denominator = `disp_invested + cost_of_sold`. |
| 2026-05-18 | Mobile redesign prototyped in `page_portfolios.html`. Tile layout finalised: Row A = value (big, left) + today gain (small, right); Row B = total G/L + % (left) + XIRR (right). No buttons on tiles — entire tile is tappable. |
| 2026-05-18 | Breakdown section uses compact single-column row items (not 2-col tiles) so 8–10 broker/segment rows fit on one screen without scrolling. |
| 2026-05-18 | Tap any tile/row → opens detail page with same summary card at top (includes Invested + Realized row) + two tabs: Holdings and Summary. |
| 2026-05-18 | Holdings cards in detail page match overview tile format exactly: same 2-row data layout, today gains, total G/L+%, XIRR. |
| 2026-05-18 | Prototype work is page-by-page in separate HTML files (`page_portfolios.html`, etc.) to keep files small and iteration fast. |
| 2026-05-18 | Stocks and Mutual Funds tiles changed from 2-col `seg-grid` to full-width stacked `row-item` — consistent with all other overview tiles. |
| 2026-05-18 | Added `page-holding` (third page): tap a holding card → opens with two tabs: Transactions and Summary. Same chart widget as portfolio detail Summary tab. |
| 2026-05-18 | Holding card layout finalised: label row = ticker/name (left) + LTP (right). Footer = Invested value + `qty sh · avgCost/sh` sub-line (left), Realized profit colored green/red (right). |
| 2026-05-18 | Holding card footer: Invested + `qty sh · avgCost/sh` on same single line (not two rows). |
| 2026-05-18 | Summary tab stat pill: centered between metric selector and chart. Format: large colored value + small muted label inline (`+₹4.2L  gain in period`). Updates on metric switch. |
| 2026-05-18 | Portfolio summary and holding summary tabs are identical in structure: metric selector → stat pill → chart → range bar. Design approved and finalised. |
| 2026-05-18 | Mobile redesign implemented in Streamlit. All three pages (portfolios, holdings, transactions) now use HTML inline-style cards matching `page_portfolios.html`. |
| 2026-05-18 | Cards use inline HTML (not `st.container`) to support green/red background + colored left border — native Streamlit containers don't support dynamic border colors. |
| 2026-05-18 | `portcard` CSS class added to all card divs. Used for CSS overlay targeting (invisible button trick attempted, reverted — using small `Explore →` / `→` button right-aligned via `st.columns([3,1])` instead). |
| 2026-05-18 | Holdings page: dataframe + row-click selection replaced entirely with `_h_card()` tile cards + small `→` button. Cleaner on mobile, no selection state needed. |
| 2026-05-18 | Transactions page: dataframe replaced with HTML `tx-row` items (badge + date/detail + amount). Charts tab unchanged. |
| 2026-05-18 | Today's gain hardcoded as "N/A (+0.00%)" across all cards — daily price change not available in bundle without backend changes. |
| 2026-05-18 | Cumulative/Standalone toggle retained in segment view only. Portfolio-specific holdings view shows one card per holding directly (no toggle needed for single-portfolio). |
| 2026-05-19 | Clickable tile approach finalised: HTML portcard (`border-radius:10px 10px 0 0`, `margin-bottom:0`) + full-width `st.button(use_container_width=True)` immediately below. CSS fuses them: `.element-container:has(.portcard) + .element-container .stButton > button` → transparent bg, no border, `border-radius:0 0 10px 10px`, `margin-top:-6px`. Attempts tried and rejected: `st.popover` (opens popup, not inline), `<a href>` anchor in `st.html` (sandboxed iframe), `<a href>` with page reload (breaks session state). |
| 2026-05-19 | Main portfolio/segment overview tiles: footer (Invested + Realized) removed. Those fields belong only on the portfolio summary card (top of holdings page). |
| 2026-05-19 | Portfolio/segment summary card (`_summary_card`): full anatomy — value + today gain · G/L + XIRR row · Invested + Realized footer. XIRR computed via `portfolio_xirr()` call at render time (not cached separately). |
| 2026-05-19 | Today's gain backend: `previous_close = iloc[-2]` from existing 5d yfinance download — zero extra API calls. Added `previous_close`, `today_gain`, `today_pct`, `disp_today_gain` columns to `bundle.holdings`. Cache layer `prev_closes` at 30-min TTL alongside `prices`. |
| 2026-05-19 | Today's gain display: `+₹X.XX L (+Y.YY%)` green or `-₹X.XX L (-Y.YY%)` red. "N/A" (muted) when prev close unavailable (< 2 trading days in 5d window). Portfolio/segment today_gain = sum of `disp_today_gain`; today_pct = `tg / (cur - tg) × 100`. |
