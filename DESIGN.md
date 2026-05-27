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
