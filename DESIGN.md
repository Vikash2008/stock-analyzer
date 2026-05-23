# DESIGN.md — React App Design Reference

> Single source of truth for UI decisions, component anatomy, colour palette, and layout rules.
> Update this file whenever a UI decision is made or changed.

---

## Live URLs

| Env | URL |
|-----|-----|
| Production | https://stock-analyzer-blush.vercel.app |
| Backend API | https://stock-analyzer-2nqw.onrender.com |

---

## Colour Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `slate-900` | `#0f172a` | Page background, card background |
| `slate-800` | `#1e293b` | Secondary card background |
| `slate-700` | `#334155` | Borders, dividers |
| `slate-400` | `#94a3b8` | Secondary text, labels |
| `slate-300` | `#cbd5e1` | Primary text |
| `white` | `#ffffff` | High-emphasis values |
| `green-400` | `#4ade80` | Gain, positive P&L |
| `green-500` | `#22c55e` | Icon accent |
| `red-400` | `#f87171` | Loss, negative P&L |
| `sky-400` | `#38bdf8` | Links, active state, currency toggle |

---

## Typography

| Element | Size | Weight | Colour |
|---------|------|--------|--------|
| Page title / portfolio value | `text-2xl` (24px) | bold | white |
| Card value | `text-xl` (20px) | semibold | white |
| Label | `text-xs` (12px) | normal | slate-400 |
| Gain/loss line | `text-sm` (14px) | normal | green-400 / red-400 |
| Section header | `text-sm` (14px) | semibold | slate-300 |

---

## Component Anatomy

### Hero Card (PortfoliosPage)
```
┌─────────────────────────────────────┐
│ TOTAL PORTFOLIO                      │  ← 9px label
│ ₹ CURRENT VALUE    +₹X (+0.8%) today│  ← 22px value / 11px today gain+pct
│ +₹X G/L (+X%)            XIRR 18.5%│  ← 11px gain / 9px XIRR
└─────────────────────────────────────┘
```

### Stocks / MF Tile (PortfoliosPage, side by side)
```
┌──────────────────────┐
│ STOCKS     XIRR 18.5%│  ← 9px label + 9px XIRR
│ ₹45.2 L              │  ← 13px value
│ +₹5.3L (+13.3%)      │  ← 9px total gain
│ today +₹23K (+0.5%)  │  ← 9px today gain+pct
└──────────────────────┘
```
- Left border 3px green/red; background tinted

### Breakdown Card (PortfoliosPage)
```
┌─────────────────────────────────────┐
│ PORTFOLIO NAME            today gain│  ← 9px label / 10px today
│ ₹ CURRENT VALUE                     │  ← 15px value
│ G/L (total incl. realized)  invested│  ← 11px gain / 9px invested
└─────────────────────────────────────┘
```
- Tappable — By Broker → `/holdings/portfolio/:name`; By Type → `/holdings/segment/:key`

### Holding Card (HoldingsPage)
```
┌─────────────────────────────────────┐
│ SYMBOL · company name      LTP      │
│ ₹ current value      today gain+%   │
│ total G/L (incl. realized)  XIRR %  │
└─────────────────────────────────────┘
```
- Tappable — navigates to `/transactions/:portfolio/:symbol`
- XIRR computed client-side per holding (BUY/SELL cashflows + terminal value); shows `→` as fallback if null

### Summary Card (top of HoldingsPage / SummaryPage)
```
┌─────────────────────────────────────┐
│ LABEL                               │
│ ₹ CURRENT VALUE                     │
│ G/L  Return%                        │
└─────────────────────────────────────┘
```

### Transaction Row (TransactionsPage)
```
DATE    BUY/SELL/DIV    QTY @ PRICE    VALUE
```
- BUY: green badge, SELL: red badge, DIVIDEND: sky badge

---

## Page Layouts

### PortfoliosPage (`/`)
- Refresh (↻) button top right; IST timestamp top left
- Hero card: Total portfolio — current value | today gain + today % | total G/L + return % | XIRR
- Stocks tile + MF tile — side by side; each shows value, total G/L + %, today gain + %, XIRR
- Breakdown toggle: **By Type (default)** | By Broker
  - By Type: Indian Stocks / US Stocks / Indian MF / US MF cards; XIRR computed client-side per type; navigate to `/holdings/segment/:key`
  - By Broker: one card per real portfolio (SKIP_PORTS excluded); XIRR from `xirr_by_portfolio` bundle field
  - Both views show: current value, total G/L (unrealized + realized), XIRR
- All cards tappable; portfolio cards → `/holdings/portfolio/:name`

### HoldingsPage (`/holdings/portfolio/:name` or `/holdings/segment/:key`)
- Back button (label carries origin context via nav state)
- Summary card (portfolio or segment header)
- Toggle: Cumulative (grouped by symbol) | Standalone (per symbol+portfolio)
- Sort control (top-right of list): Current Value | Invested | Daily Gain | Daily Gain % | Total Gain | Total Gain % | XIRR — tap again to toggle ↑/↓; default Current Value ↓
- List of HoldingCards, tappable; each shows XIRR computed client-side

### TransactionsPage (`/transactions/:port/:sym`)
- Back button (label = origin page name via nav state)
- Symbol overview card — shows company name (or symbol fallback); current value, today gain, G/L, invested, realized
- Tab 1 — Transactions: TxRow list, newest first
- Tab 2 — Charts: 8 metric pills (Price, Portfolio Value, Invested, Unrealized Gains, Realized Gains, Total Gains, Return %, XIRR Trend)
  - Price pill: PriceChart (price line + BUY/SELL markers) + range selector (1m–All)
  - Other 7 pills: historical line chart scoped to this single holding via usePortfolioHistory + range selector


---

## PWA

- Manifest: `frontend/public/manifest.json`
- Icon: `frontend/public/icon.svg` — dark background + green chart line
- `display: "standalone"` — opens without browser chrome
- `theme_color: "#0f172a"` — status bar matches app background
- Install: Chrome → three-dot menu → "Add to Home screen"

---

## Mobile Target

- Device: Pixel 10 (Android, Chrome)
- Viewport: 412px wide (logical pixels)
- Touch targets: minimum 44px height
- No horizontal scroll — all layouts stack vertically at mobile width
- Font sizes: minimum 12px (labels), standard body 14px

---

## Charts Tab (HoldingsPage)

```
[Portfolio Value][Invested][Unrealized Gains][Realized Gains][Total Gains][Return %][XIRR Trend]
  ← scrollable metric pills (whitespace-nowrap, overflow-x-auto)

+₹45.2L  +₹2.3L in period
┌──────────────────────────────────────────┐
│                line chart                │
└──────────────────────────────────────────┘
┌────────────────────────────────────────────┐
│  1m  3m  6m  1y  2y  3y  5y  All         │  ← segmented control (bg-slate-100, active=bg-white shadow)
└────────────────────────────────────────────┘
```
- X-axis: `interval = floor(N/5) - 1` → ~5 ticks regardless of range
- Y-axis: `domain=['auto','auto']` — scales to data min/max
- XIRR Trend: computed client-side monthly via `utils/xirr.ts` bisection

---

## Known Issues (as of 2026-05-24)

- None critical. See ROADMAP.md Phase 5/6 for pending polish items.

---

## Design Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-05-24 | Migrated from Streamlit to React + FastAPI | Better mobile UX, PWA support, instant navigation |
| 2026-05-24 | Single bundle fetch on load | All filtering client-side → sub-100ms page transitions |
| 2026-05-24 | Render free tier for backend | No credit card, acceptable cold start for personal use |
| 2026-05-24 | Vercel for frontend | Free, auto-deploys from GitHub, global CDN |
| 2026-05-24 | PWA manifest added | "Add to Home Screen" opens standalone (no browser bar) |
| 2026-05-24 | Fixed P&L double-count | Equity + MF_Portfolio (SKIP_PORTS) excluded from all totals |
| 2026-05-24 | Added Stocks + MF tiles to PortfoliosPage | Quick segment overview with XIRR + today % |
| 2026-05-24 | By Broker / By Type breakdown toggle | Replaces flat portfolio list; portfolio cards now include realized P&L in return % |
| 2026-05-24 | XIRR added to bundle | Computed per portfolio + stk/mf/total using existing portfolio_xirr(); shown on hero + tiles |
| 2026-05-24 | 7 historical line charts on HoldingsPage | Client-side via usePortfolioHistory + xirr.ts; no new backend endpoint needed |
| 2026-05-24 | PortfoliosPage header cleanup | Removed currency toggle; IST timezone on timestamp; bigger section labels; Stocks/MF tiles match hero 3-row layout |
| 2026-05-24 | Range selector segmented control | iOS-style bg-slate-100 pill replaces scrollable border buttons |
| 2026-05-24 | SummaryPage removed | Unreachable from UI — dead code removed |
| 2026-05-24 | XIRR on HoldingCard | Client-side per-symbol XIRR (BUY/SELL cashflows + terminal value × 100) |
| 2026-05-24 | XIRR on BreakCards (Overview) | Broker: from xirr_by_portfolio bundle; Type: computed client-side |
| 2026-05-24 | By Type default on Overview | More useful than By Broker as landing view |
| 2026-05-24 | TransactionsPage Charts tab | 8-metric pills: Price (PriceChart + range) + 7 historical series scoped to one holding |
| 2026-05-24 | Sort control on HoldingsPage | 7 sort fields, asc/desc toggle, default Current Value ↓ |
| 2026-05-24 | Back label via nav state | Transactions page back button reflects origin (portfolio or segment name) |
