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

### Stocks / MF Tile (PortfoliosPage, full-width stacked)
```
┌─────────────────────────────────────┐
│ STOCKS                               │  ← 9px bold uppercase label (matches BreakCard)
│ ₹ CURRENT VALUE        Today +₹X    │  ← 15px value / 10px today gain
│ XIRR 18.5%             Total +₹X    │  ← 9px XIRR / 10px total gain
└─────────────────────────────────────┘
```
- Full-width stacked (not side-by-side) — same width as Hero and BreakCards
- Left border 4px green/red; background tinted
- Label: `text-[9px] font-bold text-slate-700 uppercase tracking-widest` — identical to BreakCard
- Value: `text-[15px]` — identical to BreakCard
- Today on row 2 right, XIRR + Total on row 3 — consistent 3-row layout across all cards

### Breakdown Card (PortfoliosPage)
```
┌─────────────────────────────────────┐
│ PORTFOLIO NAME (bold, slate-700)     │  ← 9px bold label
│ ₹ CURRENT VALUE        Today +₹X    │  ← 15px value / 10px today
│ XIRR 18.5%             Total +₹X    │  ← 9px XIRR / 10px total
└─────────────────────────────────────┘
```
- Tappable — By Broker → `/holdings/portfolio/:name`; By Type → `/holdings/segment/:key`

### Holding Card (HoldingsPage)
```
┌─────────────────────────────────────┐
│ COMPANY NAME (bold, slate-700)  LTP │
│ ₹ current value      today gain+%   │
│ XIRR %        total G/L (incl. real)│
└─────────────────────────────────────┘
```
- Tappable — navigates to `/transactions/:portfolio/:symbol`
- Shows company name only (no symbol prefix); falls back to symbol if no company name
- XIRR computed client-side per holding (BUY/SELL cashflows + terminal value); shows `→` as fallback if null
- Today/Total gain spans have `shrink-0 whitespace-nowrap` — never wrap to next line

### Summary Card (top of HoldingsPage / TransactionsPage)
```
┌─────────────────────────────────────┐
│ LABEL (9px bold uppercase)           │
│ ₹ CURRENT VALUE (20px)  Today +₹X  │
│ XIRR %              Total +₹X       │
│ ─────────────────────────────────── │
│ Invested ₹X          Realized +₹X  │
└─────────────────────────────────────┘
```
- Row 2: current value (left, 20px bold) + Today gain (right, 10px fmtCompactGainLine)
- Row 3: XIRR (left, 9px, colored) + Total G/L (right, 10px fmtCompactGainLine) — matches HoldingCard row 3 layout
- Footer: Invested + Realized (border-top divider); replaceable via `footer` prop (TransactionsPage uses custom footer)

### Transaction Row (TransactionsPage)
```
DATE    BUY/SELL/DIV    QTY @ PRICE    VALUE
```
- BUY: green badge, SELL: red badge, DIVIDEND: sky badge

---

## Page Layouts

### PortfoliosPage (`/`)
- IST timestamp (left) + Refresh (↻) button (right) at **bottom** of page
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
- Tab 3 — Analysis: Notes section
  - Add note textarea + full-width "Add Note" button → saves with IST timestamp, newest first
  - Each note: timestamp (slate-400, 9px) + text (slate-700, 12px) + Edit / Delete actions
  - Edit: inline textarea with Save / Cancel buttons
  - Persisted to localStorage keyed by `notes:${portfolio}:${symbol}`


---

## PWA

- Manifest: `frontend/public/manifest.json`
- Icon: `frontend/public/icon.svg` — dark background + green chart line
- `display: "standalone"` — opens without browser chrome
- `theme_color: "#0f172a"` — status bar matches app background
- Install: Chrome → three-dot menu → "Add to Home screen"
- **Service worker** (`vite-plugin-pwa`, Workbox): precaches all JS/CSS/HTML/SVG/PNG/ICO on first load; subsequent opens serve from cache instantly — no white screen
- `registerType: 'autoUpdate'` — new deploy auto-updates SW in background
- `controllerchange` listener in `App.tsx` — when new SW activates, page reloads automatically so users always see the latest JS bundle without manual refresh

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

## Card Gain Display Convention

All cards (Hero, Stocks/MF tiles, BreakCards, HoldingCard, SummaryCard) show:
- `Today` label (`text-[9px] text-slate-400`) + daily gain value (`text-[10px]` colored)
- `Total` label (`text-[9px] text-slate-400`) + total gain value (`text-[10px]` colored)
- Gain values use `fmtCompactGainLine` — compact format: ₹23.4K, ₹1.2L, ₹2.3Cr (no full number below 1K)
- Hero card gain values are `text-[10px]` matching all other cards

---

## Pull-to-Refresh UX (PortfoliosPage)

- Native browser pull-to-refresh blocked via `overscroll-behavior-y: none` on both `html` and `body`
- Custom swipe-down gesture (64px threshold) triggers data-only refresh via `useForceRefresh`
- Pull indicator: "↓ Pull to refresh" → "↑ Release to refresh" → "↻ Refreshing…" (sky-400)
- `useForceRefresh` no longer calls `invalidateQueries` — stale data stays visible during refresh
- Local `refreshing` state controls spin; stops only when backend responds and `data.as_of` updates
- Bottom bar: right-aligned ↻ + timestamp as single tappable unit (`py-3` for 44px touch target)

---

## Multi-Portfolio Segment Navigation

When navigating from a segment view (e.g. US Stocks) to a symbol held across multiple portfolios (e.g. Google in Vested + IndMoney US + IndMoney Mummy):
- `buildRows` (HoldingsPage cumulative mode) collects all portfolios for each symbol into `portfolios: string[]` on `CardRow`
- Nav click passes `portfolios` in `location.state`
- `TransactionsPage` reads `portfolioFilter` from state (falls back to `[decoded.portfolio]` for direct/broker navigation)
- `symTxns`, `symRealized`, `holdingList` all filter by `portfolioFilter`
- Overview card aggregates `cur`, `inv`, `tg`, `qty`, `avg` across all portfolios in view
- `holdingXirr` uses per-tx portfolio for fx rate + aggregated terminal value
- MON100/MAFANG (US ETFs in Indian portfolios): single portfolio → `portfolios: ['Zerodha']` → no change in behaviour

---

## HoldingCard Label

Label row shows `TICKER · Company Name` (or `TICKER · Portfolio` in standalone mode). Falls back to `TICKER` only if no subLabel.

---

## Chart History Cache

- `useHistory` + `usePortfolioHistory` internal queries: `staleTime: Infinity`, `gcTime: Infinity`
- Data cached for entire session — no auto-refetch on tab switch or page navigation
- Force refresh (`useForceRefresh`) calls `qc.removeQueries({ queryKey: ['history'] })` before fetching fresh portfolio data — all chart cache cleared, re-fetched lazily on next Charts tab visit
- **Persistent localStorage cache**: `PersistQueryClientProvider` + `createSyncStoragePersister` in `App.tsx`; scoped to `['history']` queries only (via `dehydrateOptions.shouldDehydrateQuery`); 7-day `maxAge`; restores across app restarts so charts load instantly from prior sessions

---

## Chart Loading Progress UX

### HoldingsPage — Charts tab
- While `usePortfolioHistory` fetches (N symbols in parallel), shows:
  - `"Loading price history… X / Y symbols (Z%)"` — real count from resolved queries
  - Blue progress bar filling from 0% → 100% as symbols resolve (`transition-all duration-300`)
- `usePortfolioHistory` now returns `loadedCount` + `totalCount` alongside `series` + `isLoading`

### TransactionsPage — Charts tab (non-Price metrics)
- Single-symbol fetch → can't do real % (totalCount = 1)
- Shows `"Step 1 / 2 — Fetching price history… 50%"` with a half-filled bar while loading
- Step 2 (useMemo series computation) is synchronous → chart renders immediately after step 1

---

## Known Issues (as of 2026-05-24)

- None.

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
| 2026-05-24 | Analysis tab with Notes | localStorage per portfolio:symbol; add/edit/delete; IST timestamp on each note |
| 2026-05-24 | Today/Total labels on all cards | Subtle 9px slate-400 label before each gain value; consistent across all card types |
| 2026-05-24 | Compact number format for gains | fmtCompact/fmtCompactGainLine: ₹23.4K instead of ₹23,432; avoids long numbers in tight layouts |
| 2026-05-24 | shrink-0 whitespace-nowrap on gain spans | Prevents Today/Total gain labels from wrapping to next line on narrow cards |
| 2026-05-24 | Company name only on HoldingCard | Show subLabel (company) instead of SYMBOL · company; falls back to symbol if no name |
| 2026-05-24 | Bold slate-700 name labels on all cards | Name/label row: font-bold text-slate-700 (was text-slate-400) for visual prominence |
| 2026-05-24 | Stocks/MF tiles layout restructured | 3 rows: label / value+XIRR / Today+Total — prevents overflow in half-width tiles |
| 2026-05-24 | Timestamp + refresh moved to page bottom | Cleaner hero-first view; timestamp sits at footer of PortfoliosPage |
| 2026-05-24 | Phase 5/6 removed from roadmap | Items dropped; no further backlog tracked |
| 2026-05-24 | Stocks/MF tiles changed to full-width stacked | Prevents mobile overflow; matches BreakCard style (9px label, 15px value, same 3-row layout) |
| 2026-05-24 | Pull-to-refresh: blocked native, added custom swipe gesture | Native reload caused full React restart + white screen; custom gesture does data-only refresh |
| 2026-05-24 | Chart loading progress on HoldingsPage | usePortfolioHistory fires N parallel queries; expose loadedCount+totalCount to show real X/Y % bar |
| 2026-05-24 | Chart loading Step 1/2 on TransactionsPage | Single-symbol fetch → no real %; Step 1/2 label at 50% is honest; Step 2 (useMemo) is synchronous so never shown |
| 2026-05-24 | useForceRefresh: removed invalidateQueries | Prevented white screen during refresh by keeping stale data visible |
| 2026-05-24 | Bottom bar sync: right-aligned ↻ + timestamp as one tappable unit | Cleaner than split layout; icon spins until data updates |
| 2026-05-24 | PWA service worker via vite-plugin-pwa | Precaches app shell on first load; instant open, no white screen on reopen; autoUpdate SW on new deploy |
| 2026-05-24 | Persistent chart cache via TanStack Query persister (localStorage, 7-day) | Scoped to ['history'] queries only; chart data survives app restarts; force refresh clears it |
| 2026-05-24 | SummaryCard XIRR layout — row 3 XIRR left / Total right | Matches HoldingCard 3-row layout for visual consistency across all cards |
| 2026-05-24 | TransactionsPage top card: XIRR unstyled, Today/Total labels, fmtCompactGainLine | Font consistency with HoldingsPage; no rogue bold styles |
| 2026-05-24 | PWA auto-reload on SW update (controllerchange listener in App.tsx) | autoUpdate activates new SW silently but doesn't reload page; listener forces reload so Vercel deploys are immediately visible |
