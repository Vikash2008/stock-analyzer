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

### Portfolio Card (PortfoliosPage)
```
┌─────────────────────────────────────┐
│ LABEL                    today gain │  ← slate-400 / green or red
│ ₹ CURRENT VALUE                     │  ← white, text-xl
│ ₹ invested  G/L  Return%  XIRR      │  ← text-xs, slate-400 / green/red
└─────────────────────────────────────┘
```
- Background: green-tinted (`rgba(34,197,94,0.08)`) for gain, red-tinted for loss
- Left border: 3px solid green-500 or red-500
- Tappable — navigates to `/holdings/portfolio/:name`

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
- Currency toggle (INR / USD) — top right
- Pull-to-refresh: `useForceRefresh()` — swipe or tap refresh icon
- Hero card: Total portfolio (all portfolios combined)
- Section: Stocks tile + MF tile (side by side or stacked)
- Breakdown toggle: By Type / By Broker
- Per-portfolio cards: one per portfolio, tappable

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

- Number accuracy: P&L and realized values need fixing (Phase 4)
- XIRR per holding shows "—" — needs `/api/xirr` endpoint
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
