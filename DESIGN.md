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
