# app_UI.md — UI Design Decisions

> Load this at session start alongside ARCHITECTURE.md and CLAUDE.md.
> All visual/layout/interaction decisions are recorded here.
> When making a UI change, update this file before closing the session.

---

## Theme & Global Styles (app.py)

- Layout: `wide`
- Header: hidden via CSS (`header[data-testid="stHeader"] { display: none }`)
- Top padding reduced: `.block-container { padding-top: 1rem }`
- Config: `.streamlit/config.toml` — dark sidebar, custom primary color

### Sidebar
- Background: `#1a2744` (dark navy)
- Text: `#c8d6f0`
- Buttons: background `#2e4a8a`, no border, white text
- Contents: currency radio (INR/USD), Refresh button, USD/INR rate caption, cache expander

### Global button style
```css
font-size: 12px; padding: 4px 12px; border-radius: 6px;
border: 1px solid #c8d6f0; color: #1a2744; background: #f0f4fb;
hover → background: #2e4a8a; color: #fff;
```

### Dataframe headers
- Background: `#f0f4fb`, color: `#1a2744`, font-size: 12px

---

## Colour Palette

| Role            | Hex       |
|-----------------|-----------|
| Gain / positive | `#27ae60` (border), `#1a7a3a` (text) |
| Loss / negative | `#e74c3c` (border), `#c0392b` (text) |
| Gain bg         | `#f0faf4` |
| Loss bg         | `#fdf3f2` |
| Navy (heading)  | `#1a2744` |
| Blue (accent)   | `#2e4a8a` |
| Tile border     | `#dde6f0` |
| Card bg         | `#f0f4fb` |
| Muted text      | `#7f8c8d` |
| Caption text    | `#6b7fa3` |
| Grid lines      | `#f0f4fb` |

---

## Portfolios Page (metrics.py)

### Tile layout
- Row 1: Full-width **Total Portfolio** tile
- Row 2: 2-col — **Stocks** | **Mutual Funds**
- Row 3: Breakdown toggle (By Category / By Portfolio)

### Tile card style
```
background: gain_bg or loss_bg
border: 1px solid #dde6f0; border-radius: 10px; padding: 14px 16px
border-left: 4px solid gain/loss border color
```
- Label: 11px, `#7f8c8d`, uppercase, letter-spacing 0.07em
- Value: 22px, bold, `#1a2744`
- Gain/Loss: 13px bold + 15px bold, gain/loss color, side by side
- XIRR: 11px, `#7f8c8d`, hidden when empty string passed

### Tile interaction
- **All tiles** show `"View Holdings →"` button
- Portfolio tiles → navigate to holdings page filtered by that portfolio
- Aggregate/category tiles → navigate to holdings page filtered by segment key (total / stk / mf / indian_stock / us_stock / indian_mf / us_mf)
- No inline holdings drawer — removed entirely

### By Category breakdown
- 2×2 grid: Indian Stocks | US Stocks / Indian MF | US MF

### By Portfolio breakdown
- India section header: `🇮🇳 India` (11px, `#6b7fa3`, uppercase)
- US section header: `🇺🇸 US` (same style)
- Tiles sorted by current value descending within each group
- Column count = number of portfolios in that group

---

## Holdings Page (holdings_page.py)

### Summary card (shared style)
```
background: #f0f4fb; border: 1px solid #c8d6f0; border-radius: 10px; padding: 12px 16px
```
- Label (portfolio name or segment name): 12px, `#7f8c8d`
- Current value: 22px, bold, `#1a2744`
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
- Cumulative: single-portfolio symbol navigates with portfolio; multi-portfolio navigates with symbol only
- Back button: `"← All Portfolios"` (portfolio view) or `"← Overview"` (segment view)

---

## Transactions Page (transactions_page.py)

### Breadcrumb
- With portfolio: `Portfolios → {port} → {sym}`
- Without portfolio (multi-portfolio cumulative): `Portfolios → {sym}`
- Back button: `"← Back to {port} Holdings"` or `"← Back to Holdings"` when no portfolio

### Symbol overview card
```
background: #f0f4fb; border: 1px solid #c8d6f0; border-radius: 10px; padding: 12px 16px
```
- Context: `{port} · {sym}` — 12px, `#7f8c8d`
- Current value: 22px, bold, `#1a2744`
- Gain + %: 13px bold, gain/loss color
- Footer: Qty · Avg Cost · LTP — 11px, `#7f8c8d`

### Tabs
- Tab 1 **Transactions**: table, sorted newest-first, columns Date/Type/Qty/Price/Charges
- Tab 2 **Charts**: price history line + BUY (green `#27ae60`) / SELL (red `#e74c3c`) bubbles

### Charts tab (charts.py)
- Price line: color `#2e4a8a`, width 1.5
- Bubble size: proportional to tx_value (range 10–46px)
- BUY marker: `#27ae60`, opacity 0.85, white outline
- SELL marker: `#e74c3c`, opacity 0.85, white outline
- Chart height: 400px, no margins
- Legend: horizontal, top-right
- Background: `#ffffff` (plot + paper)
- Grid: `#f0f4fb`
- If price history unavailable: warning shown, bubble chart still renders

---

## Number Formatting (_fmt functions)

### INR (default)
| Amount        | Format         |
|---------------|----------------|
| ≥ 1 Cr (1e7)  | `₹X.XX Cr`     |
| ≥ 1 L (1e5)   | `₹X.XX L`      |
| < 1 L         | `₹X,XXX`       |

### USD
| Amount        | Format         |
|---------------|----------------|
| ≥ 1K (1e3)    | `$X.XK`        |
| < 1K          | `$X,XXX`       |

---

## Navigation UX

- No back button on portfolios page (it is the root)
- Holdings page: `"← All Portfolios"` button at top
- Transactions page: `"← Back to {port} Holdings"` button at top
- URL query params synced on load so browser refresh preserves page state
- `go_back()`: transactions → holdings → portfolios

---

## Mobile / Responsive

- 2-col grids used throughout (works on phone)
- Full-width total tile
- `use_container_width=True` on all dataframes and charts
- Caption text 11px for compact display

---


## Mobile Design Rules

Applied automatically by `/ship` command before every deploy:
- `st.columns(N)` — max 2 columns on any page that renders on mobile
- All HTML markdown widths must fit within 375px (no fixed px widths wider than screen)
- Font sizes in HTML markdown: labels 11–12px, values 18–22px max
- `use_container_width=True` on every `st.dataframe` and `st.plotly_chart`
- Chart height 400px max (fits phone without scrolling)
- Tile padding: `12px 16px` (compact but tappable)

---

## Decisions Log

| Date       | Decision |
|------------|----------|
| 2026-05-17 | Removed inline holdings drawer from overview page; portfolio tiles now navigate to holdings page via "View Holdings →" button |
| 2026-05-17 | Deleted dead files: filters.py, holdings.py, transactions.py, portfolio_split.py, trade_bubbles.py, src/charts.py |
| 2026-05-17 | Aggregate tiles (Total, Stocks, MF, category) are display-only — no drill-down button |
| 2026-05-17 | All tiles now show "View Holdings →" button; aggregate tiles pass segment key, portfolio tiles pass portfolio name |
| 2026-05-17 | Holdings page: Cumulative/Standalone toggle added; default is Cumulative |
| 2026-05-17 | Holdings table: added Invested and XIRR columns to both Cumulative and Standalone views |
| 2026-05-17 | Row click in holdings directly navigates to transactions — no intermediate CTA button |
| 2026-05-17 | sel_segment only cleared on navigate to "portfolios"; preserved through holdings→transactions→back flow |
| 2026-05-17 | By Portfolio breakdown capped at 2 tiles per row for mobile safety |
| 2026-05-17 | Fixed: stale Streamlit dataframe selection caused wrong holding to open — navigate() now clears all selection keys |
| 2026-05-17 | Fixed: sel_segment not cleared when navigating to holdings via portfolio tile — navigate() now clears it for holdings too |
| 2026-05-17 | Performance: bundle cached in memory (app.py @st.cache_data); XIRR batch-computed once per holdings render (holdings_page.py _batch_xirr) |
| 2026-05-17 | Charts tab: range selector (1d–All) implemented as Streamlit radio below chart; data filtered before Plotly so y-axis auto-scales |
| 2026-05-17 | Charts tab: history fetch extended to max(first_tx−30d, 5y ago) so all range buttons have data |
| 2026-05-17 | Summary page added (dashboard/summary_page.py): Portfolio Value, Invested, P&L, XIRR Trend charts with range selector |
| 2026-05-17 | Summary page: all heavy series (value, invested, XIRR) cached via @st.cache_data — range switching slices cached series (instant) |
| 2026-05-17 | All portfolio tiles now show two CTAs: Holdings → and Summary → (stacked, not nested columns) |
| 2026-05-17 | Summary → on aggregate/category tiles navigates to segment-level summary; XIRR Trend only available per-portfolio |
| 2026-05-17 | Summary page registered as page=summary in app.py router; back button navigates to portfolios |
| 2026-05-17 | summary_page.py has known bug in render() Portfolio Value block — _ used instead of fig variable — needs fix in next session |
