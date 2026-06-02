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
| 2026-05-31 | PortfoliosPage XIRR overflow fix â€” compact BreakCard XIRR chip: `text-[8px]` + `whitespace-nowrap shrink-0`; Stocks/MF tile XIRR span same; prevents text wrapping to new line in grid-cols-2 layout |
