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
│ SYMBOL          portfolio tag  qty  │
│ ₹ current value                     │
│ invested · G/L · Return%           │
└─────────────────────────────────────┘
```
- Tappable — navigates to `/transactions/:portfolio/:symbol`

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
- Currency toggle (INR / USD) — top right; refresh (↻) button
- Hero card: Total portfolio — current value | today gain + today % | total G/L + return % | XIRR
- Stocks tile + MF tile — side by side; each shows value, total G/L + %, today gain + %, XIRR
- Breakdown toggle: By Broker | By Type
  - By Broker: one card per real portfolio (SKIP_PORTS excluded); shows current value, total G/L (unrealized + realized), return %
  - By Type: Indian Stocks / US Stocks / Indian MF / US MF cards; same fields; navigate to `/holdings/segment/:key`
- All cards tappable; portfolio cards → `/holdings/portfolio/:name`

### HoldingsPage (`/holdings/portfolio/:name` or `/holdings/segment/:key`)
- Back button
- Summary card (portfolio or segment header)
- Toggle: Cumulative (grouped by symbol) | Standalone (per symbol+portfolio)
- List of HoldingCards, tappable

### TransactionsPage (`/transactions/:port/:sym`)
- Back button
- Symbol overview card (value, gain, qty, avg cost, LTP)
- Tab 1 — Transactions: TxRow list, newest first
- Tab 2 — Charts: PriceChart (Recharts line) + BUY/SELL bubbles

### SummaryPage (`/summary/portfolio/:name` or `/summary/segment/:key`)
- Back button
- Metric selector: Portfolio Value | Invested | P&L | Return%
- Bar chart (Recharts) — snapshot view
- Historical line chart — Phase 4 (pending API endpoint)

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

## Known Issues (as of 2026-05-24)

- XIRR per individual holding card shows "—" — `xirr_by_portfolio` is in bundle but per-symbol XIRR not yet computed
- HoldingsPage Charts tab shows placeholder — needs historical series endpoint
- SummaryPage shows bar chart snapshot only — historical line chart pending

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
