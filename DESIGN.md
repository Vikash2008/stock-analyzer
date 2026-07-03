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

> Keep only the 3 most recent sessions here (size guard, same pattern as ROADMAP_ARCHIVE.md). Full history: [DESIGN_HISTORY.md](DESIGN_HISTORY.md) — all entries through 2026-07-02 (session 161)

### 2026-07-02 (session 163)

**Transactions page unified to Holdings' teal design language** — tab bar switched from per-tab teal/sky/violet/rose to the single `#0b3b3a→#0d9488` gradient; txn-count/add-txn row, Report strip (sub-tabs, gear popover, AI Assistant button), Notes strip, and Charts strip (metric pills, sync button) all recolored to teal; per-section chart line colors (`METRIC_HEX`) and gain/loss green/red left untouched as semantic data.

**Deep Research cards recolored to one teal accent** — all 8 `SECTIONS` in `reportLinks.ts` (previously blue/sky/indigo/cyan/emerald/green/blue-50 per card) now share `bg-teal-50`/`border-teal-200`/`accentHex: #0d9488`; the "Research" button switched from per-section outline to a solid `#0b3b3a→#0d9488` pill with bold white text.

**Research Links (Explore tab) made compact + teal** — rows tightened (`py-2.5`→`py-1.5`, `gap-2`→`gap-1.5`), per-site icon colors (blue/purple/orange/red) replaced with a single teal icon/border/text treatment.

**Add Transaction modal (Txn page) merged into Settings** — the inline "Add Txn" pill and separate "Deep Research Settings" gear were both folded into one top-bar Settings popover with three rows (Add Transaction, AI Model, API Key); Model/API Key rows changed from stacked label+full-width-toggle to inline label-left/toggle-right layout, popover widened to `300px` (`max-w-[calc(100vw-24px)]`) with `whitespace-nowrap` on all pills so options never wrap.

**AddTransactionModal (Add Holding) compacted + recolored** — padding/spacing tightened throughout (`p-2.5`→`p-2`, `space-y-2.5`→`space-y-1.5`, shorter header/footer); BUY/SELL toggle and all emerald accents switched to the teal `#0b3b3a→#0d9488` gradient language.

**Holdings Analysis tab (Allocation/Benchmarking/Returns) unified to teal** — sub-tab bar (was orange/sky/emerald per tab) now single teal gradient; "By Sector"/"By Market Cap"/"By Holdings Concentration" headings and their table-header rows (was blue/orange/emerald/violet) recolored teal, each section given a `border-l-4 border-l-teal-500` accent bar; Benchmarking's loading bars, date-filter chip/popover, sector table header, and "By Sector" accent bar switched from sky/green to teal; Returns tab's settings popover rebuilt with the same teal gradient header shell as other Settings modals, Period toggle's sliding indicator changed from white to teal-filled. Per-sector chart/pie colors and green/red gain-loss indicators explicitly left untouched (user confirmed those should stay).

**AnalysisTab "Add Note" button** — height reduced (`py-3`→`py-1.5`) and color changed from blue (`#2563eb`) to the teal `#0b3b3a→#0d9488` gradient.

### 2026-07-02 (session 162)

**FxGainsTab and DividendsTab restyled to match** — all section titles (FX Conversion Gains, Rate Buckets, Timeline, Per Holding, Dividend Income, Year-by-year, By stock) converted to white-text rounded pill badges filled with the `#0b3b3a→#0d9488` gradient. Per-holding/per-stock rows in both tabs gained a relative-magnitude progress bar (teal gradient fill, same style as Rate Buckets). Value/symbol text unified to `#0b3b3a`. Dividends summary strip merged from 4 separate cards into one bordered box under a single pill header, mirroring FX's Section 1 layout.

**Top bar redesign on Overview/Holdings/Txn** — nav bar switched from flush borderless gradient to a bordered box: `border-4` solid `#0b3b3a`, `rounded-t-[14px]` (down from an interim 18px), fill lightened to `#14746f→#14b8a6`. Bar still sits flush against the hero/summary card below (no gap) — border only wraps the bar itself, not merged into one continuous outline with the card.

**LTP added to HoldingCard and SummaryCard** — `HoldingCard.tsx` shows LTP top-right of the holding-name row; `SummaryCard.tsx` gained an optional `ltp?` prop rendered top-right of the label row, wired on `TransactionsPage.tsx` from `holding.current_price`. Fixed a white-screen crash from the initial `HoldingCard` LTP addition — `ltp` was added to the props interface but never destructured in the function signature (`ReferenceError`).

**Holdings page tab bar unified to one accent** — the 4-5 tabs (Holdings/Charts/Analysis/Dividends/FX) previously had per-tab active colors (teal/sky/violet); now all use the same `#0b3b3a→#0d9488` gradient with white text when active.

**Misc Holdings/Txn polish** — back-button label bumped `14px`→`17px`; Holdings search/sort/sector strip recolored to match the new lighter top-bar gradient; page-edge gutter halved (`px-2`→`px-1`) on Overview/Holdings.

### 2026-07-02 (session 164)

**Top-bar corners squared off** — removed `rounded-t-[14px]` from the nav bar on Overview/Holdings/Txn (now flush rectangular corners).

**Holdings search/sort strip flipped to white with teal chrome** — outer strip and search input switched from teal-filled to `bg-white` with a teal border (later softened to `border-teal-100` — the original `border-2 border-teal-600` read as too heavy); search icon enlarged 10px→13px; Sector/Sort text switched from white to `text-teal-700`.

**Page-edge gutters halved again** — Holdings/Overview `px-1`→`px-0.5`, Txn `px-2`→`px-1`.

**DividendsTab top padding removed** — dropped `pt-2` on the root wrapper to close the gap above the Dividend Income box, matching FxGainsTab's no-padding pattern.

**Txn Charts range selector recolored** — active-range pill color was still blue (`#2563eb`, pre-teal-unification leftover) on both the inline and landscape-zoom range bars; switched to teal `#0d9488`.

**Deep Research card header row tightened + top-aligned** — chevron+emoji now `items-start` (was `items-center`, which vertically centered them against the full two-line title+description block instead of aligning with the heading); chevron placeholder shrunk `w-3`→`w-2`, row `gap-2`→`gap-1`, header `px-3`→`pl-1.5 pr-3` to pull content off the left border.

**Quick Stats metric grid recolored to teal** — tile labels `text-emerald-600/70`→`text-teal-600/70`; neutral (non-signal) values `#1e293b`→teal `#0f766e`. ROCE/ROE/ROA/margin/growth tiles keep their green/red `colorNum()` signal coloring untouched (same rule as gain/loss elsewhere).

**HoldingCard compacted** — `py-1.5`→`py-1`, Today/Total divider `mt-1 pt-1`→`mt-0.5 pt-0.5`; right padding bumped `pr-2`→`pr-3.5` so LTP and Total get breathing room from the border.

**SummaryCard Invested/Realized + FX/Dividend rows merged into one shared grid** — was two independent `flex justify-between` rows (each right-aligning to its own container edge), so "Realized" and "Dividend" didn't line up. Now one `grid-template-columns: 1fr auto` grid across both rows — column 2 auto-sizes to the wider of the two labels and hugs the real right edge (matching the XIRR badge), giving true cross-row alignment. Redundant `+` prefix removed from FX gains/Dividend lines since `fmtCompactGainLine()` already prepends a ▲/▼ arrow.

### 2026-07-02 (session 165)

**Top bar switched from filled gradient to outline-only** — Overview/Holdings/Txn nav bar background changed from the `#14746f→#14b8a6` gradient fill to a very light teal (`#e6f7f5`), border kept solid `#0b3b3a`, corners rounded again (`rounded-t-[14px]`, reversing session 164's squaring-off). Text/icons (back label, refresh, settings gear) switched from white to `#0b3b3a` to stay readable against the light fill.

### 2026-07-03 (session 167)

**Chart freshness indicator** — small "As of HH:MM" label added directly on both Holdings-page and Txn-page charts (`text-[9px] text-slate-400`, matching the existing sync-timestamp sizing convention). Switches to `text-amber-600 font-semibold` with a short appended reason ("couldn't verify latest update" / "numbers may be off" / "refresh may be delayed") when the backend flags a rejected update or a today-number mismatch — chart honestly signals when it might be wrong instead of always looking fine. New "Couldn't load chart — tap to retry" empty state alongside the existing "No price history available" one; retry buttons given `min-h-[44px]` touch targets (mobile-check catch during `/ship`).

### 2026-07-03 (chart architecture rework, same day)

Same-day follow-on: extracted the freshness label / retry / empty states above into a shared `ChartStateBlock.tsx` and applied it to `PriceChart.tsx` too, which previously had none of this — one generic "No price history available" covered genuine-empty, real errors, and stale data alike. Added a manual-refresh icon on `PriceChart.tsx` matching the existing zoom-icon's `w-6 h-6` sizing/style (same row, kept visually consistent rather than making it a full 44px target that would look mismatched next to its neighbor).

