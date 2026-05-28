# Test Cases — Stock Analyzer App

Exhaustive manual test cases. Run in browser whenever any number, filter, chart, or display logic changes.
All values verified against live data; re-check expected numbers after data or logic changes.

---

## P — Portfolios Page (Overview)

Navigate to `/` (root).

### Hero Card

#### P-HERO-1: Current value = Stocks current + MF current
**How to check:** Hero current value = Stocks tile current + MF tile current
**Expected:** Exact match
**Status:** Pass ✓

#### P-HERO-2: Invested = Stocks invested + MF invested
**How to check:** Note Hero "Invested" (visible in Holdings page summary for `/segment/total`). Stocks invested + MF invested must match.
**Expected:** Exact match
**Status:** Pass ✓

#### P-HERO-3: Total gain = Stocks total gain + MF total gain
**How to check:** Hero Total gain = Stocks tile Total + MF tile Total
**Expected:** Exact match
**Status:** Pass ✓

#### P-HERO-4: Today gain = sum of all holding today gains
**How to check:**
1. Note Hero Today gain
2. Navigate to `/holdings/segment/total` → Summary card Today gain
**Expected:** Match (±rounding)
**Status:** Pass ✓

#### P-HERO-5: XIRR is a plausible annualised return
**How to check:** Note XIRR shown on Hero card
**Expected:** Non-null, in range 10–60% for a typical equity portfolio. Not 0% or >200%.
**Status:** Pending ⬜

---

### Stocks / MF Tiles

#### P-TILES-1: Stocks tile + MF tile = Hero (all three metrics)
**How to check:** Stocks current + MF current = Hero current; same for invested and total gain
**Expected:** Exact match on all three
**Status:** Pass ✓

#### P-TILES-2: Tiles are side-by-side, no horizontal overflow at 360–412px
**How to check:** Open on mobile or resize browser to 360px wide
**Expected:** Two tiles in a 2-column grid; no text truncates unexpectedly; no horizontal scroll bar
**Status:** Pending ⬜

#### P-TILES-3: Stocks tile navigates to /holdings/segment/stk
**How to check:** Tap Stocks tile
**Expected:** Navigates to Holdings page with "Stocks" as label
**Status:** Pending ⬜

#### P-TILES-4: MF tile navigates to /holdings/segment/mf
**How to check:** Tap MF tile
**Expected:** Navigates to Holdings page with "Mutual Funds" as label
**Status:** Pending ⬜

---

### By Type Breakdown

#### P-TYPE-1: Sum of all type cards = Hero total gain
**How to check:** Indian Stocks + US Stocks + Indian MF + US MF Total gains must equal Hero Total gain
**Expected:** Exact match
**Status:** Pass ✓

#### P-TYPE-2: Stocks section sum = Stocks tile
**How to check:** Indian Stocks card Total + US Stocks card Total = Stocks tile Total gain
**Expected:** Exact match
**Status:** Pass ✓

#### P-TYPE-3: MF section sum = MF tile
**How to check:** Indian MF card Total + US MF card Total = MF tile Total gain
**Expected:** Exact match
**Status:** Pass ✓

#### P-TYPE-4: Type card XIRR includes closed positions
**How to check:**
1. Note Indian Stocks card XIRR
2. Navigate to `/holdings/segment/indian_stock` → note Summary XIRR
**Expected:** Values close (both client-side XIRR from all transactions including sells)
**Status:** Pending ⬜

#### P-TYPE-5: Type cards navigate to correct segment
**How to check:** Tap each type card
**Expected:**
- Indian Stocks → `/holdings/segment/indian_stock`
- US Stocks → `/holdings/segment/us_stock`
- Indian MF → `/holdings/segment/indian_mf`
- US MF → `/holdings/segment/us_mf`
**Status:** Pending ⬜

---

### By Broker Breakdown

#### P-BROKER-1: By Broker stock cards sum = Stocks tile total gain
**How to check:**
1. By Broker tab → sum Total gain of all cards under Indian Stocks section + US Stocks section
2. Compare to Stocks tile Total gain
**Expected:** Exact match (Upstox fully-closed card must appear with current=0 and Total = its realized gain)
**Note:** Fixed 2026-05-29 — Upstox was missing before fix.
**Status:** Fixed ✓

#### P-BROKER-2: By Broker MF cards sum = MF tile total gain
**How to check:** Sum Total gain of all MF_ cards under Mutual Funds section = MF tile Total gain
**Expected:** Exact match
**Status:** Pass ✓

#### P-BROKER-3: Upstox card visible with current = 0
**How to check:** By Broker tab → find Upstox card
**Expected:** Current value = ₹0; Total gain = Upstox's realized P&L (~0.47L); XIRR shows a value
**Status:** Pass ✓

#### P-BROKER-4: Each broker card navigates to correct holdings page
**How to check:** Tap Zerodha card → back → tap AngelOne card
**Expected:** Each navigates to `/holdings/portfolio/:name` with correct portfolio name in header
**Status:** Pending ⬜

#### P-BROKER-5: By Broker total = By Type total
**How to check:** Switch between By Type and By Broker; Hero card must not change
**Expected:** Hero card numbers identical in both views
**Status:** Pending ⬜

---

### Pull-to-Refresh

#### P-REFRESH-1: Swipe-down triggers data reload
**How to check:** Pull down >64px on mobile → release when indicator shows "↑ Release to refresh"
**Expected:** Spinner shows; `as_of` timestamp at page bottom updates after response arrives
**Status:** Pending ⬜

#### P-REFRESH-2: Stale data stays visible during refresh
**How to check:** Trigger pull-to-refresh; observe portfolio numbers during loading
**Expected:** Numbers remain visible (no blank screen or skeleton); only spinner/timestamp indicate loading
**Status:** Pass ✓

---

## H — Holdings Page (Common)

Navigate to any holdings page (e.g., `/holdings/segment/total`).

### Summary Card

#### H-SUMMARY-1: Current value = sum of open HoldingCard current values
**How to check:** Sum current values from all visible open HoldingCards; compare to Summary card current
**Expected:** Exact match
**Status:** Pass ✓

#### H-SUMMARY-2: Invested = sum of open HoldingCard invested values
**How to check:** Sum invested from all open cards (shown on TransactionsPage if needed); compare to Summary invested
**Expected:** Exact match
**Status:** Pending ⬜

#### H-SUMMARY-3: Today gain = sum of HoldingCard today gains
**How to check:** Sum all today gain values from open HoldingCards; compare to Summary Today
**Expected:** Exact match (±rounding)
**Status:** Pass ✓

#### H-SUMMARY-4: Total gain = unrealized + realized
**How to check:** Summary total gain = (Summary current − Summary invested) + Summary realized
**Expected:** Exact match
**Status:** Pass ✓

#### H-SUMMARY-5: Open + Closed realized = All realized (exactly)
**How to check:**
1. Settings gear → filter = Open → note Summary realized
2. Settings gear → filter = Closed → note Summary realized
3. Settings gear → filter = All → note Summary realized
**Expected:** Open realized + Closed realized = All realized (exact)
**Status:** Pass ✓

---

### Filter Controls (Open / Closed / All)

#### H-FILTER-1: Open filter hides fully-closed positions
**How to check:** Settings gear → Open → check list
**Expected:** No holdings with current=0 visible; count shows "N open"
**Status:** Pass ✓

#### H-FILTER-2: Closed filter shows only fully-exited positions
**How to check:** Settings gear → Closed → check list
**Expected:** Only holdings with current=0, Total = realized P&L; count shows "M closed"
**Status:** Pass ✓

#### H-FILTER-3: All filter summary = union of Open and Closed
**How to check:** All filter summary current must equal Open filter summary current (closed positions add nothing to current)
**Expected:** All current = Open current; All realized = Open realized + Closed realized
**Status:** Pass ✓

#### H-FILTER-4: Show Closed toggle (All mode) appends closed rows to list
**How to check:** Filter = All → toggle Show Closed on → observe list
**Expected:** Closed rows (current=0) appear below open rows; summary card unchanged
**Status:** Pass ✓

#### H-FILTER-5: Closed cards have no Today gain
**How to check:** Filter = Closed; inspect each HoldingCard
**Expected:** Today gain column shows "—" or is blank; XIRR computed from BUY+SELL only (no terminal value)
**Status:** Pass ✓

---

### Grouped / Standalone Toggle (Segment Views Only)

#### H-GROUP-1: Grouped mode deduplicates same symbol across portfolios
**How to check:** `/holdings/segment/total` → Settings gear → View = Grouped → find a symbol held in 2+ portfolios (e.g. INFY in Zerodha + AngelOne)
**Expected:** Symbol appears once; value = combined value from both portfolios
**Status:** Pass ✓

#### H-GROUP-2: Standalone mode shows one card per portfolio:symbol
**How to check:** Settings gear → View = Standalone
**Expected:** INFY appears twice (one for each portfolio); each shows its own value
**Status:** Pass ✓

#### H-GROUP-3: Grouped mode shows company name (not portfolio name)
**How to check:** Grouped → inspect subLabel on a HoldingCard
**Expected:** Company name (e.g. "Infosys Ltd") — not portfolio name ("Zerodha")
**Status:** Pass ✓

---

### Sort Control

#### H-SORT-1: Default sort = Current Value descending
**How to check:** Open holdings page; first card must have highest current value
**Expected:** Cards in descending current value order
**Status:** Pass ✓

#### H-SORT-2: Tap same sort field toggles asc/desc
**How to check:** Sort = Current Value ↓ → tap Current Value again
**Expected:** Sort flips to ↑; lowest current value card is first
**Status:** Pass ✓

#### H-SORT-3: Sort by Total Gain includes realized P&L
**How to check:** Sort by Total Gain; inspect order manually
**Expected:** Total Gain = (current − invested) + realized; a fully-closed position with large realized gain ranks higher than an open position with small unrealized gain if its total is larger
**Status:** Pending ⬜

#### H-SORT-4: Sort applies to closed rows when Show Closed is on
**How to check:** Filter = All, Show Closed = on, Sort = Total Gain ↓
**Expected:** Closed rows also sorted by their realized gain (Total Gain), not appended unsorted at the end
**Status:** Pass ✓

---

### HoldingCard Display

#### H-CARD-1: XIRR colored correctly
**How to check:** Cards with positive XIRR show green; negative show red
**Expected:** Green = positive annualised return; Red = holding losing money since purchase
**Status:** Pass ✓

#### H-CARD-2: Today gain is non-null for most open positions (market hours)
**How to check:** During market hours, inspect a few HoldingCards
**Expected:** Today gain shown as "+₹X (+Y%)" or "−₹X (−Y%)"; not "—" for active holdings
**Status:** Pending ⬜

#### H-CARD-3: Tapping card saves scroll position and navigates to transactions
**How to check:** Scroll down the list; tap a card mid-list; press Back
**Expected:** Returns to same scroll position, not top of page
**Status:** Pass ✓

---

## H-CHARTS — Holdings Charts Tab

Navigate to any holdings page → Charts tab.
Compare last data point on each metric chart (stat line above chart) vs Summary card.

#### HC-A1: Portfolio Value last point ≈ Summary current value
**Expected:** Close but not exact — chart uses last daily close; Summary uses live price. Gap = today's intraday move.
**Status:** Approximate ✓

#### HC-A2: Invested last point = Summary invested (exact)
**Expected:** Exact match. Both use avg_cost × qty × fx.
**Segments to check:** stk, mf, total, indian_stock, us_stock
**Status:** Exact match ✓

#### HC-A3: Unrealized Gains last point ≈ Summary (current − invested)
**Expected:** Approximate (inherits A1 intraday gap). Internally: chart unrealized = chart value − chart invested exactly.
**Status:** Approximate ✓

#### HC-A4: Realized Gains last point = Summary realized P&L (exact)
**Expected:** Exact match for all segments including fully-closed portfolios (Upstox ~0.47L included).

| Segment | Expected realized (approx) |
|---------|---------------------------|
| total | ~21.6L |
| stk | ~8.3L |
| mf | ~13.2L |
| indian_stock | ~8.2L |
| us_stock | ~0.14L |

**Status:** Fixed ✓

#### HC-A5: Total Gains last point ≈ Summary total gain
**Expected:** Approximate (inherits A1 intraday gap on unrealized; realized is exact).
**Status:** Approximate ✓

#### HC-A6: Return % last point ≈ Summary implied return
**Expected:** Close match. Formula = totalGain / (invested + realizedCost) × 100.

| Segment | Expected return % (approx) |
|---------|---------------------------|
| total | ~39% |
| stk | ~38% |
| mf | ~43% |
| indian_stock | ~22% |
| us_stock | ~60% |

**Status:** Fixed ✓

#### HC-A7: XIRR Trend — last point close to Summary XIRR
**How to check:** Switch to XIRR Trend pill → note last value; compare to Summary card XIRR
**Expected:** Close match (±2pp — XIRR is sensitive to terminal value date vs price date)
**Status:** Pending ⬜

#### HC-B1: Range filtering — 1m shows ~30 days of data
**How to check:** Select 1m range; inspect X-axis leftmost label
**Expected:** First tick ≈ 30 days ago; All range starts at first transaction year
**Status:** Pass ✓

#### HC-B2: Range persists when switching metric pills
**How to check:** Select 3m range → switch from Portfolio Value to Total Gains
**Expected:** Range stays at 3m
**Status:** Pending ⬜

#### HC-C1: Segment isolation — stk > indian_stock > single portfolio
**How to check:** Note Portfolio Value last point for total → stk → indian_stock → Zerodha
**Expected:** total > stk > indian_stock > Zerodha (each is a subset)
**Status:** Pass ✓

#### HC-C2: Sync ↻ button invalidates history cache
**How to check:** Tap ↻ on Charts tab strip; observe chart
**Expected:** Old data stays visible; chart silently re-fetches in background; spinner shows ~1.2s
**Status:** Pass ✓

#### HC-D1: Cross-page: segment chart last point ≈ Portfolios page tile
**How to check:** Note Stocks tile current on Overview; open `/holdings/segment/stk` → Charts → Portfolio Value stat line
**Expected:** Values close (daily close vs live price gap only)
**Status:** Approximate ✓

---

## H-ANALYSIS — Analysis Tab

Navigate to any holdings page → Analysis tab.

---

### Allocation Pill

#### AN-ALLOC-1: By Sector alloc% sums to 100%
**How to check:** Expand all sector rows; sum the Alloc% column
**Expected:** ~100% (±1% rounding)
**Status:** Pass ✓ (by construction)

#### AN-ALLOC-2: Sector value = sum of holding values within it
**How to check:** Expand any sector; sum Value column of all holding rows
**Expected:** Exact match with sector header Value
**Status:** Pass ✓ (by construction)

#### AN-ALLOC-3: Holding alloc% = value / portfolio current × 100
**How to check:** Pick any holding; note Alloc%; calculate value / Summary current × 100
**Expected:** Match to ±0.1%
**Status:** Pass ✓ (by construction)

#### AN-ALLOC-4: By Market Cap alloc% sums to 100%
**How to check:** Open By Market Cap; sum alloc% of Large Cap + Mid Cap + Small Cap + US Stocks
**Expected:** ~100% (±1%)
**Status:** Pass ✓ (by construction)

#### AN-ALLOC-5: Accordion — opening one section collapses others
**How to check:**
1. Default: By Sector open, others collapsed
2. Tap By Market Cap → By Sector collapses, By Market Cap opens
3. Tap By Holdings Concentration → By Market Cap collapses
**Expected:** Only one section open at a time
**Status:** Pass ✓ (code verified)

#### AN-ALLOC-6: Top N coverage monotonically increasing
**How to check:** Toggle Top 5 / Top 10 / Top 20 in Holdings Concentration section
**Expected:** Top 5 coverage < Top 10 coverage < Top 20 coverage; pie has N+1 segments (top N + "Other")
**Status:** Pass ✓ (code verified)

#### AN-ALLOC-7: Deduplication — same symbol held in 2+ portfolios appears once
**How to check:** `/holdings/segment/total` → Grouped mode → expand a sector containing INFY or META
**Expected:** Symbol appears once; Value = combined value; portfolios count reflected in XIRR
**Status:** Pass ✓ (by construction)

#### AN-ALLOC-8: Sector XIRR is realistic (pooled cashflows, not inflated)
**How to check:** Expand any sector — note XIRR; specific canary: Tech sector
**Expected:** Tech XIRR = 15–50% (not ~94% which was the old weighted-average bug)
**Status:** Pass ✓ (code verified)

#### AN-ALLOC-9: Today gain — inline format, single line, no wrap
**How to check:** On a sector row with non-zero today gain, inspect the Today column at 360px viewport
**Expected:** Displayed as `+₹1.2K (+0.5%)` on one line; green or red; no wrapping
**Status:** ⚠️ Needs browser check (80px column may be tight for large values)

---

### Benchmarking Pill

#### AN-BENCH-1: Overall card Alpha = Your XIRR − Benchmark XIRR
**How to check:** Note the three values on the overall card
**Expected:** Alpha = Your XIRR − Benchmark (±0.1pp)
**Status:** Pending ⬜

#### AN-BENCH-2: Sector Alpha = Sector XIRR − Benchmark XIRR
**How to check:** Pick any sector row; verify Alpha = Sector XIRR − Benchmark XIRR
**Repeat for:** Banking, IT, Tech, Finance
**Status:** Pending ⬜

#### AN-BENCH-3: Index ETF alpha ≈ 0%
**How to check:** Expand IT sector → find ITBEES; Expand Tech → find MON100 / MAFANG
**Expected:** Per-holding alpha = −2% to +2% (ETF tracks its own benchmark by design)
**Status:** Pending ⬜

#### AN-BENCH-4: Alpha bar direction and proportionality
**How to check:** Find a positive-alpha sector and a negative-alpha sector
**Expected:** Positive → bar extends right (green); Negative → bar extends left (red); largest |alpha| sector has widest bar
**Status:** Pending ⬜

#### AN-BENCH-5: Benchmark column shows correct index label
**How to check:** Look at each sector's Benchmark column

| Sector | Expected benchmark label |
|--------|--------------------------|
| Banking | NSEBANK |
| IT | CNXIT |
| Tech | NDX |
| Finance | NIFTY_FIN_SERVICE |
| Healthcare | CNXPHARMA |
| Smallcap | NSMCAP250 |
| Equity / Other | NSEI |

**Expected:** Label + XIRR% shown in merged column; same label in holding rows when expanded
**Status:** Pending ⬜

#### AN-BENCH-6: Benchmark data loads lazily (only when Analysis tab is active)
**How to check:** Open holdings page → stay on Holdings tab 30s → switch to Analysis → Benchmarking
**Expected:** Brief loading state; real XIRR values appear once fetch resolves; no fetch before tab opened
**Status:** Pending ⬜

#### AN-BENCH-7: Holding rows show per-holding alpha, not sector alpha
**How to check:** Expand any sector with ≥2 holdings; compare Alpha values between holdings
**Expected:** Different holdings show different alpha; not all identical to sector alpha
**Status:** Pending ⬜

---

### Returns Pill

#### AN-RET-SUMLINE-1: Year mode, All sectors — summary line text and number
**How to check:** Analysis → Returns → Sector=All, Period=Year
**Expected:**
- Text reads `all sectors · by year`
- Bold number = sum of all year bars (total portfolio gains)
- Number matches Summary card total gain (±daily close gap)
**Status:** Fixed ✓

#### AN-RET-SUMLINE-2: Month mode, All sectors — summary line text and number
**How to check:** Analysis → Returns → Sector=All, Period=Month, Year=2025
**Expected:**
- Text reads `all sectors · 2025`
- Bold number = sum of all 12 monthly bars for 2025 (≈ 2025's annual gain)
- NOT the all-time total portfolio gains
**Status:** Fixed ✓

#### AN-RET-SUMLINE-3: Year mode, specific sector — text shows sector name
**How to check:** Gear → select Banking sector, Period=Year
**Expected:** Text reads `Banking · by year`; number = Banking's total gains (sum of all Banking year bars)
**Status:** Pending ⬜

#### AN-RET-SUMLINE-4: Month mode, specific sector — text shows sector + year
**How to check:** Gear → select IT sector, Period=Month, Year=2024
**Expected:** Text reads `IT · 2024`; number = IT sector's 2024 gains (sum of 12 monthly bars)
**Status:** Pending ⬜

#### AN-RET-SUMLINE-5: Metric toggle does NOT change the summary line number
**How to check:** Note the bold summary number; switch Metric from Gains → Return % → XIRR
**Expected:** Summary line bold number stays in INR gains (always uses `r.gains`, not `r.returnPct` or `r.xirr`); bars update but text number does not
**Status:** Pending ⬜

#### AN-RET-1: Year mode, All sectors — bar sum ≈ total P&L
**How to check:** Sum the value of all yearly bars (Metric=Gains)
**Expected:** Sum ≈ current total P&L (~68L). YTD bar is semi-transparent (50% opacity).
**Status:** Pass ✓ (by construction — telescoping sum of portSeries.total)

#### AN-RET-2: Month mode — year selector inside gear popover
**How to check:** Gear → switch Period to Month
**Expected:** Year pills appear inside the gear popover (not inline on page); one year active at a time; default = current year
**Status:** Pass ✓ (code verified; test description corrected)

#### AN-RET-3: Monthly bars sum ≈ year bar for same year
**How to check:** Note 2024 year bar; switch to Month mode → select 2024 → sum all 12 bars
**Expected:** Sum ≈ 2024 annual bar value (exact for "all sectors" mode, ~approximate for sector mode)
**Status:** Pass ✓ (by construction)

#### AN-RET-4: Metric = Gains — bars show INR values
**How to check:** Metric = Gains (default)
**Expected:** Y-axis in INR (L/K/Cr format); bar tooltip shows `+₹X`; green bars positive, red bars negative
**Status:** Pass ✓ (code verified)

#### AN-RET-5: Metric = Return % — bars show percentage values
**How to check:** Gear → Metric = Return %
**Expected:** Y-axis shows %; bar tooltip shows `+X.X%`; summary line bold number stays in INR (unchanged)
**Status:** Pass ✓ (code verified)

#### AN-RET-6: Metric = XIRR — bars show annualised rate
**How to check:** Gear → Metric = XIRR
**Expected:** Bars show annualised XIRR % per year; values plausible (10–60% range); null periods show 0 (edge case: very early years)
**Status:** Pass ✓ (code verified); ⚠️ verify early years don't silently show +0.0% when XIRR is null

#### AN-RET-7: YTD bar is semi-transparent, labeled with year + "YTD"
**How to check:** Year mode; find current year bar
**Expected:** Label = "2026 YTD"; bar opacity = 50% (visually lighter than past years)
**Status:** Pending ⬜

#### AN-RET-8: MTD bar is semi-transparent, labeled with month + "MTD"
**How to check:** Month mode, current year; find current month bar
**Expected:** Label = "May MTD"; bar opacity = 50%
**Status:** Pending ⬜

#### AN-RET-9: Sector filter — bars and summary update to selected sector
**How to check:** Switch from All → Banking; observe bars and summary
**Expected:** Bars smaller (subset); summary line shows Banking total gains; text = "Banking · by year"
**Status:** Pass ✓ (code verified)

#### AN-RET-10: Gear popover closes on outside tap
**How to check:** Open gear popover; tap outside it
**Expected:** Popover dismisses cleanly; no lingering overlay
**Status:** Pending ⬜

#### AN-RET-11: Sector change — year stays if valid for new sector
**How to check:** Month mode, year=2022; switch to a sector that also has 2022 data
**Expected:** Year selection stays at 2022 (no reset)
**Status:** Pass ✓ (code verified; resets only if year invalid for new sector)

#### AN-RET-12: No bars for years before first transaction
**How to check:** Year mode; check leftmost bar label
**Expected:** First bar ≈ year of first investment (~2020–2021); no zero-value bars before it
**Status:** Pass ✓ (by construction)

---

## X — Cross-Page Invariants

Quick spot-checks after any gains, realized, or filter change.

| Rule | Check | Status |
|------|-------|--------|
| X1 | Hero total gain = Holdings `/segment/total` Summary total gain | Pass ✓ |
| X2 | Stocks tile total gain = Holdings `/segment/stk` Summary total gain | Pass ✓ |
| X3 | Indian Stocks card total gain = Holdings `/segment/indian_stock` Summary total gain | Pass ✓ |
| X4 | US Stocks card total gain = Holdings `/segment/us_stock` Summary total gain | Pass ✓ |
| X5 | HoldingCard total gain = TransactionsPage summary total gain | Pass ✓ |
| X6 | HoldingCard current value = TransactionsPage current value | Pass ✓ |
| X7 | HoldingCard today gain = TransactionsPage today gain | Pass ✓ |

---

## T — Transactions Page

Navigate to any `/transactions/:portfolio/:symbol`.

#### T-TXROW-1: Transaction rows show correct type badge
**How to check:** Inspect BUY, SELL, DIVIDEND rows
**Expected:** BUY = green badge; SELL = red badge; DIVIDEND = sky badge
**Status:** Pending ⬜

#### T-TXROW-2: Card tint matches total gain sign
**How to check:** Find a transaction row with positive total gain and one with negative
**Expected:** Positive = green-tinted card; Negative = red-tinted card
**Status:** Pending ⬜

#### T-TXROW-3: R1 right cell = current value (invested value for SELL = ₹0)
**How to check:** Look at a SELL row's top-right cell
**Expected:** Shows `₹0 (₹0)` for fully-closed SELL row
**Status:** Pending ⬜

#### T-SUMMARY-1: Overview card current value matches HoldingCard (X6)
**How to check:** Note HoldingCard current; navigate to its TransactionsPage; compare overview card current
**Expected:** Exact match
**Status:** Pass ✓

#### T-SUMMARY-2: Overview card total gain matches HoldingCard total gain (X5)
**Expected:** Exact match
**Status:** Pass ✓

---

## Open Issues (under investigation)

### CHART-MF-1: MF Portfolio Value chart last point ≠ Summary current value
**Symptom:** Charts tab → Portfolio Value last point ~19.76L; Summary card ~23.38L (gap ~3.62L).
**Ruled out:** All 82 yf_symbols have history; all qty correct; live price = historical last close.
**Hypothesis:** Stale browser localStorage cache (staleTime=Infinity, 7-day maxAge).
**To confirm:** Click ↻ on Charts tab (MF segment). If Portfolio Value jumps to ~23.38L, stale cache confirmed.
**Proposed fix:** `qc.invalidateQueries(['history'])` inside `useForceRefresh`.
**Status:** Pending confirmation ⚠️

---

## Known Limitations (not bugs)

| Item | Detail |
|------|--------|
| HC-A1/A3/A5 intraday gap | Chart uses last daily close; Summary uses live price. Gap closes to zero after market close. |
| AN-RET-SUMLINE-5 text static | Summary line bold number always shows INR gains regardless of metric pill (Return%/XIRR). By design — gains is always the most useful absolute reference. |
| AN-RET sector mode | Sector-specific Returns bars use open-position value series only; fully-closed positions in that sector not included. All-sectors mode uses portSeries.total which is correct. |
| Upstox historical chart | Upstox's historical portfolio value not shown in segment charts — only its realized gains. Full history would require price history for fully-closed symbols. |
| XIRR Trend early points | XIRR is unstable in the first few months of investing. Wide swings at the left edge of XIRR Trend chart are expected. |
| Invested chart approximation | Uses current avg_cost × historical qty, not true historical cost basis. Directionally correct but not a historical ledger. |
