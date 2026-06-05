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

> Recent entries only (last 15). Full history in [DESIGN_HISTORY.md](DESIGN_HISTORY.md).

| Date | Decision | Reason |
|------|----------|--------|
| 2026-06-05 | Peer Comparison Matrix extended timeouts — `_heavy = req.section_id in ("peers",)` flag in `/api/gemini`; peers section gets 70s+85s timeouts (1a:thinking / 1b:no-thinking) vs default 45s+55s; needed for niche stocks (Dr Lal PathLabs, etc.) where peer lookup requires more LLM compute time |
| 2026-06-05 | 3rd Gemini API key + 3-pill selector — `GEMINI_KEY_3` added to `_load_keys()` in `gemini.py`; `useKey` type expanded from `0\|1` to `0\|1\|2`; `localStorage('gemini:key_index')` stores '0'/'1'/'2'; gear popover replaced toggle with 3 circular `w-7 h-7 rounded-full` pills labelled 1/2/3 in both TransactionsPage and ResearchPage; `GEMINI_KEY_3` must be added to Render env vars for production |
| 2026-06-05 | Gemini icon on Deep Research cards — resized to 16×16px; fill changed from `text-violet-400 fill="currentColor"` to gradient `#4285f4 → #9334e9` (blue-to-purple) via SVG `<linearGradient id="gg-${section.id}">` — unique ID per card prevents SVG DOM conflicts when multiple cards render the same symbol |
| 2026-06-05 | Collapsible Sources in chat (`DeepResearchChat.tsx`) — `expandedSources: Record<string, boolean>` state; removed always-visible source chip links below grounded messages; added "Sources" button on model name row right side (globe SVG + "Sources" text + chevron ▾/▴); tapping toggles `expandedSources[msgId]`; source list expands below with `border-t border-slate-100` divider; `shrink-0 gap-3` on flex row prevents model name / Sources button overlap |
| 2026-06-05 | AI Assistant empty response fix (3.1 Lite) — two root causes: (1) retry loop used `break` on empty text, returning immediately instead of retrying; (2) `force_lite` prompt instructed model to "Actively use Google Search" but 3.1 Lite has no search tool → API returned tool-call-only response → `_extract_text` returned ""; fix: retry loop changed to for-loop (attempt 0 → sleep 2 → attempt 1); separate `force_lite` prompt for both `/api/gemini` and `/api/gemini/chat` removes all Google Search instruction |
| 2026-06-05 | Deep Research Chat UI redesign — removed global "Ask about [Name]" button (was below all cards, shown when ≥1 card generated); removed per-card 💬 Ask button (was below each expanded card's content); added Gemini sparkle icon (✦, 13px SVG) on LEFT of Refresh/Research/Show Results button on each card's title line — clicking opens chat modal scoped to that card's context; added "AI Assistant" violet-600 pill button (Gemini icon + label, 10px text) on top bar strip LEFT of model toggle in both TransactionsPage and ResearchPage — calls `chatOpenerRef.current?.open()`; removed context selector pill row from DeepResearchChat modal (the "All Cards / Business Overview / etc." line); `selectedContext` still set from `initialContextId` on open, user cannot change it mid-session; `chatOpenerRef` ref pattern: parent holds `MutableRefObject<{open:(contextId?)=>void}\|null>`, child `ReportTab` registers via `useEffect`, parent calls `chatOpenerRef.current?.open()`; modal `w-full max-w-xl` = full-width on 412px Pixel 10 (mobile-friendly, confirmed) |
| 2026-06-05 | Deep Research Chat — bottom sheet modal per stock — `DeepResearchChat.tsx`; fixed inset-0 flex items-end justify-center pointer-events-none wrapper; inner div max-w-xl w-full pointer-events-auto bg-white rounded-t-2xl; height 75dvh; drag handle bar at top; context selector: horizontal scrollable pills (All Cards + one per generated card emoji+label); thread: right-aligned violet bubble for user, left-aligned slate-50 bubble for assistant; react-markdown rendering in assistant bubbles; loading dots (3× animate-bounce, staggered delay); source links below grounded answers (up to 5 domain names, tappable); 🌐 Live badge + model name below assistant message; localStorage persistence per yf_symbol key `gemini:chat:{yf_symbol}` (7-day TTL); per-card 💬 Ask button at bottom of each expanded card; global 💬 Ask about [Name] button below all cards (visible when ≥1 card generated); both open same modal with context pre-selected; context selector resets to trigger source on reopen |
| 2026-06-05 | Deep Research Chat grounding — `/api/gemini/chat` uses same grounding cascade as `/api/gemini` (2.5 Flash + Google Search grounding 1a:thinking 45s / 1b:no-thinking 55s → 3.1 Lite fallback); prompt explicitly instructs model to NOT limit answer to context and to search web for historical/trend data not in context; sources returned and displayed as tappable domain links |
| 2026-06-05 | Sync across navigation — `useForceRefresh` now uses `qc.fetchQuery` (routes through TanStack Query machinery); `isFetching` from `usePortfolio` is `true` during in-flight refresh even after navigation; PortfoliosPage spinner driven by `refreshing \|\| isFetching` so it shows correctly on remount; auto-refresh on mount: `useEffect` with `data?.as_of` dep triggers refresh if cached data is >30 min old |
| 2026-06-05 | ResearchPage (Explore page) QuickStats reliability — `enabled` changed from `activeTab === 'report'` to always `true` (overview card needs `qs` on all tabs); `isPending` replaces `isLoading` for loading prop so Quick Stats tab shows "Loading stats…" throughout entire first-load+retry cycle (not "Stats unavailable" during 15s retry gaps); overview card shows "Stats unavailable" only when all retries exhausted, "Loading…" while retrying |
| 2026-06-05 | CSV upload demo mode — ⚙ settings popover in Portfolio Manager banner (right of ↻ sync); `relative` wrapper on gear button so popover is `absolute top-full right-0 z-10 mt-1 w-56 rounded-xl bg-white shadow-lg border border-slate-100`; `fixed inset-0 z-[9]` invisible overlay for click-outside dismiss (same pattern as TransactionsPage gear); content: CURRENT FILE section (filename·size, import date, or "Demo Data"), ↓ Download button, divider, IMPORT NEW FILE section with 📂 Browse & Import button; progress bar replaces button during import (0%→20%→40%→fake-smooth-85%→100%); panel stays open during import, backdrop click disabled; on completion: "✓ Portfolio updated" for 1.2s then auto-closes; `queryClient.setQueryData` injects response instantly without page reload |
| 2026-06-05 | ZoomChartOverlay landscape fix — overlay now uses `document.documentElement.requestFullscreen()` + `screen.orientation.lock('landscape')` instead of CSS `rotate(90deg)`; CSS rotation broke: (1) chart canvas didn't fill full screen width, (2) touch events stayed in portrait coordinate space so crosshair/pan were non-functional; requestFullscreen required for orientation.lock to work in Chrome browser context (PWA works without it); both wrapped independently so either can fail silently; close button calls `screen.orientation.unlock()` + `document.exitFullscreen()`; overlay container is plain `fixed inset-0 z-[200]` with no rotation |
| 2026-06-04 | ZoomChartOverlay Y-axis left — price scale moved from right to left; `leftPriceScale: { borderColor: '#1e293b', visible: true }`, `rightPriceScale: { visible: false }`, series `priceScaleId: 'left'` |
| 2026-06-04 | Explore Opportunities Go button removed — input is now `w-full` (was in a `flex gap-2` row with the Go button); Enter key and autocomplete tap still navigate; cleaner single-input UX |
| 2026-06-04 | Explore page Charts tab — tab bar now Research \| Charts \| Notes; Charts tab: sky-50 strip with "Price" pill (whitespace-nowrap, natural width) + sky sync ↻ button matching HoldingsPage style exactly; PriceChart wrapped in bg-white rounded-xl shadow-sm border border-slate-100 p-3 card; PriceChart gains hideLegend prop (hides BUY/SELL lines + Legend component) and showZoom prop (shows ⤢ button top-right of stat row) |
| 2026-06-04 | ZoomChartOverlay — new component replacing Recharts in the zoom overlay; uses lightweight-charts v5 (pinch zoom, pan, crosshair with dashed H+V lines + axis price/date labels built-in); toolbar: ✛ Crosshair (default, blue) / ↔ Range (green) mode pills in dark track; Range mode: tap point 1 (status bar shows date + price), tap point 2 → shows +X.XX% and abs move in floating badge + Reset button; all data passed as allChartData (full history, user can zoom to any period) |
| 2026-06-04 | Explore page overview card redesign — CAGR 1Y: text-[14px] font-semibold (larger, right of current price, no ago price shown); bottom row: 52W range (left) + CAGR 5Y (right, text-[10px]); sector label top-right (5Y CAGR moved to bottom); "1Y Returns" renamed to "CAGR 1Y", "5Y CAGR" renamed to "CAGR 5Y" |
| 2026-06-04 | Explore page (ResearchPage /research/:symbol) overview card redesign — company name only (no ticker below; locName → qs.company_name → yf_symbol fallback); right column next to name: sector/industry + 5Y CAGR (no MCap there); price row: price (left, 20px) + 1Y return % and 1Y ago price stacked (right, smaller); 52W range below price; back button color fixed to text-[#2563eb] matching HoldingsPage; max-w-xl mx-auto added for laptop compatibility; ResearchPage officially called "Explore page" |
| 2026-06-04 | Explore New Opportunities — renamed from "Explore New Holdings"; section header replaced with emerald gradient banner matching Portfolio Manager header (from-emerald-600 to-teal-500, rounded-xl, py-1.5, full width); mt-8 gap above banner; search input: bg-green-50 border-green-200 placeholder-emerald-400; autocomplete dropdown: bg-white border-green-200 with green-tinted hover; Go button: bg-emerald-600; recent search pills: bg-green-50 text-emerald-700 border-green-200; onFocus re-shows cached suggestions |
| 2026-06-04 | Explore New Holdings — new section at bottom of PortfoliosPage breakdown; debounced search input (300ms) + Go button; autocomplete dropdown from /api/search (Yahoo Finance proxy, EQUITY+ETF only); recent searches (last 5) as tappable pills (localStorage key `research:recent`); navigates to /research/:symbol with company name in location.state |
| 2026-06-04 | ResearchPage (/research/:symbol) — new page for researching any stock not in portfolio; sticky header with back button + overview card (price, MCap, 52W from quickStats) + 2-tab bar (Research=violet, Notes=rose); Research tab: violet strip with Quick Stats/Deep Research sub-tabs + model toggle + gear (exact same pattern as TransactionsPage); Notes tab: AnalysisTab with portfolio="research" (localStorage key `notes:research:SYMBOL`); reuses ReportTab + AnalysisTab unchanged |
| 2026-06-04 | PWA update toast — on `controllerchange` event (new SW activated), show green pill toast "✓ App updated · Built 4 Jun 16:45" (IST, from __BUILD_TIME__ injected by vite.config.ts) for 2.5s before window.location.reload(); plain DOM element, no React; __BUILD_TIME__ declared in vite-env.d.ts |
| 2026-06-04 | Quick Stats auto-retry — useQuickStats throws on partial:true response so TanStack Query auto-retries 2× with 15s delay; backend no longer caches partial results to disk or memory; fixes Render cold-start "Stats unavailable" UX |
| 2026-06-04 | Deep Research — Gemini 2.5 Flash two-stage retry: attempt 1a = 45s with full thinking + grounding; on timeout, attempt 1b = 55s with `thinking_budget=0` (no thinking); UI loading panel shows "Retrying without extended thinking…" at 45s mark; only falls through to 3.1 Lite if both attempts fail |
| 2026-06-04 | Deep Research — "Retry 2.5" button removed from unavailable state; replaced with plain "Refresh" button that uses whatever model is currently selected in the top-bar config toggle (useLite prop) |
| 2026-06-04 | Deep Research — sources moved inline with headings; bottom sources list removed; h1/h2/h3 headings each get a small ↗ external-link icon mapped sequentially to sources[0], sources[1], etc.; 3.1 Lite results show no icons (no grounding = no sources) |
| 2026-06-04 | Chart zoom — landscape overlay on Charts tab (HoldingsPage + TransactionsPage); zoom icon (⤢) at top-right of chart card (inside white card, `bg-slate-100` button); tapping opens `fixed inset-0 z-[200]` overlay; inner div `width:100dvh height:100dvw transform:rotate(90deg)` simulates landscape without Screen Orientation API (works iOS + Android); dark `#0f172a` bg; reuses `rechartsData`/`metricSeries`; dark-themed LineChart + range selector; TransactionsPage also handles Price metric (PriceChart in white card); ✕ or tap-outside to close |
| 2026-06-04 | XIRR pill consistency — `shrink-0` added to all XIRR pill spans (HoldingCard, SummaryCard, BreakCard) so they never get squeezed right; Stocks/MF tiles on PortfoliosPage now have same `rounded-full px-1.5 py-0.5` pill background as all other cards (was plain colored text); `pillBlue` prop on BreakCard switches positive XIRR to blue (#bfdbfe bg / #1e40af text) for MF cards — applies to MF tile, indian_mf/us_mf type cards, MF_ broker cards |
| 2026-06-04 | PortfoliosPage auto-refresh — `visibilitychange` listener added alongside `setInterval`; triggers refresh when tab/PWA becomes visible after 30+ min hidden; `lastRefreshedAt` ref tracks time of last refresh; both mechanisms update the ref so no double-trigger; fixes mobile PWA background throttling of `setInterval` |
| 2026-06-04 | Deep Research — `_extract_text` fix for gemini-2.5-flash thinking model — function now returns `(text, reason)` tuple; filters `thought=True` parts first (`parts_no_thought` path) then falls back to all parts; `print` log emitted to backend console when 2.5 Flash text extraction fails, showing `extract_reason` and candidate count; prevents silent fallback to 3.1 Lite when thinking parts confuse `.text` property |
| 2026-06-04 | Deep Research — model result toggle (⇄ swap) — `altStates` Record persists previous model's result in memory + localStorage (`:alt` suffix key, 7d TTL); `handleAltSwap` swaps current ↔ alt in both state and localStorage; `handleGenerate` saves current result to alt before overwriting on Refresh; attribution line: single-row `⇄` icon (sky-400, text-[11px]) before model+date text; tapping icon swaps instantly with no API call; no alt = no icon; fallback indicator `⚠ ·` stays inline on same line |
| 2026-06-04 | Deep Research — `requestedLite` field — stored in each `SectionResult` alongside model/savedAt; records whether 2.5 Flash (`false`) or 3.1 Lite (`true`) was requested at fetch time; `fallback = requestedLite === false && model === 'gemini-3.1-flash-lite'` triggers `⚠ ·` amber prefix in attribution; distinguishes intentional 3.1 Lite from 2.5 Flash fallback |
| 2026-06-04 | Deep Research — fallback unavailable UX — `showUnavailable` state per section; clicking ⇄ on a fallback card (⚠) toggles "unavailable" view instead of swapping alt; ⇄ shows even without alt when `fallback===true`; unavailable view: ⚠️ + "Results not available / Please try with other model" placeholder + "Retry 2.5" button; attribution shows `⚠ · 2.5 Flash · unavailable`; ⚠ removed from normal 3.1 Lite attribution (warning only when viewing unavailable, not when 3.1 Lite is working fine) |
| 2026-06-04 | Research tab — model toggle redesigned — replaced two-button track (`[🌐 2.5 Flash][⚡ 3.1 Lite]`) with single tap-to-toggle rounded-full pill; active state shown inline: `🌐 2.5 Pro` (violet-100/violet-700) or `⚡ 3.1 Lite` (slate-100/slate-500); saves horizontal space on 412px mobile; `setReportUseLite(v => !v)` on tap |
| 2026-06-04 | Deep Research card colors — vibrant blue/green palette (all cards bumped from -50 bg → -100 bg, -200 border → -300, -500 accent → -600/-700); business: slate → blue-700; results: sky → teal; financial: teal → emerald; technical: green → blue-600; 4 blue-family + 4 green-family split; accentHex drives 4px left + 2px top border prominence |
| 2026-06-04 | Notes strip — `flex items-center` for vertical centering of "Personal notes" label; text left-aligned (default) |
| 2026-06-01 | Report tab — Screener.in as data source for Indian stocks — `_fetch_screener()` scrapes top-ratios section (PE, P/B, ROCE, ROE, Div Yield, MCap, 52W High/Low); Screener values override yfinance for Indian stocks; yfinance retained as supplemental source for Fwd PE, EPS TTM, Beta, Net Margin, Rev Growth; `_compute_roce()` (Pretax Income / Invested Capital × 100) used for US stocks only since Screener not applicable |
| 2026-06-01 | Report tab — Quick Stats card 3×4 fundamentals grid — replaces old 4-cell row + inline div yield; Row 1 Valuation: PE · Fwd PE · P/B · PEG; Row 2 Returns: ROCE · ROE · ROA · Net Margin; Row 3 Context: EPS TTM · Rev Growth · MCap · Beta; `fmtPct` (v×100), `fmtRatio`, `colorNum` helpers; ROCE displayed as direct % (backend returns percentage value, not fraction); ROE/ROA/Net Margin as decimal fractions via fmtPct; cells use `bg-slate-50 rounded-lg p-1.5`, label `text-[9px]`, value `text-[11px] font-semibold` |
| 2026-06-02 | Report tab — PE History chart — 5Y quarterly PE data from Macrotrends iframe endpoint (`/assets/php/fundamental_iframe.php?t={TICKER}&type=pe-ratio&frequency=Q`); `v1`=price, `v2`=TTM EPS, `v3`=PE; Recharts LineChart 80px tall; dashed ReferenceLine at current PE; Min/Avg/Max row below; US stocks only (`pe_history: null` for Indian) |
| 2026-06-02 | Report tab — Quick Stats grid expanded to 4×4 — Row 1 Valuation: PE/Fwd PE/P-B/D-E; Row 2 Returns: ROCE/ROE/ROA/Net Margin; Row 3 Growth: Rev 1Y/Rev 3Y/EPS 1Y/EPS 3Y; Row 4 Context: EPS TTM/PEG/MCap/Beta; gap reduced to `gap-1.5` |
| 2026-06-02 | Report tab — loading progress bar — thin `h-0.5` sliding blue bar at top of Quick Stats card on first load (`loading=true`) and on sync (`syncing=true`); `@keyframes qs-progress` via inline `<style>` tag; card uses `overflow-hidden` to clip bar to rounded corners |
| 2026-06-02 | Report tab — Revenue Segments SEC EDGAR card removed — parsed garbage numbers; `_fetch_sec_segments()` call removed from quickstats.py; `revenue_segments` field removed from types.ts and ReportTab.tsx |
| 2026-06-02 | Report tab — Perplexity replaced by Gemini 2.5 Flash — 7 section link cards replaced with inline expandable cards; each card has Generate button (idle/error) or ↻ (done); Generate calls POST /api/gemini with google-genai SDK + Google Search grounding; response renders inline via react-markdown + remark-gfm (tables, headers, bullets); localStorage persistence per gemini:{yf_symbol}:{sectionId}; ↻ passes force_refresh=true to bypass 1h backend cache; elapsed timer in loading panel (0–5s: "Querying live sources…", 5–12s: "Reading search results…", 12s+: "Composing answer…"); FORMAT_SUFFIX appended to all prompts instructs Gemini to use markdown tables + bold headers + no preamble |
| 2026-06-02 | Report tab — "Latest Results & Concall" for Indian stocks — now embeds `https://stock-analyzer-2nqw.onrender.com/api/filing/{symbol}/text` at top of Perplexity prompt; backend fetches PDF from BSE, extracts plain text via pdfplumber, serves at stable public URL; Perplexity reads the text URL instead of trying to fetch BSE directly |
| 2026-06-02 | Report tab — Revenue Segments card — new 7th section in SECTIONS array; query asks for segment names, INR crore, % of total, YoY growth %, EBITDA margin %, key KPIs; `site:nsearchives.nseindia.com OR site:bseindia.com` operator for Indian; direct question format (no "find/fetch" language) to avoid Perplexity multi-step fetch loops; PDF reading not possible via Perplexity fetch_url (limitation noted) |
| 2026-06-02 | Report tab — PEG ratio fallback computation — if yfinance returns null (all Indian stocks), compute `PEG = trailing_pe / (earnings_growth × 100)` in `_fetch()` after Screener overlay |
| 2026-06-02 | Report tab — source link + ↻ force-refresh button at top of Quick Stats card — source link = `screener.in/company/{SYM}/` for Indian stocks, `finance.yahoo.com/quote/{SYM}` for US; ↻ button calls backend with `force_refresh=true` (busts 24h disk cache) then `invalidateQueries(['quickstats', yf_symbol])`; `useQueryClient` used directly in ReportTab; button spins via `animate-spin` while refreshing |
| 2026-06-02 | Revenue Segments card (US stocks) — `_fetch_sec_segments()` in quickstats.py; 3-step SEC EDGAR XBRL: ticker → CIK via `sec.gov/files/company_tickers.json` (in-memory cached per process) → latest 10-K accession via `data.sec.gov/submissions/CIK{}.json` → `FilingSummary.xml` keyword match (disaggregation/segment information/segment reporting/geographic/etc.) → R-file HTML table parsed via XBRL viewer class selectors (`ro`/`re` rows, `pl` labels, `num*` values); fallback to generic `<tr>` parsing; scale detection from "in millions/thousands" text; `revenue_segments: {period, items[{name, value_m, pct}]}` field added to QuickStats response + TypeScript type; card rendered between PE History and Analysis sections (US only); rows: segment name (truncate) + `$XB`/`$M` + `XX%` + blue proportional bar; returns null for Indian stocks |
| 2026-06-01 | HoldingsPage Allocation tab rows tappable — By Sector, By Market Cap, and Concentration section rows now navigate to TransactionsPage on tap; changed from `<div>` to `<button>` with same onClick pattern as Benchmarking tab; Concentration "Other" bucket has empty key so navigation is skipped |
| 2026-06-01 | HoldingsPage search/filter strip — single-row strip replaces two-row layout; [🔍 search input] [Sector ▾] [sort ↓] all on one line; count ("X open · Y closed") moved into search input placeholder text (dynamic, reflects Open/Closed/All toggle); sector filter button uses `text-teal-600 font-medium` inactive state matching sort button; search icon uses `text-teal-600`; `visibleRows` memo applies search + sector filter on top of `sortedRows`; `symbolSectorMap` memo maps navSym → SectorKey for both open and closed holdings |
| 2026-06-01 | TxRow 2-column mobile layout — replaced 3-col grid (`1fr 1.3fr 1fr`) with 2-col (`1fr 1.3fr`); left col = Date + Invested, right col = stacked gains (Cur value → Unreal → Real → Total); partial positions get extra rows for realised + total; fixes truncation on 412px screens where each 3-col cell was only ~113px |
| 2026-06-01 | PriceChart BUY/SELL dot size by transaction value — `buildChartData` computes `qty × price` for each trade txn, scales radius linearly r=3 (smallest) → r=10 (largest) across all trades; `buyR`/`sellR` stored on ChartPoint; multiple same-date trades use max value; `BuyDot`/`SellDot` read `payload.buyR`/`payload.sellR` |
| 2026-06-01 | Closed holdings charts — `holdingArrForCharts` useMemo in TransactionsPage builds synthetic `Holding[]` (qty=0, avg_cost from BUYs, yf_symbol from first transaction) when no open position; passed to usePortfolioHistory so all 7 historical metrics render; yf_symbol fallback now uses `symTxns[0].yf_symbol` instead of clean symbol |
| 2026-06-01 | TypeScript cleanup — `BenchmarkOutput` interface gains `loadedCount`/`totalCount`/`fetchingCount`; inner useMemo `Omit<>` extended to exclude `isFetching`; `tsconfig.json` lib `ES2020→ES2022` for `Array.at()` support; zero `tsc --noEmit` errors |
| 2026-06-01 | Boot context reduction — `DESIGN.md` (607→396 lines), `ROADMAP.md` (185→55 lines), `project_react_fastapi.md` (315→82 lines); old entries archived to `DESIGN_HISTORY.md` + `ROADMAP_ARCHIVE.md`; saves ~574 lines per session boot |
| 2026-05-31 | Allocation tab sunburst reverted to accordion â€” `@nivo/sunburst` tooltip crashed with `undefined` datum on center/root hover (TypeError: Cannot read properties of undefined reading 'depth'); reverted to 3-section accordion: By Sector (open default), By Market Cap (collapsed), By Holdings Concentration (collapsed); restored states `expandedAllocSectors`, `expandedMktCapBuckets`, `sectorSectionOpen`, `mktCapSectionOpen`, `concentrationSectionOpen`; removed `allocView`, `selectedAllocSector`, `sunburstSectorData`, `sunburstMktCapData`, `AllocNodeDatum` |
| 2026-05-31 | Allocation accordion 4-column layout â€” matches production design; columns: Sector (dot + name + count) \| Alloc (% + colored bar below) \| Value (XIRR) \| Today (gain + %); 7px uppercase column headers; `sectorData` + `mktCapData` useMemos now include `todayGain` (summed from `h.disp_today_gain`); alloc bar width = `s.pct%` of 52px column; Today shows `â€”` when gain is 0 |
| 2026-05-31 | Allocation tab restored to 1933ab7 baseline â€” reverted all session-48 changes; back to clean accordion with inline `fmtTodayGain` helper, `h-1.5` full-width alloc bar below sector row, `gap-1.5` layout throughout |
| 2026-05-31 | Allocation column header banner â€” `bg-violet-100 rounded-lg mx-1 py-1.5 px-2` full-width strip with `text-violet-700 font-semibold` labels; applied to both By Sector and By Market Cap sections |
| 2026-05-31 | Allocation column alignment â€” Alloc: `text-center`; Value (XIRR): `text-right`; Today: `text-right`; applied consistently to headers, sector data rows, and holding rows in both By Sector and By Market Cap |
| 2026-05-31 | Benchmarking column header banner â€” `bg-green-100 rounded-lg mx-1 py-1.5 px-2` with `text-green-700 font-semibold`; columns: Sector (XIRR) / Benchmark (XIRR) / Alpha |
| 2026-05-31 | Benchmarking date filter moved inline â€” ðŸ“… button now sits flush right on the "By Sector" header row; config panel expands inline inside the card below the header; standalone date filter block above the table removed |
| 2026-05-31 | Returns histogram border card â€” ComposedChart wrapped in `bg-white rounded-xl shadow-sm border border-slate-100 p-3 mt-1`; matches Charts tab chart card style |
| 2026-05-31 | Returns bar value labels â€” `LabelList` with custom SVG `<text>` renderer; shows `+â‚¹12L` / `âˆ’â‚¹3L` in green/red above each bar; only in year mode with â‰¤ 8 bars |
| 2026-05-31 | Returns year selector multi-select â€” `returnsYears: number[]` replaces `returnsYear: number`; gear popover year pills toggle on/off (min 1 always selected); multi-year month view shows months across all selected years with labels `Jan '23`, `Feb '24`; summary line shows range `2023â€“2025` for multi-year |
| 2026-05-31 | ^NDX benchmark fix (backend) â€” `history.py` `_fetch` retries `yf.download` with `auto_adjust=False` when first attempt returns empty; newer yfinance on Render silently returns empty DataFrame for US index symbols with `auto_adjust=True`; Indian indices unaffected |
| 2026-05-31 | Font size bump attempt (reverted) â€” all text below 10px bumped to 10px minimum (column headers 7pxâ†’10px, card labels 9pxâ†’10px, chart axes 8pxâ†’10px); user preferred original compact sizes; reverted in full (git revert e845fd7); original font sizes remain unchanged |
| 2026-05-31 | Charts + Analysis tab horizontal padding removed â€” Charts wrapper `px-3 pt-1 pb-3` â†’ `pt-1 pb-3`; Analysis wrapper `p-3` â†’ `pt-2`; content now flush with page `px-4` edges, matching Holdings tab |
| 2026-05-31 | Font size bump applied selectively â€” minimum 10px re-applied to HoldingsPage, TransactionsPage, HoldingCard, SummaryCard, TxRow, PriceChart, ReportTab; PortfoliosPage kept at original compact sizes (8px/9px labels) â€” half-width grid cards overflow with larger fonts |
| 2026-06-03 | Sticky header on HoldingsPage + TransactionsPage — outer wrapper changed to `h-[100dvh] flex flex-col`; sticky section (`shrink-0 px-4 pt-4 bg-white`) holds: back/settings, summary/overview card, tabs, tab-specific strips (Holdings search strip, Charts metric pills, Analysis sub-tabs, Report sub-tabs, Notes strip); scrollable section (`flex-1 overflow-y-auto px-4 pb-4`) holds only list/chart/research content; applies to all tabs on both pages |
| 2026-06-03 | Gear icon popover click-outside-to-close — added `fixed inset-0 z-[9]` overlay behind the gear popover in TransactionsPage; same pattern as sector/sort dropdowns on HoldingsPage; tapping anywhere outside now dismisses it |
| 2026-06-03 | Quick Stats partial error card — `ReportTab.tsx` condition changed from `qs ?` to `(qs && !qs.partial) ?`; when backend returns `{partial:true}` (yfinance timeout/rate-limit), shows "Stats unavailable / Retry" card instead of grid full of dashes; Retry calls `force_refresh=true` to bust disk cache |
| 2026-06-03 | quickstats.py _TimeoutAdapter removed — yfinance updated API now requires curl_cffi session; passing a `requests.Session` throws `YFDataException`; removed `_TimeoutAdapter` class + `import requests`; `_yf_ticker()` now returns plain `yf.Ticker(symbol)` |
| 2026-06-03 | Deep Research 8-card redesign — 7 SECTIONS → 8; cards: Business Overview/Moat (slate) · Industry Outlook/Macro (blue) · Latest Earnings/Guidance (sky) · Valuation Metrics (indigo) · Peer Comparison Matrix (cyan) · Financial Health/Trends (teal) · News/Sentiment/Red Flags (emerald) · Technical Analysis Setup (green); each card uses inline style `borderLeftWidth:4 borderTopWidth:2 borderLeftColor/borderTopColor:accentHex` matching SummaryCard pattern (strong left accent); card bg is light 50-shade fill; header right: "Research" (idle outline) / "Show Results" (done solid, expands) / "Refresh" (done solid when expanded, triggers force-refresh) button + tiny `text-[8px]` attribution text "Results fetched by 2.5 Flash on D Mon HH:MM" below button (done state only); footer legend removed; bottom sync link removed; `fmtSavedAt` updated to include HH:MM time; `fmtModelName` helper added |
| 2026-06-03 | Research tab button color distinction — Quick Stats inactive state changed to `bg-emerald-100 text-emerald-700 border-emerald-200` (emerald tones) to visually distinguish it from Deep Research which uses violet; previously both were bg-violet-200 |
| 2026-06-03 | 30-min auto-refresh fix — `refetchInterval` removed from `usePortfolio` hook (it called backend without force_refresh, backend returned disk-cached prices with same as_of); replaced with `setInterval` in PortfoliosPage every 30 min that calls `handleRefresh()` via a ref to avoid stale closure; `handleRefresh` uses `forceRefresh()` → `fetchPortfolio(currency, true)` guaranteeing fresh yfinance prices and updated timestamp |
| 2026-06-03 | Inactive pill borders + backgrounds — all strip pill bars (Charts metric pills on HoldingsPage + TransactionsPage, Research sub-tabs Quick Stats/Deep Research, model toggle 2.5 Flash/3.1 Lite, Analysis sub-tabs Allocation/Benchmarking/Returns): inactive state gains `border border-[color]-200` (visible outline) + `bg-[color]-100` fill (light tinted bg) so pill shape is always readable against the strip; active state unchanged (solid filled color + white text) |
| 2026-06-03 | Gemini API keys moved to env vars — `GEMINI_KEY_MAIN` / `GEMINI_KEY_BACKUP` read via `os.environ.get()` at request time; `_load_keys()` replaces `_KEYS` list; local `.env` provides values for dev; Render env vars required for production; git history rewritten (squash) to remove keys from all commits |
| 2026-06-03 | Tab button design unified — both HoldingsPage and TransactionsPage: active tabs darkened to 200-shade (teal-200/sky-200/violet-200 + matching 800 text); Notes tab amber→rose-200; Charts strip fixed to sky-50/sky-200 regardless of selected metric; inner bar buttons (metric pills, sub-tab pills, model toggle) gain `border border-[color]` active / `border border-transparent` inactive; Realized Gains pill color amber→pink (bg-pink-600, line #ec4899); sync button in Charts strip fixed to sky gradient |
| 2026-06-03 | quickstats.py reliability — `_TimeoutAdapter` (10s per-call timeout via HTTPAdapter.send) passed to all yfinance HTTP calls via `_yf_ticker()`; `get_quickstats` wrapped in top-level try/except returning `{"partial": True}` on unhandled error; disk cache read/write wrapped separately; prevents 503 from Render 30s kill on slow yfinance/Screener.in calls |
| 2026-06-03 | Quick Stats "Stats unavailable" fix — `isFetching: qsFetching` added to useQuickStats destructure in TransactionsPage; `loading={qsLoading || qsFetching}` passed to ReportTab so loading spinner persists through retry wait gap (not just during active fetch) |
| 2026-06-03 | Report tab — Deep Research / Quick Stats sub-tabs — violet Report strip in TransactionsPage replaced with full sub-tab bar (`bg-violet-50 border-violet-100`); left: `[Deep Research \| Quick Stats]` pill toggle (`bg-violet-100` track, `bg-white text-violet-700` active pill); right: model toggle + gear when Deep Research active, ↻ sync when Quick Stats active; `reportTab`/`useLite`/`useKey`/`gearOpen` states lifted to TransactionsPage; passed as props to ReportTab |
| 2026-06-03 | Report tab — API key toggle — gear icon (SVG) in strip right side (Deep Research only); tap opens absolute popover (`right-0 top-full z-10 shadow-lg`); iOS toggle switch (`h-6 w-11 rounded-full`, grey/blue track, white thumb slides); label "Backup Key"; no dot indicator on gear; toggle OFF = Main (`_KEYS[0]`), toggle ON = Backup (`_KEYS[1]`); persisted in localStorage `gemini:key_index` |
| 2026-06-03 | Report tab — `_read_api_key` simplified to use `_KEYS[index]` directly — removed env var/.env lookup that was reading backup key from local `.env`; both keys hardcoded in `_KEYS` list in gemini.py; no env var override needed |
| 2026-06-03 | Report tab — API key toggle (pending) — Main/Backup pill toggle in Analysis header; `key_index` sent in POST body; backend picks from hardcoded `_KEYS` list; persisted in localStorage |
| 2026-06-03 | Report tab — model toggle (2.5 Flash / 3.1 Lite) — iOS pill toggle in Analysis header; `useLite` state; `force_lite` sent in POST body; backend skips attempt 1 when true; cache key includes force_lite; selection persists in localStorage per toggle (existing results unchanged until ↻) |
| 2026-06-03 | Report tab — card header shows model used — `🌐 2.5 Flash` (blue) or `⚡ 3.1 Lite` (grey) + date replaces dot + "Updated"; `model` field in GeminiResponse + SectionState + localStorage; determines which icon/label to show |
| 2026-06-03 | Report tab — accordion + auto-expand — generating a card auto-expands it and collapses all others; tapping chevron also collapses all others before expanding the tapped one; accordion enforced via full reset of expandedSections state |
| 2026-06-03 | Report tab — footer legend — two rows below last card: 🟢 Gemini 2.5 Flash + Google Search (live data) · ⚪ Gemini 3.1 Flash Lite (training data · fallback when search quota exhausted) |
| 2026-06-03 | Research tab (renamed from Report tab) — Quick Stats is default sub-tab; sub-tab buttons: Quick Stats=emerald-500 active, Deep Research=violet-600 active; both `rounded-md font-medium` solid active / text-only inactive inside `bg-violet-100` track |
| 2026-06-03 | Quick Stats emerald design language — card `border-emerald-200` + 3px gradient top strip; grid cells `bg-emerald-50` with `text-emerald-600/70` labels; 52W range label/dot/current-price in emerald; all dividers `border-emerald-100`; loading/sync progress bar `bg-emerald-500`; footer: Screener.in sky pill (left), Analyst Ratings emerald pill → Yahoo Finance `/analysis/` (right); Refresh button removed from footer |
| 2026-06-03 | Pill style unified across all strip controls — `rounded-md font-medium`, solid color active (white text, shadow-sm), text-only transparent inactive; pills sit inside tinted track container (`rounded-lg p-0.5`); applied to: TransactionsPage Charts strip, HoldingsPage Charts strip, HoldingsPage Analysis strip (Allocation=orange-500, Benchmarking=sky-500, Returns=emerald-500) |
| 2026-06-03 | HoldingsPage METRIC_STYLE refactored — active: solid color (no gradient), inactive: text-only (no bg/border); added `trackBg` hex field for per-metric track background tint |
| 2026-06-03 | `normalizeRec()` + `recColor()` — yfinance `"none"` recommendationKey displayed as "Neutral" (slate color `#64748b`) in Quick Stats analyst row; handled both frontend (cached data) and backend (new fetches) |
| 2026-06-03 | Report tab — gemini.py fallback improved — attempt 1: gemini-2.5-flash with grounding (confirmed working, ~20 RPD free); attempt 2: gemini-3.1-flash-lite plain (500 RPD); `_is_fatal_error` replaces `_is_grounding_error` — any non-auth error (503, 429, timeout) falls through to attempt 2; attempt 2 retries once after 3s sleep on transient error |
| 2026-06-02 | Report tab — Gemini model: `gemini-3.1-flash-lite` (500 RPD, 15 RPM free tier); Google Search grounding removed (grounding quota is account-level, exhausts across projects; Gemini 3.x has 0/0 grounding quota on free tier); cards now use training data only; grounding can be re-enabled when billing is set up; `.env` key read at request time (not module load) so key rotations take effect without restart |
| 2026-06-02 | Report tab — Gemini cards collapsible by default — chevron `▶`/`▼` on far left of header; collapsed = header only; tapping left side toggles; state resets on symbol switch; `expandedSections: Record<string, boolean>` state |
| 2026-06-02 | Report tab — card header layout — left: `▶/▼` (fixed `w-3`) + emoji + title/description; right: "Updated DD Mon + ↻" when done, "Generate/Retry" when not; `savedAt` stored in SectionState + localStorage; `fmtSavedAt()` helper |
| 2026-06-02 | Report tab — 7-day localStorage cache — `savedAt: Date.now()` written alongside text/sources; on load, entries older than `7 * 24 * 3600 * 1000` ms discarded and removed; `setExpandedSections({})` on symbol switch |
| 2026-06-02 | Report tab — error reason display — `SectionState` type changed to `{ error: string }` (was `'error'` string literal); catch captures `err.message`; shown as `text-[9px] text-red-400 max-w-[130px]` below Retry button |
| 2026-06-02 | Report tab — markdown heading sizes — h1: `text-[15px]` bold; h2: `text-[13px]` bold; h3: `text-[12px]` semibold slate-600; body `text-[11px]`; previously all near-identical causing visual flatness |
| 2026-06-02 | Report tab — bullet alignment — reverted to `list-outside pl-5` (was changed to `list-inside`); `list-outside` wraps long lines under text not marker; `li` gets `pl-0.5` for spacing |
| 2026-06-02 | Report tab — table fix — removed `w-full` from table (was forcing 412px squeeze); `td` gets `whitespace-nowrap align-top`; `overflow-x-auto` wrapper unchanged; columns now size to content and scroll horizontally |
| 2026-05-31 | PortfoliosPage XIRR overflow fix â€” compact BreakCard XIRR chip: `text-[8px]` + `whitespace-nowrap shrink-0`; Stocks/MF tile XIRR span same; prevents text wrapping to new line in grid-cols-2 layout |
