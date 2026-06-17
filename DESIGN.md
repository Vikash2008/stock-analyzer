# DESIGN.md â€” React App Design Reference

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
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ TOTAL PORTFOLIO                      â”‚  â† 9px label
â”‚ â‚¹ CURRENT VALUE    +â‚¹X (+0.8%) todayâ”‚  â† 22px value / 11px today gain+pct
â”‚ +â‚¹X G/L (+X%)            XIRR 18.5%â”‚  â† 11px gain / 9px XIRR
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Stocks / MF Tile (PortfoliosPage, full-width stacked)
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ STOCKS                               â”‚  â† 9px bold uppercase label (matches BreakCard)
â”‚ â‚¹ CURRENT VALUE        Today +â‚¹X    â”‚  â† 15px value / 10px today gain
â”‚ XIRR 18.5%             Total +â‚¹X    â”‚  â† 9px XIRR / 10px total gain
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```
- Full-width stacked (not side-by-side) â€” same width as Hero and BreakCards
- Left border 4px green/red; background tinted
- Label: `text-[9px] font-bold text-slate-700 uppercase tracking-widest` â€” identical to BreakCard
- Value: `text-[15px]` â€” identical to BreakCard
- Today on row 2 right, XIRR + Total on row 3 â€” consistent 3-row layout across all cards

### Breakdown Card (PortfoliosPage)
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ PORTFOLIO NAME (bold, slate-700)     â”‚  â† 9px bold label
â”‚ â‚¹ CURRENT VALUE        Today +â‚¹X    â”‚  â† 15px value / 10px today
â”‚ XIRR 18.5%             Total +â‚¹X    â”‚  â† 9px XIRR / 10px total
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```
- Tappable â€” By Broker â†’ `/holdings/portfolio/:name`; By Type â†’ `/holdings/segment/:key`

### Holding Card (HoldingsPage)
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ COMPANY NAME (bold, slate-700)  LTP â”‚
â”‚ â‚¹ current value      today gain+%   â”‚
â”‚ XIRR %        total G/L (incl. real)â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```
- Tappable â€” navigates to `/transactions/:portfolio/:symbol`
- Shows company name only (no symbol prefix); falls back to symbol if no company name
- XIRR computed client-side per holding (BUY/SELL cashflows + terminal value); shows `â†’` as fallback if null
- Today/Total gain spans have `shrink-0 whitespace-nowrap` â€” never wrap to next line

### Summary Card (top of HoldingsPage / TransactionsPage)
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ LABEL (9px bold uppercase)           â”‚
â”‚ â‚¹ CURRENT VALUE (20px)  Today +â‚¹X  â”‚
â”‚ XIRR %              Total +â‚¹X       â”‚
â”‚ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ â”‚
â”‚ Invested â‚¹X          Realized +â‚¹X  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```
- Row 2: current value (left, 20px bold) + Today gain (right, 10px fmtCompactGainLine)
- Row 3: XIRR (left, 9px, colored) + Total G/L (right, 10px fmtCompactGainLine) â€” matches HoldingCard row 3 layout
- Footer: Invested + Realized (border-top divider); replaceable via `footer` prop (TransactionsPage uses custom footer)

### Charts Tab Header (TransactionsPage)
- Metric pills row has a â†» sync icon flush right (`ml-auto`)
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
- IST timestamp (left) + Refresh (â†») button (right) at **bottom** of page
- Hero card: Total portfolio â€” current value | today gain + today % | total G/L + return % | XIRR
- Stocks tile + MF tile â€” side by side; each shows value, total G/L + %, today gain + %, XIRR
- Breakdown toggle: **By Type (default)** | By Broker
  - By Type: Indian Stocks / US Stocks / Indian MF / US MF cards; XIRR computed client-side per type; navigate to `/holdings/segment/:key`
  - By Broker: one card per real portfolio (SKIP_PORTS excluded); XIRR from `xirr_by_portfolio` bundle field
  - Both views show: current value, total G/L (unrealized + realized), XIRR
- All cards tappable; portfolio cards â†’ `/holdings/portfolio/:name`

### HoldingsPage (`/holdings/portfolio/:name` or `/holdings/segment/:key`)
- Back button (label carries origin context via nav state)
- Summary card (portfolio or segment header)
- One control row (always visible): iOS-style segmented sliders on the same line
  - Left: **Grouped / Each** slider (segment views only) â€” Grouped = one row per symbol aggregated; Each = one row per portfolio:symbol; both show company name as subLabel
  - Right: **Open / Closed / All** slider â€” Open = currently held; Closed = fully exited (derived from `data.realized`); All = both
- Count line updates: `N open`, `M closed`, or `N open Â· M closed`
- Sort control (top-right of list): Current Value | Invested | Daily Gain | Daily Gain % | Total Gain | Total Gain % | XIRR â€” tap again to toggle â†‘/â†“; default Current Value â†“
- List of HoldingCards, tappable; each shows XIRR computed client-side
- Closed holdings (no open position): current=0, Total G/L = realized P&L, XIRR from BUY+SELL cashflows only (no terminal value)
- **3 tabs**: Holdings | Charts | Analysis â€” each tab a colored pill (Holdings=blue, Charts=emerald, Analysis=violet)
- Analysis sub-tabs: Allocation (amber pill) | Benchmarking (sky pill)

### Analysis Tab (HoldingsPage)

Two sub-tabs: **Allocation** and **Benchmarking**

#### Allocation sub-tab
- **No** stacked color bar (removed â€” was visually noisy)
- Collapsible sector rows: sector name | count | alloc% | compact value | alloc bar (colored) | â–¼/â–²
- Expanded holdings: column header row (`Holding | # | Alloc | Value | XIRR | Today`) + one row per unique symbol
  - Deduplication: uses `rows` (buildRows cumulative output) so each symbol appears once even if held in multiple portfolios
  - `#` = count of portfolios holding that symbol
  - `Alloc` = holding's current value as % of total portfolio value
  - `Value` = fmtCompact current value
  - `XIRR` = xirrMap.get(r.key) â€” colored green/red
  - `Today` = todayPct â€” colored green/red
  - All numeric columns: fixed-width (`w-[34px]`, `w-[48px]`, `w-[38px]`), `whitespace-nowrap`, `text-right`

#### Benchmarking sub-tab
- **Overall card** (`bg-slate-50 rounded-lg border border-slate-100`): 3-col grid â€” Your XIRR | Benchmark | Alpha
- **By Sector** collapsible rows â€” same visual language as Allocation:
  - Collapsed: sector name (left, `flex-1 truncate`) | countÂ·benchmark label | `vs X%` bench XIRR | colored XIRR% | â–¼/â–²; then `h-1.5` colored XIRR bar below
  - Expanded rows (no column header): holding name+ticker | `vs X%` bench XIRR | colored XIRR% | spacer; then `h-1` colored mini bar
  - Bar color = `SECTOR_COLOR[sector]`; bar width = `actualXirr / maxXirr * 100%` (maxXirr = max absolute XIRR across all sectors)
  - No alpha column in sector or holding rows
- **Benchmark method (Option B â€” transaction-matched composite)**:
  - For each BUY transaction, simulate buying the sector's benchmark index with the same cash amount
  - Track units held; on SELL, proportionally reduce benchmark units
  - Terminal value = remaining units Ã— current benchmark price
  - Per-holding benchmark XIRR: simulated using ONLY that holding's own transaction dates (makes ITBEES â‰ˆ 0% alpha vs Nifty IT)
  - Sector benchmark XIRR: composite of all holdings in that sector
- **Sector taxonomy** (9 buckets): Banking, Finance (NBFC+Insurance+Capital Markets+AMC), Healthcare, IT (ITBEES+Affle+Tata Digital+Aditya BSL), Growth (Eternal/Swiggy/RateGain/Dynacons/Netweb), Tech (25 US stocks + MON100/MAFANG/S&P500 MF/NASDAQ MF), Smallcap (7 MFs), Equity (DSP ELSS+Mirae ELSS+Parag Parikh), Other
- **Benchmark indices**: Bankingâ†’^NSEBANK, Financeâ†’NIFTY_FIN_SERVICE.NS, Healthcareâ†’^CNXPHARMA, ITâ†’^CNXIT, Growthâ†’^CRSLDX, Techâ†’^NDX, Smallcapâ†’^NSMCAP250, Equity/Otherâ†’^NSEI
- Benchmark data fetched via `useBenchmarkXirr` hook (useQueries in parallel); enabled only when Analysis tab active

### TransactionsPage (`/transactions/:port/:sym`)
- Back button (label = origin page name via nav state)
- Symbol overview card â€” shows company name (or symbol fallback); current value, today gain, G/L, invested, realized
- Tab 1 â€” Transactions: TxRow list, newest first
- Tab 2 â€” Charts: 8 metric pills (Price, Portfolio Value, Invested, Unrealized Gains, Realized Gains, Total Gains, Return %, XIRR Trend)
  - Price pill: PriceChart (price line + BUY/SELL markers) + range selector (1mâ€“All)
  - Other 7 pills: historical line chart scoped to this single holding via usePortfolioHistory + range selector
- Tab 3 â€” Analysis: Notes section
  - Add note textarea + full-width "Add Note" button â†’ saves with IST timestamp, newest first
  - Each note: timestamp (slate-400, 9px) + text (slate-700, 12px) + Edit / Delete actions
  - Edit: inline textarea with Save / Cancel buttons
  - Persisted to localStorage keyed by `notes:${portfolio}:${symbol}`


---

## PWA

- Manifest: `frontend/public/manifest.json`
- Icon: `frontend/public/icon.svg` â€” dark background + green chart line
- `display: "standalone"` â€” opens without browser chrome
- `theme_color: "#0f172a"` â€” status bar matches app background
- Install: Chrome â†’ three-dot menu â†’ "Add to Home screen"
- **Service worker** (`vite-plugin-pwa`, Workbox): precaches all JS/CSS/HTML/SVG/PNG/ICO on first load; subsequent opens serve from cache instantly â€” no white screen
- `registerType: 'autoUpdate'` â€” new deploy auto-updates SW in background
- `skipWaiting: true` + `clientsClaim: true` in Workbox config â€” new SW activates immediately without waiting for tabs to close
- `controllerchange` listener in `App.tsx` â€” when new SW activates, page reloads automatically so users always see the latest JS bundle without manual refresh
- `visibilitychange` listener in `App.tsx` â€” calls `registration.update()` every time the PWA comes to foreground; ensures mobile PWA checks for new SW on resume (not just on navigation)

---

## Mobile Target

- Device: Pixel 10 (Android, Chrome)
- Viewport: 412px wide (logical pixels)
- Touch targets: minimum 44px height
- No horizontal scroll â€” all layouts stack vertically at mobile width
- Font sizes: minimum 12px (labels), standard body 14px

---

## Charts Tab (HoldingsPage)

```
[Portfolio Value][Invested][Unrealized Gains][Realized Gains][Total Gains][Return %][XIRR Trend]
  â† scrollable metric pills (whitespace-nowrap, overflow-x-auto)

+â‚¹45.2L  +â‚¹2.3L in period
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                line chart                â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  1m  3m  6m  1y  2y  3y  5y  All         â”‚  â† segmented control (bg-slate-100, active=bg-white shadow)
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```
- X-axis: `interval = floor(N/5) - 1` â†’ ~5 ticks regardless of range
- Y-axis: `domain=['auto','auto']` â€” scales to data min/max
- XIRR Trend: computed client-side monthly via `utils/xirr.ts` bisection

---

## Card Gain Display Convention

All cards (Hero, Stocks/MF tiles, BreakCards, HoldingCard, SummaryCard) show:
- `Today` label (`text-[9px] text-slate-400`) + daily gain value (`text-[10px]` colored)
- `Total` label (`text-[9px] text-slate-400`) + total gain value (`text-[10px]` colored)
- Gain values use `fmtCompactGainLine` â€” compact format: â‚¹23.4K, â‚¹1.2L, â‚¹2.3Cr (no full number below 1K)
- Hero card gain values are `text-[10px]` matching all other cards

---

## Card Metric Alignment Rules (Recurring â€” Enforce on Every Card)

These rules apply any time a metric (XIRR, Alpha, Today Gain, Current Value, etc.) is placed on a card row. Violations cause columns to misalign or overflow â€” this has happened repeatedly and must be caught before shipping.

### Rules

1. **Fixed columns, not fluid text.** Use CSS Grid or `flex` with explicit `min-w-0` + `shrink-0`. Never let a numeric column's width float with its content.

2. **Cross-row alignment.** When the same metric appears on multiple rows of the same list (e.g. all sector rows, all stock rows), all rows must share the same grid template applied at the *list container* level â€” not per-row. This ensures columns line up vertically.

3. **No wrapping.** Every metric cell must have `whitespace-nowrap`. Use `overflow-hidden text-ellipsis` (or Tailwind `truncate`) on text cells that might be long (company names, sector names).

4. **Right-aligned numerics.** Numeric columns (XIRR %, Alpha, gains) must be `text-right` with a fixed or minimum width (`min-w-[Xch]` or `w-[Xrem]`) so the decimal points and signs align vertically across rows.

5. **Three-level alignment in Analysis â†’ Benchmarking.** Overall card / sector rows (collapsed) / stock rows (expanded) all display XIRR + Alpha. The XIRR and Alpha columns must have the same right-edge offset at each level so the eye can scan the column vertically.

### Implementation Patterns

```tsx
// Sector row (collapsed) â€” fixed-width numeric tail
<div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center">
  <span className="truncate">Sector Name</span>
  <span className="w-[6ch] text-right whitespace-nowrap">XIRR%</span>
  <span className="w-[2ch] text-center text-slate-400">vs</span>
  <span className="w-[5ch] text-right whitespace-nowrap">Î±</span>
</div>

// Expanded stock row â€” same tail widths as sector row
<div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center">
  <span className="truncate">Stock Name Â· TICKER</span>
  <span className="w-[6ch] text-right whitespace-nowrap">XIRR%</span>
  <span className="w-[6ch] text-right text-slate-400 whitespace-nowrap">Bench%</span>
  <span className="w-[5ch] text-right whitespace-nowrap">Î±</span>
</div>
```

### Checklist Before Shipping Any Card Change

- [ ] Does every row use a grid or fixed-flex layout (not raw `flex` with auto-width children)?
- [ ] Is `whitespace-nowrap` on every numeric span?
- [ ] Do the column widths match across all rows of the same list?
- [ ] Tested at 360â€“412px viewport width without horizontal scroll?

---

## Pull-to-Refresh UX (PortfoliosPage)

- Native browser pull-to-refresh blocked via `overscroll-behavior-y: none` on both `html` and `body`
- Custom swipe-down gesture (64px threshold) triggers data-only refresh via `useForceRefresh`
- Pull indicator: "â†“ Pull to refresh" â†’ "â†‘ Release to refresh" â†’ "â†» Refreshingâ€¦" (sky-400)
- `useForceRefresh` no longer calls `invalidateQueries` â€” stale data stays visible during refresh
- Local `refreshing` state controls spin; stops only when backend responds and `data.as_of` updates
- Bottom bar: right-aligned â†» + timestamp as single tappable unit (`py-3` for 44px touch target)

---

## Multi-Portfolio Segment Navigation

When navigating from a segment view (e.g. US Stocks) to a symbol held across multiple portfolios (e.g. Google in Vested + IndMoney US + IndMoney Mummy):
- `buildRows` (HoldingsPage cumulative mode) collects all portfolios for each symbol into `portfolios: string[]` on `CardRow`
- Nav click passes `portfolios` in `location.state`
- `TransactionsPage` reads `portfolioFilter` from state (falls back to `[decoded.portfolio]` for direct/broker navigation)
- `symTxns`, `symRealized`, `holdingList` all filter by `portfolioFilter`
- Overview card aggregates `cur`, `inv`, `tg`, `qty`, `avg` across all portfolios in view
- `holdingXirr` uses per-tx portfolio for fx rate + aggregated terminal value
- MON100/MAFANG (US ETFs in Indian portfolios): single portfolio â†’ `portfolios: ['Zerodha']` â†’ no change in behaviour

---

## HoldingCard Label

Label row shows `TICKER Â· Company Name` (or `TICKER Â· Portfolio` in standalone mode). Falls back to `TICKER` only if no subLabel.

---

## Chart History Cache

- `useHistory` + `usePortfolioHistory` internal queries: `staleTime: Infinity`, `gcTime: Infinity`
- Data cached for entire session â€” no auto-refetch on tab switch or page navigation
- Force refresh (`useForceRefresh`) calls `qc.removeQueries({ queryKey: ['history'] })` before fetching fresh portfolio data â€” all chart cache cleared, re-fetched lazily on next Charts tab visit
- **Persistent localStorage cache**: `PersistQueryClientProvider` + `createSyncStoragePersister` in `App.tsx`; scoped to `['history']` queries only (via `dehydrateOptions.shouldDehydrateQuery`); 7-day `maxAge`; restores across app restarts so charts load instantly from prior sessions

---

## Chart Loading Progress UX

### HoldingsPage â€” Charts tab
- While `usePortfolioHistory` fetches (N symbols in parallel), shows:
  - `"Loading price historyâ€¦ X / Y symbols (Z%)"` â€” real count from resolved queries
  - Blue progress bar filling from 0% â†’ 100% as symbols resolve (`transition-all duration-300`)
- `usePortfolioHistory` now returns `loadedCount` + `totalCount` alongside `series` + `isLoading`

### TransactionsPage â€” Charts tab (non-Price metrics)
- Single-symbol fetch â†’ can't do real % (totalCount = 1)
- Shows `"Step 1 / 2 â€” Fetching price historyâ€¦ 50%"` with a half-filled bar while loading
- Step 2 (useMemo series computation) is synchronous â†’ chart renders immediately after step 1

---

## Known Issues (as of 2026-05-27)

- None.

## TxRow Layout (TransactionsPage)

```
[BUY/SELL/DIV badge â€” pill, centered, whitespace all sides]
  Date             Unreal gains (%) Â· Y sh left     Cur value (Inv value)
  Inv = Xsh Ã— P   Real gains (%) Â· X sh sold        Total gains (%)
```
- 2 rows Ã— 3 columns grid; badge is a separate pill outside the grid
- Card background tinted green (`#f0fdf4`) or red (`#fff1f2`) based on total gain sign; border tinted to match
- R1R: `curValue (invValue)` â€” for SELL: `â‚¹0 (â‚¹0)`
- R2L: `â‚¹12.5K = 10sh Ã— 1250.00`
- Date format: `6 Dec'25` (day Mon'YY)
- Middle cells: qty label anchored left, gain value truncates right â€” no wrapping
- All values use `fmtCompact` to stay within column width

## Local Dev Notes

- Node v24 at `C:\Program Files\nodejs` â€” run `$env:PATH = "C:\Program Files\nodejs;$env:PATH"` if npm not found
- PowerShell execution policy blocks npm.ps1 â€” run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first (session-only, safe)
- If backend 500s with `inf` JSON error: delete `data\.cache.pkl` and restart uvicorn

---


## Design Decisions Log

> Full history: [DESIGN_HISTORY.md](DESIGN_HISTORY.md) — all entries through 2026-06-05

### 2026-06-17 (session 131)

**Overview page — 1D/ALL/XIRR spacing bug fix (follow-up to session 130)**
- Session 130's `{'  '}` (two regular space characters) had no visible effect after shipping — browsers collapse consecutive regular spaces in rendered HTML regardless of how many appear in JSX source, so the requested gap silently disappeared in production
- Fixed by using actual non-breaking spaces (`  `) instead of regular spaces at all 6 spots (BreakCard + hero + Stocks/MF tiles, both the 1D/ALL value gap and the XIRR pill gap) — NBSP is never collapsed by `white-space: normal`, so this renders reliably
- Lesson: literal space characters in `{'...'}` JSX expressions are not a reliable spacing mechanism in this codebase; use NBSP for inline text gaps, or flex `gap-*` when the two parts are already separate elements

### 2026-06-17 (session 130)

**Overview page — XIRR/gain % precision + spacing (BreakCard + hero + Stocks/MF tiles)**
- XIRR now shown to 1 decimal place (was 2) — local `fmtPct1`/inline `.toFixed(1)` added in `PortfoliosPage.tsx` rather than touching the shared `fmtPct`/`fmtCompactGainLine` in `fmt.ts`, since those are also used by TransactionsPage/HoldingCard/SummaryCard/TxRow/ReportTab and the request was scoped to Overview cards only
- 1D/ALL gain percentages also switched to 1 decimal via new local `fmtCompactGainLine1` helper (same scoping reason)
- Added a 2-space gap (`{'  '}`) between the `1D`/`ALL`/`XIRR` labels and their values on all three card types

**Holdings page — Benchmarking pill (Analysis tab)**
- "Overall" stat card redesigned: added left accent border (green/red, matching `BreakCard` style) + an alpha visualization bar underneath the 3 stat columns, matching the per-sector rows below it instead of being a flat box
- Date filter icon: 📅 emoji → funnel SVG (same path used elsewhere in the app's filter UI) for icon-language consistency
- Date filter config panel converted from an inline block (was pushing the sector list down when opened) to an absolutely-positioned overlay popover anchored to the button — same pattern as the Settings and Returns config popovers; narrowed to `w-[190px]`
- Removed the separate "Use today as end date" toggle — the To-month/year selects are now directly editable and default to the current month/year; `benchPeriodEnd` resolves to "today" automatically whenever the selected To-date matches the current month
- Popover border/Apply button kept in the sky theme already used for the Benchmarking pill itself, for color consistency with the rest of that tab

### 2026-06-17 (session 129)

**Overview page XIRR pill re-indent (BreakCard + Stocks/MF tiles)**
- User reported XIRR pill "too much right indented," wanted it starting closer to the value's left edge — re-added `-ml-1.5` to the wrapping `<div className="flex items-center">` on both BreakCard (line ~182) and Stocks/MF tile (line ~1107)
- Note: session 128 had removed a `-ml-1.5`/`-ml-2` negative margin, attributing the alignment issue instead to a missing `flex items-center` wrapper. This session's re-add is a different, explicit user preference (visual indent reduction), not a regression of the session 128 fix — the `flex items-center` wrapper fix is still in place; this just nudges the pill left within it.

### 2026-06-17 (session 128)

**Overview page card redesign (BreakCard + hero + Stocks/MF tiles)**
- XIRR pill indent fixed: removed `-ml-1.5`/`-ml-2` negative margin that pulled it too far left; wrapped in `flex items-center` (the plain `<div>` wrapper had no flex, so its line-box "strut" came from the page's default font/line-height instead of the 9-10px pill content — this, not the negative margin, was the real cause of the XIRR/ALL vertical misalignment that `leading-none` alone didn't fix)
- Vertical spacing: `gap-y-0` → `gap-y-2` between the value/1D row and XIRR/ALL row
- Current value font bumped: BreakCard 13/15px → 15/17px (compact/non-compact); Stocks/MF tiles 13px → 15px
- Card padding `p-2` → `p-2.5`, label margin `mb-1` → `mb-1.5` for less cramped feel
- Non-hero cards (By Type/By Broker/Stocks/MF): "1D"/"ALL" labels + XIRR pill text → 9px (was 10px); `+` sign stripped from XIRR via `.replace(/^\+/, '')` (hero card XIRR keeps the `+` and 10px)
- Page-level `px-4` → `px-2` on Overview/Holdings/Transactions outer wrapper to reduce side white space

**TransactionsPage summary card**
- Inline overview card's Value/1D/XIRR/ALL block converted from `flex justify-between` to the same `grid grid-cols-[auto_1fr] items-center gap-y-0` pattern as `SummaryCard.tsx`, for the same alignment fix

**PWA update banner**
- Added a dismiss "×" button next to "Update" — dismissing just hides the banner (`setUpdateReady(false)`), doesn't reload or skip the already-downloaded update; banner reappears on next visibility check

### 2026-06-17 (session 126)

**Card row alignment fixed — flex-col → CSS Grid**
- Session 125's "guarantees perfect vertical alignment" claim for the 1D/ALL layout was wrong: independent `flex-col` columns size each row to their own tallest child, so the XIRR pill (taller, has padding) and the ALL row (plain text) drifted apart by ~15-20px depending on font size
- Replaced with `grid grid-cols-[auto_1fr] items-center gap-y-0` — row 1 = value + 1D, row 2 = XIRR/fallback + ALL; grid rows are shared across both columns so they align within 1px regardless of content height
- Applies to: `SummaryCard.tsx`, `HoldingCard.tsx`, `PortfoliosPage.tsx` (BreakCard + hero card + Stocks/MF tiles + segment tiles)
- `gap-y-0` chosen over `gap-y-0.5`/`gap-y-1` per user request for compact cards — row heights from content alone already give enough visual separation

**XIRR pill wrapping bug (narrow tiles)**
- In 2-column tiles (Stocks/MF, segment Breakdown cards), the `XIRR +33.29%` pill would wrap to two lines when the percentage had more digits, breaking the grid alignment above it
- Fixed: `whitespace-nowrap` added to the XIRR pill span in both `BreakCard` and the separate Stocks/MF tile block in `PortfoliosPage.tsx`

**Filters toggle pill bug (Status / View segmented controls)**
- Sliding indicator assumed equal-width segments (`w-1/3`/`w-1/2` flex-1), but buttons sized to their own text content ("Closed" wider than "Open"/"All") — indicator drifted and visually covered part of the longer label's text
- Fixed: gave both toggles a fixed container width (`w-[150px]`) + `text-center`/`whitespace-nowrap` on buttons so segments are truly equal

**Settings popover (Holdings page gear icon) — redesigned**
- Action rows (Add New Holdings / Charts / Dividends / Benchmarking analysis) consolidated here; sync icons removed from each tab's own top bar (Charts strip, Dividends tab header, Benchmarking pill row) for a cleaner per-tab UI
- Row background lightened to `bg-emerald-50/60` (was solid `bg-emerald-50`)
- Status + Show Closed merged into one card (single border, internal `border-t` divider) instead of two separate bordered boxes
- "Show Closed" label restyled to match "Status"/"View" pattern (`text-[10px] text-slate-400 uppercase tracking-widest`), kept label-left/toggle-right (not right-indented — tried indenting, reverted per feedback)
- All 4 action buttons made uniform: `w-[70px]`, no icon, single short verb ("Add"/"Refresh"/"Update"); button shows "Syncing…" as text during sync instead of a spin icon
- Datetime moved outside/below the button, centered (`items-center`, not `items-end` — right-aligned looked off-center under a centered button)
- Benchmark XIRR hook (`useBenchmarkXirr`) enabled flag changed from `activeTab === 'analysis' && !!data` to `!!data` — otherwise the new settings-popover refresh button did nothing and the timestamp never appeared until the user had visited the Analysis tab at least once

**TransactionsPage tab bar height**
- "Txns/Charts/Research/Notes" segmented control `py-1` → `py-2` (was too short relative to the rest of the page)

### 2026-06-16 (session 125)

**1D / ALL text pills on all cards**
- Clock SVG (Today) → `1D` text pill; sigma SVG (Total) → `ALL` text pill; color `#065f46` (dark emerald, same as XIRR positive)
- Fixed width `inline-block w-[22px] text-right` on both labels so they column-align across rows
- Restructured card layout: single `flex items-start justify-between` row; left = `flex-col` (currency value + XIRR pill); right = `flex-col items-end` (1D row stacked above ALL row) — guarantees perfect vertical alignment
- Applies to: `HoldingCard.tsx`, `SummaryCard.tsx`, `PortfoliosPage.tsx` (BreakCard + hero card + broker/segment tiles), `TransactionsPage.tsx` (inline summary card)
- Hero card XIRR uses `px-2 -ml-2`; all other cards use `px-1.5 -ml-1.5` to align XIRR text with left content edge

**Positive gain sign removed**
- `fmtCompactGainLine` in `fmt.ts`: `gain >= 0 ? '+' : '−'` → `gain >= 0 ? '' : '−'`
- Positive values now show bare number; negative values still show `−` (en-dash) in red

**Nav bar — final state (session 125)**
- `pt-2` → `pt-4` on both pages (matches overview page top spacing)
- Back icon: SVG chevron (`path d="M15 18l-6-6 6-6"`, strokeWidth 2.5) replaces `‹` character — vertically centres with text
- Back label: `text-[15px] font-bold` (was `text-[10px] font-medium`)
- **HoldingsPage**: `justify-between` — back button (left) + gear icon (right); no centered portfolio title
- **TransactionsPage**: back button only (no gear, no title); `backLabel` strips " Holdings" suffix — shows raw portfolio name
- `getCsvMeta()` cross-checks `portfolio:csv` content exists; shows "Demo Data" if content missing despite meta present

### 2026-06-16 (session 124)

**Nav bar redesign — Holdings + Transactions pages**
- Replaced bare back-button-only bar with iOS-style nav: `‹ Back label` (left) + bold centered title (right spacer balances)
- Back button: `‹` chevron (text-[20px]) + small label (text-[10px]); `min-h-[44px] min-w-[60px]` touch target
- Title: `text-[15px] font-bold text-white truncate flex-1 text-center`
- HoldingsPage title = `label` (portfolio/segment name); TransactionsPage title = `co || decoded.symbol`
- Gear icon bumped `w-6 h-6` → `w-8 h-8` with `active:bg-white/20` hover state

**Explore modal header — full-width green bar**
- Removed `mx-4` inset from header div; changed `rounded-xl` → `rounded-t-2xl` to match modal container corners

**Icon labels — Today / Total / Filters**
- "Today" replaced with 9×9 clock SVG (`viewBox="0 0 12 12"`, circle + hands path)
- "Total" replaced with 9×9 sigma Σ SVG (path traces Σ shape)
- "Filters" section header prefixed with 9×9 funnel SVG
- Text labels removed everywhere; icons only (PortfoliosPage, HoldingCard, SummaryCard, TransactionsPage, HoldingsPage)
- Icon spans: `flex items-center gap-[3px]` wrapper; `style={{flexShrink:0}}` on SVG

**Font size floor — 10px minimum**
- All `text-[8px]` (11 occurrences) and `text-[9px]` (81 occurrences) bumped to `text-[10px]` across 12 files
- Dynamic `lblSize`/`gainSize` in PortfoliosPage BreakCard both resolve to `text-[10px]`

**Transactions page default tab**
- `useState` default changed from `'transactions'` → `'charts'` so Price chart opens first

### 2026-06-06

**Deep Research top bar — model toggle moved into gear, iOS key selector**
- Model toggle (⚡/🌐 Lite/Pro pill) removed from top bar strip; moved into gear popover as first row ("Model" label + pill button)
- API Key selector redesigned from 3 circular `w-7 h-7` numbered pills → iOS segmented control: `bg-slate-100 rounded-full p-0.5` container with `flex-1 rounded-full` segments; active = `bg-white shadow-sm text-slate-700`; inactive = `text-slate-400`; labels "Key 1" / "Key 2" / "Key 3"
- Top bar strip now shows only: [AI Assistant pill] [gear icon] — two items instead of four
- AI Assistant button: kept as text pill (`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full`) — icon-only version was tried and reverted (looked bad)
- Gear popover layout: `flex flex-col gap-2.5`; Model row `flex items-center justify-between gap-4`; API Key section `flex flex-col gap-1.5` with segmented row below label

### 2026-06-12 (session 102)

**Search modal — keyboard-aware positioning**
- Added `inputFocused` state to `PortfoliosPage.tsx`; on input `onFocus` → switches outer flex from `items-center` to `items-start pt-4` so modal pins to top of viewport when mobile keyboard opens
- Max-height expands from `70dvh` → `92dvh` when input is focused (keyboard shrinks viewport; need more of remaining space)
- Suggestions changed from `absolute top-full` dropdown to inline block within the scrollable container (`flex-1 overflow-y-auto`) — fixes suggestions being clipped behind keyboard and only 2 rows showing; now all results visible and scrollable
- "Searching…" indicator also changed from absolute to inline (`mt-1` block), consistent with suggestions

### 2026-06-14 (session 112)

**Closed position LTP — null initial, history patch**
- `HoldingsPage.tsx` `closedRows`: initial `ltp` always `null` (was `priceMap.get(sym) ?? null` from backend holdings, which could return stale/sell-date price); `closedRowsWithLtp` useMemo already patches from `symbolPriceMap` history — that patch is now the sole LTP source
- `TransactionsPage.tsx`: removed `lastSellPrice` fallback from `ltp` computation entirely; `ltp` now `anyHolding?.current_price?.toFixed(2)` OR history last-price from `txPriceMap` (destructured from `usePortfolioHistory`); `usePortfolioHistory` `enabled` changed from `chartMetric !== 'Price' && !!data` → `!!data` so history always loads regardless of chart tab (needed for LTP even on Price tab)
- Dead code removed: `priceMap` + `lastSellMap` inside `closedRows` useMemo (HoldingsPage)

**HoldingsPage scroll restore on back navigation**
- Scrollable container is `<div className="flex-1 overflow-y-auto">` — not `window`; `window.scrollY` was always 0; `window.scrollTo` had no effect
- Fix: `scrollRef = useRef<HTMLDivElement>()` attached to the scrollable div; all 5 save sites use `scrollRef.current?.scrollTop ?? 0`; restore sets `scrollRef.current.scrollTop = y`
- Restore effect fires on `sortedRows.length > 0` (not `data`) so it waits until closed cards are actually in the DOM; double `requestAnimationFrame` ensures browser has painted before setting scrollTop; effect placed after `sortedRows` useMemo (avoids temporal dead zone)

**Price chart cache alignment**
- `PriceChart.tsx` `start` changed `'2000-01-01'` → `'2015-01-01'`; makes `lsKey = ${yf_symbol}:2015-01-01` match what `usePrefetchHoldingCharts` writes → `placeholderData` hits localStorage cache → chart renders instantly
- `useHistory.ts` daily `queryKey` changed from `['history',yf_symbol,start]` → `['history',yf_symbol]` to share React Query in-memory cache with `usePortfolioHistory` (same key); intraday keeps `['history',yf_symbol,'1d']`
- Trade-off: "All" range starts from 2015 (not 2000); pre-2015 history lost

### 2026-06-16 (session 122)

**Add Transaction Modal — design language (`AddTransactionModal.tsx`)**
- New modal for BUY/SELL transactions; entry points: HoldingsPage gear → "Add Holding" and TransactionsPage "+ Txn" button
- Gradient header `bg-gradient-to-r from-emerald-600 to-teal-500`; white body `bg-white`; section cards `bg-emerald-50 rounded-xl border border-emerald-100 p-3`
- Design rule enforced: colored elements *inside* cards (emerald-50), outside body stays white — initial prototype had it inverted (colored bg + white cards); swapped to match app-wide pattern
- Portfolio + Type in one row; Date + Quantity + Price in 3-column grid (`grid grid-cols-3 gap-2`); no "copy to portfolios"; no "Your Holdings" quick-picks
- `lockSymbol` prop: stock shown as read-only badge when opened from TransactionsPage (pre-filled)
- Price pre-fill: checks existing holding `current_price` first, then `/api/quickstats` with spinner; 300ms debounced `/api/search` autocomplete

**Settings panel restructure — PortfoliosPage (`PortfoliosPage.tsx`)**
- `w-72` → `w-80`; rows compacted from `py-2.5` → `py-2`
- **Data section**: Import CSV (moved first), Portfolio file, Demo file
- **Configuration section**: Dividends toggle, FX gains toggle, Currency toggle
- **Updated on footer**: `border-t border-slate-100`; left "Updated on" label; right `v{__APP_VERSION__} · {datetime} IST`
- `__APP_VERSION__` injected via Vite `define` block from `package.json` at build time; `vite-env.d.ts` extended

**HoldingsPage gear popover redesign (`HoldingsPage.tsx`)**
- Gradient header + white body `bg-white p-2`; matches settings modal pattern
- Two labelled sections: "Filters" (Status / Show Closed / View rows) and "Actions" (Add Holding button)
- Section labels: `text-[9px] font-semibold text-emerald-600 uppercase tracking-widest`
- Row cards: `bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-2`; left label `text-[9px] text-slate-400 uppercase`; right pill with `bg-emerald-500` active fill, `text-white`
- `min-w-[270px]` so Status + View fit on one row without wrapping

**Breakdown toggle color — PortfoliosPage (`PortfoliosPage.tsx`)**
- Active breakdown toggle pill: `bg-emerald-500 text-white` (was `bg-white text-slate-700`)

**Gradient nav bar — HoldingsPage + TransactionsPage**
- Pattern: `bg-gradient-to-r from-emerald-600 to-teal-500` applied to inner nav row only via `-mx-4 px-3 py-1.5 mb-3`; outer wrapper stays `bg-white px-4 pt-0`; back-button `text-emerald-100 active:text-white`
- No centered title in nav bar — portfolio/holding name shown on summary card below; redundant in nav
- Gear icon in HoldingsPage nav (`text-emerald-100`); TransactionsPage nav has back button only

### 2026-06-16 (session 123)

**Nav bar — contained width, rounded, white gap above**
- Removed `-mx-4` full-bleed; nav bar now contained within page `px-4` padding — aligns with summary card edges
- Added `rounded-xl` to nav bar div
- Outer wrapper `pt-0` → `pt-2` so there's a small white gap above the nav bar
- Back button: `text-emerald-100` → `font-semibold text-white` for better legibility; no centered title (name already in summary card below)

**HoldingsPage gear popover — compact row cards**
- Row card vertical padding `py-2` → `py-1` on all three rows (Status, Show Closed, View)
- Body gap `gap-2` → `gap-1`; body padding `p-2` → `px-2 py-1.5`
- Pill button inner padding `py-[4px]` → `py-[3px] px-2` for tighter pill feel
- Action button (Add Holding) also `py-2` → `py-1`

### 2026-06-16 (session 121)

**fmtUSD — full numbers in USD mode (`fmt.ts`)**
- `fmtUSD` no longer abbreviates under $1M; `$7.8K` → `$7,821` (comma-formatted); only abbreviates ≥$1M as `$1.23M`
- `fmtCompact` retains K abbreviation for compact card lines (unchanged)

**CSV import — always store INR in query cache (`PortfoliosPage.tsx`)**
- Import POST was sending the live `currency` prop (could be `'USD'`), getting USD-denominated response, then `setQueryData(['portfolio'])` stored USD values in the INR cache
- Hardcoded `currency: 'INR'` in import POST params — `usePortfolio` always subscribes to `['portfolio']` expecting INR; FX conversion is client-side only
- Bug symptom: total portfolio 2.12 Cr displayed as 2.24L (values divided by ~95.5 USD/INR rate)

**Charts tab — sync icon + progress bar (`HoldingsPage.tsx`)**
- Sync button: `invalidateQueries` → `refetchQueries({ type: 'active' })` — old approach set queries stale async so the `useEffect([syncing, histLoading])` cleared the spinner before fetching actually started; new approach sets `fetchStatus='fetching'` immediately so `histLoading` stays true until data arrives
- Progress bar: `h-1` → `h-1.5`; transition `duration-300` → `duration-700` to smooth visual batch jumps; ghost pulse (`opacity-20 animate-pulse` on full bar width) shows activity when count is stuck between batches; spinning `↻` on label so user always sees active loading regardless of counter

**usePortfolioHistory — retry on fetch failure (`usePortfolioHistory.ts`)**
- `retry: 0` → `retry: 2, retryDelay: 8_000` so transient failures (e.g. backend cold start right after CSV import) auto-retry twice with 8s gaps
- `fetchSymHistory` previously caught all errors and returned empty data (success state, blocking retry); now throws on non-OK response so TanStack retry actually fires

### 2026-06-15 (session 120)

**HoldingCard — FX + Dividends layout (`HoldingCard.tsx`)**
- FX and Dividends moved from two separate right-aligned rows into a single right-aligned sub-line under the Total G/L row
- Labels `· FX` and `· DIV` use `text-slate-400` (same muted style as "Today" and "Total" labels for consistency)
- Values use `text-teal-600 font-semibold`; `fmtCompactGainLine` already includes `+` sign — no manual prefix
- Dot prefix on each label (`· FX`, `· DIV`) acts as separator; `gap-1.5` between the two items when both present
- Render: only when `fxAmt > 0 || divAmt > 0`; each item conditional independently

**Settings popover — permanent demo file row (`PortfoliosPage.tsx`)**
- New "Demo file" row added between Portfolio file row and Import CSV row; always visible regardless of uploaded CSV
- Download button calls `window.open(API_URL_SETTINGS + '/api/demo-csv', '_blank')` — always fetches latest demo from backend
- Sub-label: "Sample portfolio · ~1 Cr · 32 stocks" — descriptive context for new users
- Styling mirrors existing Portfolio file row exactly (`bg-white border border-emerald-200 rounded-lg`, `w-8 h-8 bg-slate-200` button)

**SEC EDGAR link fix (both pages)**
- Changed from `CIK=${sym}&type=10-` (direct ticker lookup, fails for new/foreign listings) → `company=${sym}&CIK=&type=` (name/ticker search, no filing-type filter)
- Fixes "No matching Ticker Symbol" for foreign private issuers (20-F filers) and recently listed tickers; tooltip desc updated to "10-K / 20-F & earnings filings"
- Applies to both `ResearchPage.tsx` and `TransactionsPage.tsx`

### 2026-06-14 (session 113)

**DividendsTab — year/month filter and period total**
- Filter bug root cause: was comparing against `s.month_pattern` (historical month numbers from all past dividends) instead of actual `ev.ex_date` months — a stock with a February dividend would always show regardless of which month was selected
- Fix: `visibleSymbols` filters on actual event dates: `ev.ex_date.slice(0,4)` for year, `parseInt(ev.ex_date.slice(5,7), 10)` for month; AND logic (year AND month both must match if both selected)
- Period total: `periodTotal` useMemo computes sum across all `activeSymbols` events (not just visible ones) that match the active year+month filter; shown as teal pill badge in chart header when any filter is active; `null` when no filter active (no badge shown)
- Filter applies to both the chart data AND the symbol table (visibleSymbols drives both)

**Trendlyne URL fix**
- Added `/NSENB/` exchange segment to Trendlyne URLs for Indian stocks: `https://trendlyne.com/equity/NSENB/${sym}/`
- Applies to both `ResearchPage.tsx` and `TransactionsPage.tsx`

### 2026-06-15 (session 119)

**FX tab — per-holding accordion with lot-level table**
- Per Holding section converted from static rows → accordion: tap holding to expand lot-level table
- Table columns: Date · Shares · USD (qty×cost_usd) · Rate (buy_fx_rate INR/USD) · FX Gain per lot
- Column widths: `grid-cols-[90px_40px_52px_44px_1fr]` fixed grid for mobile alignment; `tabular-nums` on all numeric cells
- Date formatted as `fmtDate()` → "14 May '21" (day Mon 'YY); `lot.date.slice(0,10)` guards against ISO timestamps
- Total row at bottom of expanded section: teal-50 background, confirms per-holding sum
- Lots sorted oldest → newest; lot count shown as "N lots" badge in header
- Negative FX gains (header + lot rows + total row) → `text-red-500`; positive → `text-teal-700`
- `expandedHoldings: Set<string>` state added alongside existing `expandedYears`

### 2026-06-13 (session 108)

**Settings modal full redesign (PortfoliosPage gear icon)**
- All rows follow one consistent pattern: left = label (`text-[12px] font-medium text-slate-700`) + subtitle (`text-[11px] text-slate-400`), right = action button / control
- Modal header: `bg-gradient-to-r from-emerald-600 to-teal-500` strip with "Settings" title + × close button; matches page header style
- Modal body: `bg-emerald-50` background; rows wrapped in `p-2 flex flex-col gap-1.5`
- Each row: `bg-white border border-emerald-200 rounded-lg px-3 py-2.5` — visible card with green border outline
- 5 rows: Portfolio file (download icon btn), Import CSV (upload icon btn + slim progress bar), Include dividends (teal toggle), Display currency (pill switcher), About (Updated on datetime)
- Backdrop: `bg-black/40 z-[998]`; modal: `z-[999] w-72`; removed `overflow-hidden` (was clipping row borders at container corners)
- Download button: `bg-slate-200 text-slate-600`; import button: `bg-emerald-200 text-emerald-700`
- Currency toggle active pill: `bg-emerald-600 text-white` (was `bg-white text-emerald-700` — looked unselected); inactive: `text-emerald-500`

**Currency toggle — consistency + persistence**
- `App.tsx`: `currency` state initialises from `localStorage.getItem('currency')` → survives page reload; `handleCurrencyChange` writes to localStorage
- `PortfoliosPage.tsx`: removed single global `scale = 1/usd_inr`; replaced with `usdScale(isUsd)` + `usdCur(isUsd)` helpers applied per-card
- Hero card + Stocks/MF tiles: always `'INR'` — they aggregate mixed currencies so USD conversion is meaningless
- Type breakdown cards: `us_stock`/`us_mf` → USD when toggled; `indian_stock`/`indian_mf` → always INR
- Broker breakdown cards: `USD_PORTS` (Vested/IndMoney US/IndMoney Mummy) → USD when toggled; all other portfolios → always INR
- `usePortfolioHistory.ts`: fixed today-pin bug — `h.disp_current` is always INR from backend; was overriding last chart point with raw INR value while rest of series was in USD → chart Y-axis spiked to ~3 Cr; fix: `const todayFx = currency === 'USD' ? 1 / usdInr : 1` applied to `disp_current` + `disp_invested` before pinning

### 2026-06-10 (session 99)

**Settings popover redesign (PortfoliosPage gear icon)**
- Replaced full-width download button with compact emerald file card: `bg-emerald-50 border border-emerald-100 rounded-xl`; CSV badge (`w-9 h-9 bg-emerald-600` with "CSV" text); filename + size·date on two lines; download = small `w-8 h-8` icon button with `border-emerald-200` on right side of card
- Section labels ("Current File", "Import New File") removed; import button simplified to "Import CSV" with upload SVG icon
- Build version added at bottom: `text-[11px] text-slate-300` formatted as `10 Jun 2026, 14:32 IST`
- Popover width: `w-60` (up from `w-56`); `rounded-2xl` (up from `rounded-xl`)

**PWA update banner — manual + top strip**
- Removed auto-reload after 2.5s (was an intrusive DOM element + setTimeout); removed `main.tsx` controllerchange auto-reload
- New: `updateReady` React state in `App.tsx`; on `controllerchange` sets state → shows persistent top strip banner
- Banner: `fixed top-0 left-0 right-0 bg-emerald-50 border-b border-emerald-200 px-4 py-2`; left: "New version available" (`text-[12px] text-emerald-700`); right: "Update" button (`bg-emerald-100 border-emerald-300 rounded-full`)
- SW update check: runs on visibility change + `setInterval` every 30 min (covers users who never background the app)
- Version shown only in settings popover; no persistent badge in normal UI

**Deep Research gear — 3-way model selector**
- Model toggle changed from binary pill (2.5 Flash ↔ 3.1 Lite) to 3-segment control: `2.5 Flash | 2.5 Lite | 3.1 Lite`
- Layout: `bg-slate-100 rounded-full p-0.5` container; active = `bg-white text-violet-700 shadow-sm`; inactive = `text-slate-400`; `text-[12px] px-2.5 py-1`
- State: `reportUseLite` (bool) + `reportUse31` (bool); `force_31: bool` param added to `GeminiRequest` / `ChatRequest`

**Deep Research — model failure error labels**
- When gemini-2.5-flash fails, returns `gemini25_{reason}` error code with `detail` field (actual exception text)
- Frontend maps codes → labels: quota→"Quota exceeded", timeout→"Timed out", overloaded→"Model overloaded — try 3.1", empty→"Empty response", other→"2.5 Flash unavailable"
- Button shows "Try 2.5 Lite" (purple) instead of generic "Retry" for all gemini25_* errors

### 2026-06-12 (session 103)

**Dividends tab — color scheme and layout**
- 4th tab on HoldingsPage (after Holdings / Charts / Analysis); tab pill: `bg-amber-200 text-amber-800` active, same inactive style as other tabs
- Summary strip: 2×2 grid of amber-50 tiles (Total Earned, Projected/Year) + slate-50 tiles (Stocks paying, Best year)
- TDS warning banner: `bg-orange-50 border-orange-100` with warning SVG; shown when `total_dividends_inr > 5000` (India ₹5K TDS threshold)
- Year chart: Recharts BarChart; current year bar `#f59e0b` (amber-500), prior years `#fcd34d` (amber-300); tooltip `bg-#fffbeb border-#fde68a`
- Month calendar: 12-month horizontal grid; active months `bg-amber-400 text-white`, inactive `bg-slate-100 text-slate-300`; derived from all symbols' month_pattern arrays
- Per-stock rows: exchange badge (NSE=blue, BSE=orange, US=slate); right side: amber-600 total + YoC %; chevron expands to event table
- Event table columns: Ex-date (80px) | Shares | Per share (60px, `$` vs `₹` by currency) | Earned (60px, amber-700)
- `DividendsTab.tsx` — standalone component; `useDividends()` hook drives data; `useForceRefreshDividends()` on refresh icon
- Toggle (include dividends in returns): amber switch in gear popover (`PortfoliosPage.tsx`); dispatches `window.Event('dividends-toggle')` for cross-page sync; persisted in `localStorage('settings.includeDividends')`
- SummaryCard/HoldingCard: `dividends?: number` prop; amber "Dividends +₹X" footer row when prop > 0; included in totalGain computation
- TransactionsPage: collapsible "Dividends received" section; driven by `useDividendForSymbol(symbol)` which reads from query cache

### 2026-06-10

**Explore section — FAB + Bottom Sheet (PortfoliosPage)**
- Removed inline "Explore New Opportunities" section (was `mt-32` below breakdown cards — awkward scroll, duplicate header)
- Replaced with fixed teal FAB (`bottom-6 right-4`, `w-14 h-14`, `rounded-full`, `bg-emerald-500`, search icon SVG)
- Tapping FAB opens bottom sheet: `fixed inset-x-0 bottom-0 z-50`, `rounded-t-2xl`, `65dvh` max height, slide-up `transition-transform duration-300`
- Sheet contains: drag handle nub, gradient header (same `from-emerald-600 to-teal-500`), ✕ close button (`min-h-[44px] min-w-[44px]` for touch target), search input, autocomplete dropdown, "Recent" label + pills
- Backdrop: `fixed inset-0 z-40 bg-black/40`, tap to dismiss
- `navigateToResearch()` calls `setSheetOpen(false)` before `navigate()` so sheet closes on result tap
- Added `pb-24` to the page container so FAB doesn't overlap last card

### 2026-06-12

**Dividends tab redesign — teal color scheme, year/month filter, search, yield badge**
- All amber/orange dividend colors replaced with teal/cyan across 6 files (DividendsTab, HoldingCard, SummaryCard, TransactionsPage, PortfoliosPage, HoldingsPage)
- TDS banner removed from DividendsTab summary strip
- Year filter: clickable Recharts Bar cells; selected bars `#0d9488`, unselected `#cbd5e1` when any selected, all `#5eead4` when no selection; multi-select (`Set<string>`)
- Month filter: 12-grid MonthCalendar; selected=`bg-teal-600 text-white ring-1 ring-teal-400`; active-unselected=`bg-teal-200 text-teal-700`; inactive months disabled with `bg-slate-100 text-slate-300`
- Year+month filters combined with AND; "clear filter" link appears when either active; stock count `(X/Y)` badge when filtered
- Search input with SVG magnifying glass at top of symbol list; `focus:border-teal-300`; case-insensitive match on symbol
- Dividend yield shown as teal pill badge `bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full` on each symbol row; `projected_annual` shown as `~X/yr` in right column
- State reset on portfolio/segment switch via `key={portfolio ?? ''}:${segment ?? ''}` prop on DividendsTab

**Portfolio-scoped dividends**
- `GET /api/dividends?portfolio=X` — backend filters txns to single portfolio in `_compute()` before all share calculations; per-portfolio 24h cache key `dividends:{portfolio}`
- DividendsTab props: `currency`, `portfolio?`, `filterSymbols?`; `useDividends(portfolio)` with TanStack Query key `['dividends', portfolio ?? '']`
- `filterSymbols` only active for segment filter (client-side); portfolio scoping handled entirely by backend
- `useDividendForSymbol` reads from global `['dividends', '']` cache (TransactionsPage use case, no portfolio filter)
- Closed holdings included automatically — backend scopes by portfolio and includes all ex-dates where shares > 0, regardless of current open/closed status

**Currency toggle in gear icon (PortfoliosPage)**
- `[₹ INR] [$ USD]` pill selector added to settings popover (after dividends toggle, before version footer)
- Container: `flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5`; active segment: `bg-white text-slate-700 shadow-sm`; inactive: `text-slate-400 active:text-slate-600`

**Explore search — bottom sheet → centered modal**
- FAB tap now opens a centered modal instead of a bottom sheet
- Container: `fixed inset-0 z-50 flex items-center justify-center px-4`; fade animation (`opacity-0/100 pointer-events-none/auto duration-200`)
- Inner card: `bg-white rounded-2xl shadow-2xl w-full` with `maxWidth: 480, maxHeight: 70dvh`
- Drag handle removed (no longer a bottom sheet); header, search input, autocomplete, recent pills unchanged
- Backdrop (`fixed inset-0 z-40 bg-black/40`) still closes on tap

### 2026-06-09

**File import progress bar — asymptotic easing to 99%**
- Previous: hard cap at 85% via `Math.min(pct + 3, 85)` caused visible freeze while POST was in-flight
- Fix: `pct += (99 - pct) * 0.05` per 180ms tick — asymptotic approach, bar keeps moving, never stalls; jumps to 100% on response

**Toggle/filter state persistence across navigation — localStorage**
- HoldingsPage: `holdingFilter`, `showClosed`, `activeTab`, `viewMode`, `sortField`, `sortDir`, `sectorFilter` persisted under `hp:*` keys
- PortfoliosPage: `mode` (By Type / By Broker) persisted under `pp:mode`
- Pattern: lazy `useState(() => localStorage.getItem(key) ?? default)` + single `useEffect` write-back

**Closed-position summary card gain color fix — TransactionsPage**
- Bug: `gainPos = gain >= 0` used unrealized gain only; for closed positions `cur=0, inv=0 → gain=0 → always green`
- Fix: `gainPos = (gain + realGain) >= 0` — matches the displayed total (`gain + realGain` on line 413)
- Applies to both open positions (unrealized + partial-sell realized) and fully closed positions

### 2026-06-14 (session 117)

**FX Gains feature — toggle + 5th tab**
- Toggle lives in PortfoliosPage gear icon (amber, mirrors dividends teal pattern); dispatches `fxgains-toggle` event; HoldingsPage listens via event listener
- 5th tab "FX" in HoldingsPage shown only when toggle ON (injected into tabs array conditionally); amber-200/amber-800 active class; auto-switches back to 'holdings' if toggle turned OFF while on 'fx' tab
- FX gain formula (per holding): `fx_gain_INR = total_invested_usd × (current_rate − avg_buy_fx_rate)` where `avg_buy_fx_rate` = FIFO-weighted INR/USD rate across remaining open lots
- `buy_fx_rate` read from CSV col 13 (`Purchase Exchange Rate`); `fillna(1.0)` for INR rows; stored in `_Lot.buy_fx_rate` in portfolio.py FIFO engine
- `fx_lots` array in bundle: per-lot open positions for USD portfolios (`{symbol, yf_symbol, portfolio, date, qty, cost_usd, buy_fx_rate}`); `FxGainsTab` derives all 4 sections purely client-side
- XIRR recalculation when FX toggle ON: BUY cash flows use `tx.buy_fx_rate` (actual INR spent at purchase) instead of current `data.usd_inr`; SELL stays at current rate; applies in `xirrMap`, `filteredSummaryXirr` (HoldingsPage) and `stkXirr`, `heroXirr`, `cardXirrMap` (PortfoliosPage)
- `FxGainsTab.tsx` sections: (1) amber-50 summary strip, (2) rate bucket bars grouped by 5-INR bands, (3) year/month collapsible timeline, (4) per-holding table with avg buy rate → current rate + FX gain %
- Color: amber throughout (amber-50 bg, amber-200/700 text/border) — distinct from dividends (teal) and analysis (violet)
