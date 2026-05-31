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

### Charts Tab Header (TransactionsPage)
- Metric pills row has a ↻ sync icon flush right (`ml-auto`)
- Only visible when Charts tab is active
- Tapping clears `['history', yf_symbol]` from TanStack Query cache and re-fetches; icon spins for ~1.2s via `animate-spin`

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
- One control row (always visible): iOS-style segmented sliders on the same line
  - Left: **Grouped / Each** slider (segment views only) — Grouped = one row per symbol aggregated; Each = one row per portfolio:symbol; both show company name as subLabel
  - Right: **Open / Closed / All** slider — Open = currently held; Closed = fully exited (derived from `data.realized`); All = both
- Count line updates: `N open`, `M closed`, or `N open · M closed`
- Sort control (top-right of list): Current Value | Invested | Daily Gain | Daily Gain % | Total Gain | Total Gain % | XIRR — tap again to toggle ↑/↓; default Current Value ↓
- List of HoldingCards, tappable; each shows XIRR computed client-side
- Closed holdings (no open position): current=0, Total G/L = realized P&L, XIRR from BUY+SELL cashflows only (no terminal value)
- **3 tabs**: Holdings | Charts | Analysis — each tab a colored pill (Holdings=blue, Charts=emerald, Analysis=violet)
- Analysis sub-tabs: Allocation (amber pill) | Benchmarking (sky pill)

### Analysis Tab (HoldingsPage)

Two sub-tabs: **Allocation** and **Benchmarking**

#### Allocation sub-tab
- **No** stacked color bar (removed — was visually noisy)
- Collapsible sector rows: sector name | count | alloc% | compact value | alloc bar (colored) | ▼/▲
- Expanded holdings: column header row (`Holding | # | Alloc | Value | XIRR | Today`) + one row per unique symbol
  - Deduplication: uses `rows` (buildRows cumulative output) so each symbol appears once even if held in multiple portfolios
  - `#` = count of portfolios holding that symbol
  - `Alloc` = holding's current value as % of total portfolio value
  - `Value` = fmtCompact current value
  - `XIRR` = xirrMap.get(r.key) — colored green/red
  - `Today` = todayPct — colored green/red
  - All numeric columns: fixed-width (`w-[34px]`, `w-[48px]`, `w-[38px]`), `whitespace-nowrap`, `text-right`

#### Benchmarking sub-tab
- **Overall card** (`bg-slate-50 rounded-lg border border-slate-100`): 3-col grid — Your XIRR | Benchmark | Alpha
- **By Sector** collapsible rows — same visual language as Allocation:
  - Collapsed: sector name (left, `flex-1 truncate`) | count·benchmark label | `vs X%` bench XIRR | colored XIRR% | ▼/▲; then `h-1.5` colored XIRR bar below
  - Expanded rows (no column header): holding name+ticker | `vs X%` bench XIRR | colored XIRR% | spacer; then `h-1` colored mini bar
  - Bar color = `SECTOR_COLOR[sector]`; bar width = `actualXirr / maxXirr * 100%` (maxXirr = max absolute XIRR across all sectors)
  - No alpha column in sector or holding rows
- **Benchmark method (Option B — transaction-matched composite)**:
  - For each BUY transaction, simulate buying the sector's benchmark index with the same cash amount
  - Track units held; on SELL, proportionally reduce benchmark units
  - Terminal value = remaining units × current benchmark price
  - Per-holding benchmark XIRR: simulated using ONLY that holding's own transaction dates (makes ITBEES ≈ 0% alpha vs Nifty IT)
  - Sector benchmark XIRR: composite of all holdings in that sector
- **Sector taxonomy** (9 buckets): Banking, Finance (NBFC+Insurance+Capital Markets+AMC), Healthcare, IT (ITBEES+Affle+Tata Digital+Aditya BSL), Growth (Eternal/Swiggy/RateGain/Dynacons/Netweb), Tech (25 US stocks + MON100/MAFANG/S&P500 MF/NASDAQ MF), Smallcap (7 MFs), Equity (DSP ELSS+Mirae ELSS+Parag Parikh), Other
- **Benchmark indices**: Banking→^NSEBANK, Finance→NIFTY_FIN_SERVICE.NS, Healthcare→^CNXPHARMA, IT→^CNXIT, Growth→^CRSLDX, Tech→^NDX, Smallcap→^NSMCAP250, Equity/Other→^NSEI
- Benchmark data fetched via `useBenchmarkXirr` hook (useQueries in parallel); enabled only when Analysis tab active

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
- `skipWaiting: true` + `clientsClaim: true` in Workbox config — new SW activates immediately without waiting for tabs to close
- `controllerchange` listener in `App.tsx` — when new SW activates, page reloads automatically so users always see the latest JS bundle without manual refresh
- `visibilitychange` listener in `App.tsx` — calls `registration.update()` every time the PWA comes to foreground; ensures mobile PWA checks for new SW on resume (not just on navigation)

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

## Card Metric Alignment Rules (Recurring — Enforce on Every Card)

These rules apply any time a metric (XIRR, Alpha, Today Gain, Current Value, etc.) is placed on a card row. Violations cause columns to misalign or overflow — this has happened repeatedly and must be caught before shipping.

### Rules

1. **Fixed columns, not fluid text.** Use CSS Grid or `flex` with explicit `min-w-0` + `shrink-0`. Never let a numeric column's width float with its content.

2. **Cross-row alignment.** When the same metric appears on multiple rows of the same list (e.g. all sector rows, all stock rows), all rows must share the same grid template applied at the *list container* level — not per-row. This ensures columns line up vertically.

3. **No wrapping.** Every metric cell must have `whitespace-nowrap`. Use `overflow-hidden text-ellipsis` (or Tailwind `truncate`) on text cells that might be long (company names, sector names).

4. **Right-aligned numerics.** Numeric columns (XIRR %, Alpha, gains) must be `text-right` with a fixed or minimum width (`min-w-[Xch]` or `w-[Xrem]`) so the decimal points and signs align vertically across rows.

5. **Three-level alignment in Analysis → Benchmarking.** Overall card / sector rows (collapsed) / stock rows (expanded) all display XIRR + Alpha. The XIRR and Alpha columns must have the same right-edge offset at each level so the eye can scan the column vertically.

### Implementation Patterns

```tsx
// Sector row (collapsed) — fixed-width numeric tail
<div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center">
  <span className="truncate">Sector Name</span>
  <span className="w-[6ch] text-right whitespace-nowrap">XIRR%</span>
  <span className="w-[2ch] text-center text-slate-400">vs</span>
  <span className="w-[5ch] text-right whitespace-nowrap">α</span>
</div>

// Expanded stock row — same tail widths as sector row
<div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center">
  <span className="truncate">Stock Name · TICKER</span>
  <span className="w-[6ch] text-right whitespace-nowrap">XIRR%</span>
  <span className="w-[6ch] text-right text-slate-400 whitespace-nowrap">Bench%</span>
  <span className="w-[5ch] text-right whitespace-nowrap">α</span>
</div>
```

### Checklist Before Shipping Any Card Change

- [ ] Does every row use a grid or fixed-flex layout (not raw `flex` with auto-width children)?
- [ ] Is `whitespace-nowrap` on every numeric span?
- [ ] Do the column widths match across all rows of the same list?
- [ ] Tested at 360–412px viewport width without horizontal scroll?

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

## Known Issues (as of 2026-05-27)

- None.

## TxRow Layout (TransactionsPage)

```
[BUY/SELL/DIV badge — pill, centered, whitespace all sides]
  Date             Unreal gains (%) · Y sh left     Cur value (Inv value)
  Inv = Xsh × P   Real gains (%) · X sh sold        Total gains (%)
```
- 2 rows × 3 columns grid; badge is a separate pill outside the grid
- Card background tinted green (`#f0fdf4`) or red (`#fff1f2`) based on total gain sign; border tinted to match
- R1R: `curValue (invValue)` — for SELL: `₹0 (₹0)`
- R2L: `₹12.5K = 10sh × 1250.00`
- Date format: `6 Dec'25` (day Mon'YY)
- Middle cells: qty label anchored left, gain value truncates right — no wrapping
- All values use `fmtCompact` to stay within column width

## Local Dev Notes

- Node v24 at `C:\Program Files\nodejs` — run `$env:PATH = "C:\Program Files\nodejs;$env:PATH"` if npm not found
- PowerShell execution policy blocks npm.ps1 — run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first (session-only, safe)
- If backend 500s with `inf` JSON error: delete `data\.cache.pkl` and restart uvicorn

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
| 2026-05-24 | skipWaiting + clientsClaim in Workbox config | Without these, new SW waits for all tabs to close before activating — on mobile PWA this never happens; now activates immediately on every deploy |
| 2026-05-24 | Sync icon (↻) on Charts tab header in TransactionsPage | Clears per-symbol history cache and re-fetches; spins 1.2s; only visible when Charts tab active |
| 2026-05-27 | visibilitychange SW update check in App.tsx | Mobile PWA resumes from background without triggering navigation; explicit reg.update() on visibilitychange ensures latest code loads on every foreground |
| 2026-05-27 | Keep-alive ping via GitHub Actions | Cron every 14 min hits /health to prevent Render free tier cold start; jitter may occasionally miss 15-min window |
| 2026-05-27 | Realized P&L bug fix for segment views | summaryStats now iterates data.realized directly (with segment classification via getSegmentType) instead of filteredHoldings symbol-by-symbol — fully-exited positions were previously excluded |
| 2026-05-27 | Open/Closed/All toggle on HoldingsPage | Closed positions derived from data.realized (symbols with realized entries but no open holding); shown as HoldingCards with current=0 and XIRR from BUY+SELL cashflows only |
| 2026-05-27 | Grouped/Each + Open/Closed/All on one line as sliders | iOS-style segmented controls (translateX sliding indicator); text-[8px], very compact; replaces separate pill buttons on separate lines |
| 2026-05-27 | Each mode: company name as subLabel | Was showing portfolio (broker) name in standalone mode; now always shows company name |
| 2026-05-24 | Static data/names.json for company names on Render | Render free tier has ephemeral disk — yfinance info calls fail after each deploy; names.json committed to git ensures names always load correctly |
| 2026-05-24 | serializers.py sanitizes inf values | _clean() now handles math.isinf() alongside math.isnan(); all scalar fields and xirr_by_portfolio also wrapped in _clean() |
| 2026-05-27 | Settings gear icon on HoldingsPage | Replaces plain header; opens popover with Open/Closed/All slider, Show Closed toggle (All mode only), Grouped/Standalone slider (segment only) |
| 2026-05-27 | Filter-aware summary card | displayStats + filteredSummaryXirr useMemos update XIRR + realized P&L when Open/Closed/All filter changes; Open realized = All − Closed to ensure Open + Closed = All exactly |
| 2026-05-27 | Show Closed toggle (All mode, display only) | Appends closed rows to sorted open list; no impact on summary stats |
| 2026-05-27 | Sort fix for closed rows | Extracted sortFn applied equally to both open and closed row arrays; closed rows were previously unsorted |
| 2026-05-27 | Scroll save/restore via sessionStorage | HoldingsPage saves window.scrollY on holding card click; restores on back; TransactionsPage always opens at top |
| 2026-05-27 | "Analysis" tab renamed "Notes" on TransactionsPage | Tab type changed from 'analysis' to 'notes'; display label unchanged |
| 2026-05-27 | TxRow redesign with GainGrid | Left: date + qty·price/sh = invested amount; Right: current value (invested) + 3-col CSS Grid (qty/dir | label | gain+pct); minWidth:210 ensures 1fr col aligns across all cards |
| 2026-05-27 | FIFO same-date BUY lot fix | dateQtyAttributed Map distributes qtyRealized sequentially across same-date BUY lots in FIFO order; fixes Axis Bank double-realized bug |
| 2026-05-27 | UI-only fix rule in CLAUDE.md + memory | Trigger: "UI fix" / "UI only" / "quick UI fix" → edit reported file directly, max 2 tool calls, no analysis |
| 2026-05-27 | XIRR fix — closed positions in segment view | closedRows now tracks all portfolios per symbol; xirrMap + filteredSummaryXirr use row.portfolios for closed rows instead of filtPorts (open-only) |
| 2026-05-27 | XIRR fix — "All" filter mode | filteredSummaryXirr computes client-side for all 3 modes; was returning data.xirr_stk for "All" which mixed Indian + US stocks |
| 2026-05-27 | TxRow redesign — 2-row × 3-col layout | Badge pill outside grid; R1: date/unreal/curValue; R2: invested/real/totalGain; green/red card tint; date format 6 Dec'25 |
| 2026-05-27 | HoldingsPage default filter = All, showClosed = false | Landing state shows all positions in summary but hides closed rows in the list by default |
| 2026-05-27 | Charts pre-fetch on page load (no tab gate) | enabled=!!data instead of activeTab==='charts'&&!!data; data ready before user taps Charts tab |
| 2026-05-27 | No loading bar for charts | Removed histLoading progress block from HoldingsPage and TransactionsPage; chart appears silently when ready |
| 2026-05-27 | History cache preserved on force refresh | Removed qc.removeQueries(['history']) from useForceRefresh; chart data survives pull-to-refresh |
| 2026-05-27 | ↻ sync icon added to HoldingsPage Charts tab | Mirrors TransactionsPage behaviour; invalidates all ['history'] queries in background; old chart stays visible |
| 2026-05-27 | TransactionsPage ↻ changed to invalidateQueries | Was removeQueries (blanked chart); now keeps old data visible while silently re-fetching |
| 2026-05-27 | PriceChart X-axis range-aware tickFormatter | Long ranges (2y/3y/5y/All): "Oct '23"; short ranges (1m/3m/6m/1y): "12 Oct"; 1d: "HH:MM" |
| 2026-05-27 | PriceChart 1d intraday range | Fetches 5-min bars via /api/history?period=1d; X-axis shows time; cached 5 min on backend; BUY/SELL markers not shown for intraday |
| 2026-05-27 | Portfolio bundle persisted to localStorage | shouldDehydrateQuery now includes 'portfolio' alongside 'history'; instant reopen after swipe-up — shows stale data immediately, background-refetches silently |
| 2026-05-27 | All charts default range = 1y | PriceChart was 'All'; now '1y' matching HoldingsPage + TransactionsPage |
| 2026-05-27 | Stocks/MF tiles side-by-side | Changed from full-width stacked (space-y-2) to grid grid-cols-2 gap-2; fonts reduced: value 15px→13px, labels 9px→8px, gains 10px→9px |
| 2026-05-27 | BreakCard compact prop | compact=true uses 13px value / 8px labels / 9px gains / gap-0.5 — used in all 2-col grid layouts |
| 2026-05-27 | By Type breakdown grouped sections | TYPE_GROUPS constant; Stocks section (Indian+US) + Mutual Funds section (Indian+US MF); each section has subtle left-line pill + section label + 2-col compact grid |
| 2026-05-27 | By Broker breakdown grouped sections | BROKER_GROUPS constant; Indian Stocks / US Stocks / Mutual Funds sections; same left-line + label + 2-col compact grid layout |
| 2026-05-27 | Breakdown label sizing | "Breakdown" title: 9px font-bold text-slate-500; section labels (Stocks, Indian Stocks, etc.): 7px text-slate-400 non-bold |
| 2026-05-27 | XIRR By Type includes closed positions | cardXirrMap now iterates all data.transactions + classifies by getSegmentType via yfMap lookup; was filtering by holdingKeys (open-only) |
| 2026-05-27 | PriceChart 5d range added | RANGES now includes '5d'; RANGE_DAYS['5d']=7; X-axis shows weekday name "Mon"/"Tue" |
| 2026-05-27 | All chart X-axis tickFormatter per range | HoldingsPage + TransactionsPage: t field changed from pre-formatted locale string to ISO date; tickFormatter: 1m/3m/6m="12 Oct", 1y="Jan", 2y+="Oct '23" |
| 2026-05-27 | 1d intraday timestamps converted to IST | Backend tz_convert('Asia/Kolkata') before strftime; was showing UTC (3:50–9:55 instead of 9:15–3:30) |
| 2026-05-27 | 1d chart % uses prev_close from intraday response | Backend _fetch_intraday now returns prev_close (yesterday's daily close); PriceChart uses (last_bar - prev_close)/prev_close instead of first-bar delta — correctly captures gap-up/gap-down |
| 2026-05-27 | Analysis tab on HoldingsPage — Allocation + Benchmarking | Allocation: stacked bar + sector rows (color, count, %, value). Benchmarking: per-sector XIRR vs benchmark (transaction-matched composite); per-holding benchmark XIRR on own tx dates so index ETFs show ~0% alpha; collapsible sector rows expand to show Stock \| XIRR \| Index \| Alpha |
| 2026-05-27 | Sector taxonomy (sectors.ts) — 9 buckets | Banking, Finance, Healthcare, IT, Growth, Tech (all US), Smallcap (MFs), Equity (ELSS+Parag Parikh), Other; SECTOR_COLOR + SYMBOL_SECTOR + SECTOR_BENCHMARK maps |
| 2026-05-27 | useBenchmarkXirr — per-holding benchmark XIRR | holdingBench Map tracks simulated benchmark cashflows per yf_symbol; holdingBenchXirr map in output allows expanded rows to show per-holding alpha vs own-date-simulated benchmark |
| 2026-05-27 | Allocation sub-tab redesign (session 10) | allocGroupedRows + allocXirrMap always use cumulative (one row per symbol) regardless of viewMode; sector row shows Allocation%/Value/XIRR/Today columns; holding cards are bg-slate-50 rounded with space-y-1.5; columns left-aligned with consistent fixed widths (w-[52px]/w-[48px]/w-[40px]/w-[80px]); ticker removed from holding rows; sector name shows "(X holdings)"; "By Sector" label above; # column removed |
| 2026-05-27 | Today gain inline format in Allocation | Shows "+₹1.2K (+0.5%)" on one line (was two stacked lines); applies to both sector row and holding card rows |
| 2026-05-27 | Market Cap section in Allocation sub-tab | Second collapsible section below By Sector; buckets: Large Cap / Mid Cap / Small Cap / US Stocks (ETF/MF bucket removed); sectors.ts extended with MarketCapKey, MARKET_CAP_COLOR, SYMBOL_MARKET_CAP (all 63 symbols), getMarketCapForHolding(); same column layout as sector section |
| 2026-05-27 | Allocation sub-tab — collapsible By Sector / By Market Cap sections | Each section wrapped in `border border-slate-200 rounded-xl`; section headers are tappable buttons with ▲/▼ chevron; state: sectorSectionOpen + mktCapSectionOpen (both default true); collapses header row + all cards together |
| 2026-05-27 | Market cap bucket reclassification | ETF/MF bucket removed; MarketCapKey now 4 values: Large Cap / Mid Cap / Small Cap / US Stocks; small cap funds + SBI Contra → Small Cap; ITBEES + ELSS funds + digital India funds + Parag Parikh → Large Cap; MON100 + MAFANG + S&P 500 fund + NASDAQ 100 fund → US Stocks; PIIND → Mid Cap; WEALTH → Small Cap; FORTIS + HEALTHY → Large Cap |
| 2026-05-27 | Benchmarking sub-tab — allocation-style redesign | Overall card: bg-green-50/border-green-100, green label, Your XIRR colored green/red; sector list wrapped in bordered collapsible "By Sector" section (border-slate-200 rounded-xl) matching Allocation tab; benchSectorSectionOpen state added |
| 2026-05-27 | Benchmarking column order | Columns: Sector Name \| XIRR \| Index (XIRR) \| Alpha; "Index (XIRR)" is a merged column showing "BENCHMARK_LABEL (benchXirr%)" in one cell (w-[86px] overflow-hidden); Alpha colored green/red |
| 2026-05-27 | Benchmarking — centered alpha bar | Zero-centered bar (h-1.5 sector rows, h-1 holding rows); green extends right for positive alpha, red extends left for negative; width = |alpha| / maxAlpha × 50%; center divider line at 50%; holding rows restructured to div wrapper to accommodate bar below flex row |
| 2026-05-27 | Benchmarking holding rows — per-holding alpha | Alpha computed as hXirr − hBenchX per holding row; shows same benchmark label as parent sector in merged Index (XIRR) cell |
| 2026-05-28 | Allocation accordion sections | By Sector open by default, By Market Cap collapsed; opening one collapses the other (accordion pattern) |
| 2026-05-28 | Solid tab colors on HoldingsPage | Holdings=bg-blue-500, Charts=bg-emerald-500, Analysis=bg-violet-500 (was light bg-*-50); chart metric pills=emerald-500; Allocation=amber-500, Benchmarking=sky-500 |
| 2026-05-28 | Allocation/Benchmarking as metric-pill style buttons | Same scrollable pill pattern as chart metric buttons (border, bg-white inactive / colored active) |
| 2026-05-28 | Sector/MktCap XIRR — pooled cashflows fix | allocSectorXirrMap + allocMktCapXirrMap useMemos compute XIRR from combined cashflows; was weighted average of per-holding XIRRs (mathematically incorrect, gave inflated ~94%) |
| 2026-05-28 | Content border on HoldingsPage tabs | Active tab content wrapped in border border-slate-200 rounded-xl p-3; tab row sits above outside the border |
| 2026-05-28 | Tab content border removed | Outer border removed for all tabs (Holdings, Charts, Analysis) |
| 2026-05-28 | Colored tinted strips below tab row | Charts tab: sky-50/sky-100 strip with metric pills + ↻; Analysis tab: violet-50/violet-100 strip with Allocation/Benchmarking pills; Holdings tab: no strip |
| 2026-05-28 | Chart metric pills — unique colors per metric | METRIC_COLOR map: Portfolio Value=blue-500, Invested=violet-500, Unrealized Gains=teal-500, Realized Gains=amber-500, Total Gains=emerald-500, Return %=sky-500, XIRR Trend=rose-500 |
| 2026-05-28 | Benchmarking overall card — inline label+value | Label and value on same line (flex row); three items (Your XIRR, Benchmark, Alpha) use flex-1 + 8px spacer to align with sector columns below |
| 2026-05-28 | Benchmarking columns redesign | Sector+XIRR merged into one flex-1 cell "Banking (+18.5%)"; "Index (XIRR)" renamed "Benchmark (XIRR)"; all 3 columns equal flex-1; gap reduced to gap-1 |
| 2026-05-28 | Benchmarking section headers colored | "By Sector" in Benchmarking = text-sky-600; "By Sector"=text-blue-600, "By Market Cap"=text-orange-600, "By Holdings Concentration"=text-emerald-600 in Allocation |
| 2026-05-28 | By Holdings Concentration section in Allocation | New accordion section; Top 5/10/20 iOS toggle (default 10); PieChart (Recharts) with PIE_COLORS array; right-side coverage stat "Top X stocks covers Y%"; legend with color dot + name·ticker + value + XIRR in parentheses + alloc%; accordion-linked with By Sector and By Market Cap |
| 2026-05-28 | /get_ready slash command | .claude/commands/get_ready.md — reads 6 boot files in parallel, outputs compact session status (last completed + pending backlog) |
| 2026-05-28 | Critical Rules section in CLAUDE.md | 5 rules: do only what's asked, keep files in context, ask if stuck 30s, use context not files, cache all reads |
| 2026-05-28 | Returns sub-tab on Analysis tab (HoldingsPage) | 3rd Analysis pill (green-500); Sector pills (All + each sector, colored by SECTOR_COLOR); Period toggle (Year / Month iOS slider); Metric toggle (Return % / Gains / XIRR iOS slider); Year selector row (month mode only, auto-resets on sector change); rows = label + colored value + proportional bar; YTD/MTD in slate-400; XIRR = cumulative annualized from first tx to end of that period |
| 2026-05-28 | usePortfolioHistory exposes symbolPriceMap | New return field: Map<yf_symbol, Map<dateStr, price>>; hoisted from series useMemo; enables consumers (Returns tab) to compute per-sector daily value series without extra network calls (cache hits only) |
| 2026-05-28 | Returns sub-tab controls → gear icon popover | Sector pills + iOS sliders replaced by single gear icon (⚙) on summary line extreme right; popover contains Sector list (with color dots), Period slider (Year/Month), Year pills (month mode only), Metric slider |
| 2026-05-28 | Returns sub-tab histogram | Horizontal bar cards replaced by Recharts BarChart; green bars positive, red bars negative, semi-transparent for YTD/MTD; summary line shows total P&L (current−invested+realized) for selected sector above chart |
| 2026-05-28 | Analysis strip → pill buttons matching Charts tab | Segmented slider replaced with colored pill buttons: Allocation=amber-500, Benchmarking=sky-500, Returns=green-500; matches Charts tab metric pill pattern |
| 2026-05-28 | Clarifying-questions rule added to CLAUDE.md | Rule 6 in Critical Rules: ask clarifying questions before complex/data-logic tasks; two failed attempts = mandatory pause; added to Working Style too |
| 2026-05-28 | Returns histogram fixed for "all sectors" — use portSeries.total | Root cause: sectorValueSeries.get('all') only tracked open holdings; closed positions dropped to 0 on sell. Fix: for returnsSector==='all', periodData reads portSeries.total (unrealized + cumulative realized P&L). Gains = total[end]−total[start], no netInvested subtraction needed. Sum of all year bars ≈ current total P&L ≈ 68L. Sector-specific views unchanged (sectorValueSeries — known limitation). |
| 2026-05-29 | classifyClean helper in PortfoliosPage | Replaced portfolio-level realizedForPorts in typeCards/stk tile/mf tile with per-entry classifyClean(portfolio, cleanSymbol). Fixes double-counting of Zerodha realized gains when Zerodha holds MON100/MAFANG (us_stock) alongside Indian stocks. P3/P4/P5/P8 invariants now hold. |
| 2026-05-29 | Total segment realized = 0 bug fixed | segFilter for segment='total' was New Set(['total']) — getSegmentType never returns 'total'. Fixed to ['indian_stock','us_stock','indian_mf','us_mf']. X1 cross-page invariant now holds. |
| 2026-05-29 | Number Correctness Rules added to CLAUDE.md | 21 rules (P1–P8, H1–H6, T1–T3, X1–X7, D1–D5) documented as reference; all verified and passing after this session's fixes. |
| 2026-05-29 | Upstox broker card fix (portfolioCards) | portfolioCards() seeds agg with non-SKIP portfolios found only in rmap (fully closed, no open holdings); fixes 0.47L gap between Stocks tile and By Broker stock cards sum |
| 2026-05-29 | HoldingsPage filtRealized segment fix | For segment views, filtRealized now iterates data.realized directly with SKIP_PORTS+segment filter instead of pre-filtering by filtPorts (open portfolios only); Realized Gains chart endpoint now matches Summary card for all segments including Upstox |
| 2026-05-29 | Return % chart formula corrected (A6) | usePortfolioHistory tracks cumRealCost alongside cumReal; returnPct = totalGain/(invested+realCostVals)×100; was (cur−inv)/inv which ignored realized cost basis — gap was up to −53pp for MF segment |
| 2026-05-29 | testcases.md created | 10 manual test cases: Portfolios page (P-BROKER-1, P-TYPE-1, P-STOCKS-MF) + Holdings Charts tab (H-CHART-A1 through A6, B1, C1, D1) + cross-page invariants (X1–X7); includes expected values, status, known limitations |
| 2026-05-29 | testcases.md exhaustive rewrite | 60+ cases covering Overview (hero, tiles, type, broker, refresh), Holdings tab (summary, filters, grouping, sort, cards), Charts tab, Analysis tab (Allocation x9, Benchmarking x7, Returns x12 including SUMLINE-1 through 5), Transactions page, cross-page invariants, known limitations |
| 2026-05-29 | Returns summary line text format | Year mode: "all sectors · by year" or "Banking · by year"; Month mode: "all sectors · 2026" or "Banking · 2026" — shows vintage of selected period, not a static phrase |
| 2026-05-29 | Returns summary line number = period-specific gains | Year mode: sum of all year bars (total portfolio gains); Month mode: sum of selected year's monthly bars (that year's gains). Was incorrectly showing all-time `allocGroupedRows` total (excluded fully-closed positions). Fixed via `summaryGains = periodData.reduce(s + r.gains, 0)` and `summaryLabel` from mode+year state. |
| 2026-05-29 | Returns default metric changed to Gains | `returnsMetric` initial state changed from 'returnPct' to 'gains'; Gains (INR) is more immediately useful than Return % as a landing view |
| 2026-05-29 | Holdings tab list width matches SummaryCard | Removed `p-3` wrapper div from Holdings tab content; holding cards now flush with page px-4 padding, same width as the summary card above |
| 2026-05-29 | Allocation sector rows — count, merged column, visual tray | `(X holdings)` → `(#X)` saves space for full sector name on mobile; Value + XIRR columns merged into single `w-[90px]` "Value (XIRR)" cell; expanded holdings area uses `bg-slate-50 rounded-b-lg` tray with `bg-white border border-slate-100` holding rows for clear visual separation from next sector; sector card border upgraded to `border-slate-200`, spacing `mb-1`→`mb-2` |
| 2026-05-29 | Closed holdings — TxRow BUY cards | Removed `if (!holding) return null` guard in `txGains`; uses `currentPrice = holding?.current_price ?? 0`; fully-sold BUY lots now return `status:'sold'` with realized gain instead of null | 
| 2026-05-29 | Closed holdings — TxRow sold status r1right | `status:'sold'` branch now sets `r1right = ₹0 (₹0)` matching `status:'realized'` SELL card behaviour |
| 2026-05-29 | Closed holdings — TransactionsPage summary card | `holdingXirr` guard removed `\|\| !holdingList.length` → XIRR computed from BUY+SELL cashflows for closed positions; `anyHolding` fallback finds open holding of same symbol across portfolios for LTP/name/yf_symbol; `lastSellPrice` fallback if completely closed; current value always renders `fmt(cur)` = ₹0; invested shows ₹0 |
| 2026-05-29 | Closed holdings — HoldingCard LTP on HoldingsPage | `closedRows` builds `priceMap` (any open portfolio for same symbol) + `lastSellMap` (latest SELL tx per symbol); `ltp` uses `priceMap.get(sym) ?? lastSellMap.get(sym)?.price ?? null` |
| 2026-05-29 | Returns sub-tab — XIRR metric removed | Metric toggle reduced to 2 options: Return % / Gains; slider indicator width 50%; state type narrowed to `'returnPct' \| 'gains'` |
| 2026-05-29 | Returns sub-tab — ComposedChart with indigo cumulative line | Changed BarChart → ComposedChart; bars = period-specific value (left Y-axis); indigo Line = cumulative return % (right Y-axis, always %, `portSeries.returnPct` series); YTD/MTD bar cumul overridden with live `displayStats` value to match summary tile exactly; dual Y-axis with indigo ticks on right |
| 2026-05-29 | Returns sub-tab — summary line switches by metric | Gains mode: `+₹68.2L · all sectors · by year`; Return % mode: `+37.83% · total return · now` (live from displayStats, not from series) |
| 2026-05-29 | Returns sub-tab — Return % bar = period gain % | `returnPct = period_gains / startPortfolioValue * 100` where startPortV = `portSeries.value[prevEnd]` (open market value) or `portSeries.invested[prevEnd]` fallback; denominator is portfolio market value at start of period, not cumulative invested |
| 2026-05-29 | Chart last point pinned to live prices | `usePortfolioHistory` appends/overrides the last data point using `h.disp_current` + `h.disp_invested` (live prices from bundle) so chart endpoint = summary card exactly. Interior historical points still use EOD closes. Fix eliminates 1–2L gap between Unrealized/Total Gains chart stat and summary card. |
| 2026-05-29 | Benchmarking pill: FX asymmetry for Indian USD-tracking ETFs | MON100/MAFANG (INR ETFs tracking USD index) show alpha = INR depreciation component (~21% for MON100). Correct behaviour — benchmark simulation is pure USD-return comparison; actual XIRR includes FX tailwind. ITBEES (INR→INR) correctly shows ~0% alpha confirming simulation mechanics. Documented in testcases.md AN-BENCH-3. |
| 2026-05-29 | Benchmarking "Others" sector hidden when no open holdings | `benchSectors.filter(s => s.holdingCount > 0)` added before render — sectors with only closed positions (no open holdings) no longer appear in the By Sector list; consistent with Allocation tab which also only shows open positions |
| 2026-05-29 | NIFTYBEES.NS sector reclassified Other (was Equity) | Removes confusing "Equity" sector label from Stocks portfolio benchmarking breakdown; benchmark unchanged (both Equity and Other use ^NSEI) |
| 2026-05-29 | Benchmarking period XIRR — Option B (opening balance at T1) | Replace BUY-filter date logic with proper period XIRR: portfolio value at T1 injected as opening cashflow (actual = `symbolPriceMap` price × qty × fx; bench = `histMap` price × simulated units); cashflows [T1, T2] collected as before; terminal at T2 (live prices if T2=today, else `symbolPriceMap` at T2). Both overall card and sector rows update. `usePortfolioHistory` gains `extraSymbols?` param so closed-symbol historical prices populate `symbolPriceMap`. Hook call moved before `useBenchmarkXirr` in HoldingsPage. `benchTxnsDate` memo replaced with `benchPeriodStart`/`benchPeriodEnd`. |
| 2026-05-29 | INTC, SOUN, FIG added to Tech sector in sectors.ts | Three closed US positions (Intel, SoundHound, Forge Global) were defaulting to Other; now correctly routed to Tech (^NDX benchmark) |
| 2026-05-29 | 40+ historically traded Indian symbols classified in SYMBOL_SECTOR | Root cause of benchmarking alpha discrepancy: ~68 closed positions (Groww/AngelOne/Zerodha history) all defaulted to Other (^NSEI benchmark). Fixed by classifying Banking (HDFCBANK, KOTAKBANK, BANKBEES, BANKBARODA, CANBK, PNB, EQUITASBNK, AUBANK, CSBBANK, CUB, UJJIVANSFB, ESAFSFB, BANDHANBNK, INDUSINDBK), Finance (BAJAJFINSV, MANAPPURAM, M&MFIN, ABSLAMC, 5PAISA, SAMMAANCAP, LICI, POLICYBZR, PAYTM), Healthcare (DIVISLAB, GLAND, ZYDUSLIFE, ZYDUSWELL, AMRUTANJAN), IT (INFY, TCS, KPITTECH, TATAELXSI, HAPPSTMNDS), Equity (NIFTYBEES). Consumer/FMCG stocks left as Other. SYMBOL_MARKET_CAP updated in parallel with correct Large/Mid/Small Cap buckets. |
| 2026-05-29 | debug_benchmark.py — Python benchmark debug script | Replicates useBenchmarkXirr.ts logic; prints per-holding XIRR, closed positions with sector, open-only vs open+closed sector/overall XIRRs side-by-side; useful for future alpha discrepancy debugging |
| 2026-05-29 | Benchmarking holding rows — name truncation + always-visible XIRR | Name span: `text-slate-600 truncate min-w-0`; XIRR span: `shrink-0` colored; both wrapped in `flex items-center gap-1 flex-1 min-w-0` — long fund names no longer push XIRR off-screen |
| 2026-05-29 | benchTxns Upstox fix — fully-closed portfolios included | `benchTxns` extends `filtPorts` with all portfolios from `closedRows`; previously `filtPorts` only covered portfolios with open holdings, so Upstox (fully-closed) was excluded from all benchmarking cashflows |
| 2026-05-29 | Benchmarking date range filter | Collapsible config row at top of Benchmarking pill: shows "📅 All dates" or "📅 Jan 2023 → today" + Active badge; expanded panel has From/To month+year selects, "Use today as end date" iOS toggle, Apply/Clear buttons; `benchTxnsDate` memo filters only BUY transactions to the date window (all SELLs always kept so exits are captured); `txnYears` memo derives available years from data.transactions |
| 2026-05-29 | Consumer sector added to sectors.ts | New SectorKey 'Consumer' (pink-500 #ec4899); benchmark ^CNXFMCG (Nifty FMCG); 15 symbols: HINDUNILVR, ASIANPAINT, DMART, PAGEIND, EMAMILTD, HAVELLS, WHIRLPOOL, BERGEPAINT, MANYAVAR, SYMPHONY, TTKPRESTIG, VGUARD, MARICO, ITC, VOLTAS; these were all closed positions previously defaulting to Other (^NSEI) which gave artificially bad alpha |
| 2026-05-29 | Smallcap benchmark changed ^NSMCAP250 → NIFTY_MIDCAP_100.NS | ^NSMCAP250 and ^CNXMID both return 404 from yfinance; NIFTY_MIDCAP_100.NS confirmed working; used as proxy for DELTACORP, TARSONS, GREENPANEL, ORIENTELEC, PVRINOX (5 closed small-cap positions moved from Other to Smallcap) |
| 2026-05-29 | TECHM.NS added to IT sector | Was defaulting to Other (^NSEI); correctly classified as IT (^CNXIT) |
| 2026-05-29 | debug_benchmark.py — full diagnostic overhaul | Added Upstox to INDIAN_STOCK_PORTS; synced SYMBOL_SECTOR with sectors.ts exactly; added print_unclassified_summary() to show all symbols not in SYMBOL_SECTOR with invested amounts; added Consumer + Smallcap sectors; key finding: overall Indian stocks alpha (open+closed) = +5.0% with final classification |
| 2026-05-29 | debug_benchmark.py excludes US_ETF_SYMS from Indian stocks | Root cause of debug vs UI gap (17.43% vs 13.2% actual XIRR): debug was including MON100/MAFANG (Zerodha US ETFs, classified us_stock by UI) in Indian stocks pool. Fix: add ~txns['yf_symbol'].isin({'MON100.NS','MAFANG.NS'}) filter. UI 3.1% alpha is the correct Indian-stocks-only figure. |
| 2026-05-29 | Stock sector reclassifications in sectors.ts + debug_benchmark.py | LAXMIMACH/INDIAMART/DREAMFOLKS/IRCTC/EASEMYTRIP → Growth (^CRSLDX); TATAINVEST/IBREALEST → Finance (Nifty Fin Svc); NYKAA → Consumer (^CNXFMCG). All were previously unclassified → defaulted to Other/^NSEI benchmark. |
| 2026-05-29 | Benchmarking sector cards match Allocation style | `border border-slate-100 rounded-lg mb-1` → `border border-slate-200 rounded-lg mb-2`; consistent visual language across both sub-tabs |
| 2026-05-29 | Benchmarking sectors sorted by allocation % | `[...benchSectors.filter(s => s.holdingCount > 0)].sort((a, b) => b.currentValue - a.currentValue)` — sectors and holdings within each sector sorted by current value desc |
| 2026-05-29 | Benchmarking Sector(XIRR) column wider | All three levels (header, sector row, holding row) changed from `flex-1` → `flex-[2]` for Sector(XIRR) column; Benchmark(XIRR) and Alpha remain `flex-1` — sector name has more room, Benchmark label shifts right |
| 2026-05-29 | Returns sub-tab: Return % toggle removed | `returnsMetric` state hardcoded to `'gains'`; Metric toggle section removed from gear popover; `fmtV`/`yTickFmtR`/`metricLabel` simplified to gains-only; summary line always shows `+₹X · sector · period` |
| 2026-05-29 | Returns chart full width + cumulative return % line | Right Y-axis hidden (`width=0`, `tick={false}`) so it scales the indigo cumulative line without consuming space; chart margin.right=4; chart fills full container width |
| 2026-05-29 | Returns gear icon inline with summary text | Summary line div uses `gap-2`; value span has `whitespace-nowrap`; label span has `flex-1 min-w-0 truncate` — gear icon stays on same row regardless of text length |
| 2026-05-30 | Global sector added to sectors.ts | New SectorKey `'Global'` (indigo `#6366f1`); benchmark `^GSPC` (S&P 500); `'S&P 500'` added to BENCHMARK_LABEL; 4 US-themed MFs classified: Motilal S&P 500 (moved from Tech), ICICI Pru US Bluechip, Franklin US Feeder, Nippon US Opp |
| 2026-05-30 | 56 new MF symbols classified in sectors.ts | All 70 MF symbols now explicitly classified (0 unclassified); adds Equity (large cap/bluechip/flexicap/ELSS/focused/contra), Smallcap (mid cap + small cap MFs), IT (technology sector MFs), Finance (banking & finance MFs), Healthcare (pharma MF), Global (S&P 500 MFs), Other (debt/liquid/international MFs) |
| 2026-05-30 | SBI Contra reclassified Smallcap → Equity | SBI Contra (`0P0000XVJR.BO`) is a multi-cap contra fund; was incorrectly in Smallcap (Nifty Mid 100 benchmark); moved to Equity (^NSEI) which matches its actual mandate |
| 2026-05-30 | Other sector excluded from Benchmarking pill | `Other` sector hidden from By Sector list (same `holdingCount > 0` filter); also excluded from `overallActual`/`overallBench` cashflow accumulation in `useBenchmarkXirr.ts` (6 spots); fixes -11.62% alpha drag from Axis Liquid (₹15.2L) benchmarked vs Nifty 50 in MF open+closed view |
| 2026-05-30 | Portfolio Manager header on OverviewPage | Emerald-to-teal gradient (`from-emerald-600 to-teal-500`), white title `text-[18px] font-bold`; sync ↻ + IST timestamp right-aligned on same row in `text-emerald-100` (idle) / white (spinning); replaces old bottom-of-page timestamp bar |
| 2026-05-30 | Charts tab: show cached charts on hard refresh | `usePortfolioHistory` removed `isLoading` gate from `symbolPriceMap` and `series`; both computed from whatever queries have data; `isLoading` now includes `isFetching` so sync icon tracks full refetch cycle |
| 2026-05-30 | Charts tab sync icon spins until refetch done | `useEffect` clears `syncing` when `!histLoading`; removed hardcoded 1.2s `setTimeout`; icon keeps spinning through full invalidate+refetch cycle |
| 2026-05-30 | Charts tab: progress bar on first load | Shows `"Loading X / Y symbols Z%"` + sky-400 fill bar when `histLoading && loadedCount < totalCount`; hidden on hard refresh (all cache restored instantly) and during sync refetch |
| 2026-05-30 | Overview refresh banner: 1.5s auto-dismiss | Split `refreshing` into `bannerVisible` (cleared after 1500ms setTimeout) + `refreshing` (cleared when fetch resolves); banner disappears quickly, bottom ↻ icon stays spinning until prices return; banner timer cleaned up on unmount |
| 2026-05-30 | Benchmarking ↻ sync icon on Analysis strip | Added to same row as Allocation/Benchmarking/Returns pills (`shrink-0` flush right); only visible when Benchmarking sub-tab active; `benchSyncing` state; invalidates both `['history']` and `['benchmark-hist']` queryKeys; spins until `benchLoading` goes false via `useEffect` |
| 2026-05-30 | 1d local cache — portfolio bundle staleTime 30min→1d | No auto background-refetch; manual ↻ is the only refresh trigger for live prices; matches user expectation of daily-fresh data |
| 2026-05-30 | benchmark-hist queries persisted to localStorage | Added `benchmark-hist` to `shouldDehydrateQuery` in App.tsx; fixes "Loading benchmark data…" blank screen on every app restart — Benchmarking tab now shows instantly on 2nd+ opens within 1 day |
| 2026-05-30 | localStorage maxAge 7d → 1d | All persisted queries (portfolio + history + benchmark-hist) expire after 1 day; consistent with 1d staleTime |
| 2026-05-30 | Returns tab stale-while-revalidate | Changed `histLoading ?` to `!portSeries && histLoading ?` — shows chart from stale portSeries during sync refetch instead of blank "Loading price history…" text |
| 2026-05-30 | useIsRestoring loader screen in App.tsx | `PersistQueryClientProvider` restores localStorage cache before pages render; without a gate, benchmark queries mounted during restoration see empty cache → `isLoading=true` persists. Fix: `AppRoutes` inner component calls `useIsRestoring()`; renders `LoadingScreen` (slate-900 bg, emerald-to-teal gradient title, spinning ↻) while restoring; pages only mount after cache is fully hydrated — benchmark data found immediately on hard refresh |
| 2026-05-30 | Benchmark sync icon — isFetching exposed | `useBenchmarkXirr` previously only returned `isLoading` (true on initial load only); on ↻ invalidate, queries are `isFetching` but `isLoading=false` → `benchSyncing` cleared instantly, icon never spun. Fix: added `isFetching` to BenchmarkOutput return; `HoldingsPage` destructures `benchFetching`; `useEffect` now waits for `!benchLoading && !benchFetching` before clearing `benchSyncing` |
| 2026-05-31 | Report tab added to TransactionsPage (between Charts and Notes) — Option B: Quick Stats card (yfinance ticker.info) + 6 Perplexity deep-link section cards + Full Report button; tab union `'transactions'\|'charts'\|'report'\|'notes'` |
| 2026-05-31 | Report tab Quick Stats card — P/E (trailing+fwd), MCap (INR crores / USD T/B), Beta, gradient 52W range bar with blue dot, analyst rec badge + target + upside %; all fields nullable; `partial` flag shows notice when yfinance data incomplete |
| 2026-05-31 | Report tab 6 Perplexity section cards — Business Overview, Latest Results & Concall, Growth Catalysts, Key Risks, Industry Outlook, Valuation vs Peers; Indian queries use FY2025/concall framing, US use Q1 2025/earnings; Full Report button fires one comprehensive query |
| 2026-05-31 | Report tab sync — ↻ in tab bar; `invalidateQueries(['quickstats', yf])`; `reportSyncing` state; 1.5s timeout; quickstats persisted to localStorage via shouldDehydrateQuery |
| 2026-05-31 | quickstats backend — `GET /api/quickstats`; 60s in-memory burst + 24h per-symbol disk cache stored as `{SYMBOL:{data,ts}}` under permanent `"quickstats"` cache layer; `_TTL["quickstats"]=None` |
| 2026-05-31 | Sync error feedback on Overview ↻ — `refreshError` state + `errorTimer` ref; shows "Sync failed · retry" in red-300 for 5s on fetch failure; auto-clears | Makes Render cold-start / network failures visible instead of silent spin-stop |
| 2026-05-31 | staleTime+gcTime=Infinity for all queries + localStorage 3 days — portfolio, history, benchmark-hist, quickstats, useHistory (incl. 1d intraday was 5min/10min); maxAge 1d→3d | Zero auto-refresh across entire app; all data manual-↻ only; 3-day offline persistence |
| 2026-05-31 | Loading/Syncing X/Y progress bars on Charts + Benchmarking — HoldingsPage Charts tab: "Loading/Syncing price history… X / Y · Z%" + sky bar on first load AND sync ↻; TransactionsPage Charts tab: same (1 symbol); Benchmarking first load: blocking progress bar replaces "Loading benchmark data…"; Benchmarking sync: non-blocking bar above content | Consistent progress UX across all loading states; "Loading" = cold, "Syncing" = warm refetch |
| 2026-05-31 | usePortfolioHistory exposes fetchingCount — `queries.filter(q => q.fetchStatus === 'fetching').length`; enables sync progress: completedCount = totalCount - fetchingCount |
| 2026-05-31 | useBenchmarkXirr exposes loadedCount/totalCount/fetchingCount — same pattern as usePortfolioHistory; enables Benchmarking progress bar |
