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

### Tile layout
- Row 1: Full-width **Total Portfolio** tile
- Row 2: 2-col — **Stocks** | **Mutual Funds**
- Row 3: Breakdown toggle (By Category / By Portfolio)

### Tile card style (CSS class: `portfolio-tile`)
```
background: gain_bg or loss_bg
border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px
border-left: 4px solid gain/loss border color
box-shadow: 0 1px 4px rgba(0,0,0,0.06)
```
- Label (`tile-label`): 10px, `#94a3b8`, uppercase, letter-spacing 0.08em
- Current Value (`tile-value`): 22px, bold `#0f172a`, line-height 1.2
- 2×2 metric grid (`tile-grid`): `grid-template-columns: 1fr 1fr; gap: 6px 8px; margin-top: 10px`
  - Sub-labels (`tile-sublabel`): 10px, `#94a3b8`, uppercase
  - Sub-values (`tile-subval`): 14px bold — INVESTED `#334155`, P&L/RETURN gain/loss color, XIRR `#334155`

### Tile interaction
- Two side-by-side CTAs: `Holdings →` | `Summary →` via `col.columns(2, gap="small")`
- Portfolio tiles → navigate by portfolio name
- Aggregate/category tiles → navigate by segment key (total / stk / mf / indian_stock / us_stock / indian_mf / us_mf)

### By Portfolio breakdown
- India `🇮🇳` and US `🇺🇸` section headers (11px, `#6b7fa3`, uppercase)
- Max 2 tiles per row (mobile safe)
- Sorted by current value descending within each group

---

## Holdings Page (holdings_page.py)

### Summary card (CSS class: `summary-card`)
```
background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px
padding: 14px 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.06)
```
- Label: 10px, `#94a3b8`, uppercase
- Current value (`card-value`): 22px, bold `#0f172a`
- Gain + %: 13px bold, gain/loss color

### Toggle
- `Cumulative` (default) | `Standalone` radio, horizontal, label hidden

### Cumulative view columns
Symbol / Invested / Value / G/L / Return% / XIRR / Qty / Portfolios

### Standalone view columns
Symbol / Portfolio / Qty / Avg Cost / LTP / Invested / Value / G/L / Return% / XIRR

### Interaction
- Table sorted by current value descending
- Row click → immediately navigates to Transactions page (no button)
- Back button: `"← All Portfolios"` (portfolio view) or `"← Overview"` (segment view)

---

## Transactions Page (transactions_page.py)

### Symbol overview card (same style as summary-card above)
- Context: `{port} · {sym}` — 12px, `#94a3b8`
- Current value: 22px bold `#0f172a`
- Gain + %: 13px bold, gain/loss color
- Footer: Qty · Avg Cost · LTP — 11px, `#94a3b8`

### Tabs
- Tab 1 **Transactions**: sorted newest-first, columns Date/Type/Qty/Price/Charges
- Tab 2 **Charts**: price history line + BUY/SELL bubbles

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
2. `_stat` pill — one contextual value for the selected period
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
