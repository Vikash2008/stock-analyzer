# Test Cases — Stock Analyzer App

Run these manually in the browser whenever charts, gains, or realized P&L logic changes.
All values are verified against live data; re-check after any data or logic change.

---

## P — Portfolios Page

### P-BROKER-1: By Broker stock cards sum = Stocks tile (total gain)
**How to check:**
1. Open Overview page → By Broker tab
2. Sum "Total" gain from all cards under **Indian Stocks** section (Zerodha, AngelOne, Groww, IndMoney Ind)
3. Sum "Total" gain from all cards under **US Stocks** section (Vested, IndMoney US, IndMoney Mummy)
4. Add both sums → must equal **Stocks tile** Total gain

**Known edge case fixed:** Upstox is fully closed (no open positions). Before fix its 0.47L realized gain was missing from broker cards but present in Stocks tile. Now Upstox appears as a card with current=0.

**Status:** Fixed ✓

---

### P-TYPE-1: By Type cards sum = Hero total gain
**How to check:**
1. Overview → By Type tab
2. Sum Total gain of: Indian Stocks + US Stocks + Indian MF + US MF cards
3. Must equal Hero card Total gain

**Status:** Pass ✓

---

### P-STOCKS-MF: Stocks tile + MF tile = Hero
**How to check:**
- Hero Total gain = Stocks tile Total gain + MF tile Total gain
- Hero current = Stocks current + MF current
- Hero invested = Stocks invested + MF invested

**Status:** Pass ✓

---

## H — Holdings Page Charts Tab

Navigate to any holdings page (e.g. `/holdings/segment/stk`) → Charts tab.
For each metric, compare the **last value shown on chart** (rightmost point, visible in stat line above chart) against the **Summary card** at the top of the page.

### H-CHART-A1: Portfolio Value last point ≈ Summary current value
**Expected:** Close but not exact — chart uses last daily close price; Summary card uses live yfinance price. Gap = today's intraday move.
After market close / weekends: should be exact.

**How to check:** Switch to "Portfolio Value" pill → note stat line value → compare to Summary card current value.

**Status:** Approximate ✓ (known, acceptable)

---

### H-CHART-A2: Invested last point = Summary invested (exact)
**Expected:** Exact match. Both use `avg_cost × qty × fx`.

**How to check:** Switch to "Invested" pill → stat line value must equal Summary card "Invested" row exactly.

**Segments to check:** stk, mf, total, indian_stock, us_stock
**Portfolios to check:** Zerodha, AngelOne, Groww, Vested

**Status:** Exact match ✓

---

### H-CHART-A3: Unrealized Gains last point ≈ Summary (current − invested)
**Expected:** Approximate (inherits A1 daily-close difference). Internally consistent: chart unrealized = chart value − chart invested exactly.

**How to check:** Switch to "Unrealized Gains" pill → stat line ≈ Summary current − Summary invested.

**Status:** Approximate ✓ (known, acceptable)

---

### H-CHART-A4: Realized Gains last point = Summary realized P&L (exact)
**Expected:** Exact match for all segments and portfolios, including fully-closed portfolios.

**How to check:** Switch to "Realized Gains" pill → stat line must equal Summary card "Realized" row.

**Segments to check:**

| Segment | Expected realized (approx) |
|---------|---------------------------|
| total | ~21.6L |
| stk | ~8.3L |
| mf | ~13.2L |
| indian_stock | ~8.2L |
| us_stock | ~0.14L |

**Known edge case fixed:** Upstox (fully closed, ~0.47L realized) was previously excluded from segment chart realized but included in Summary card. Now both use the same scope.

**Status:** Fixed ✓

---

### H-CHART-A5: Total Gains last point ≈ Summary total gain
**Expected:** Approximate (inherits A1 daily-close difference for unrealized part). Realized component is exact (A4).

**How to check:** Switch to "Total Gains" pill → stat line ≈ Summary card total gain (unrealized + realized row).

**Status:** Approximate ✓ (known, acceptable)

---

### H-CHART-A6: Return % last point ≈ Summary return %
**Expected:** Close match. Both now use `totalGain / (invested + realizedCost) × 100`.

**How to check:** Switch to "Return %" pill → stat line % should be close to the implied return % from Summary card numbers.

**Before fix:** Chart used `(cur − inv) / inv` (unrealized only). Gap was up to −53pp for MF segment.
**After fix:** Chart uses `totalGain / totalCost` matching Summary formula.

**Segments to verify (approximate expected):**

| Segment | Expected return % |
|---------|------------------|
| total | ~39% |
| stk | ~38% |
| mf | ~43% |
| indian_stock | ~22% |
| us_stock | ~60% |

**Status:** Fixed ✓

---

### H-CHART-B1: Range filtering
**How to check:**
1. Select "1m" range → first data point on X-axis should be ~30 days ago
2. Select "All" range → first data point should be around first transaction date (2020–2021 era)
3. Switch metric pill → range selection persists

**Status:** Pass ✓

---

### H-CHART-C1: Segment isolation — stk > indian_stock
**How to check:**
1. Open `/holdings/segment/stk` → Charts → Portfolio Value → note last value
2. Open `/holdings/segment/indian_stock` → Charts → Portfolio Value → note last value
3. stk value must be larger (it includes US stocks)
4. `/holdings/segment/total` value must be largest (includes MF)

**Status:** Pass ✓

---

### H-CHART-D1: Cross-page: segment chart last point ≈ Portfolio page tile
**How to check:**
1. Note Stocks tile current value on Overview page
2. Open `/holdings/segment/stk` → Charts → Portfolio Value → stat line
3. Values should be close (daily close vs live price difference only)

**Status:** Approximate ✓

---

## X — Cross-Page Invariants (from CLAUDE.md)

Quick spot-checks after any gains/realized change:

| Rule | Check |
|------|-------|
| X1 | Hero total gain = Holdings `/segment/total` summary total gain |
| X2 | Stocks tile total gain = Holdings `/segment/stk` summary total gain |
| X3 | Indian Stocks card total gain = Holdings `/segment/indian_stock` summary total gain |
| X4 | US Stocks card total gain = Holdings `/segment/us_stock` summary total gain |
| X5 | HoldingCard total gain = TransactionsPage summary total gain |
| X6 | HoldingCard current value = TransactionsPage current value |
| X7 | HoldingCard today gain = TransactionsPage today gain |

---

## Open Issues (under investigation)

### CHART-MF-1: MF Portfolio Value chart last point ≠ Summary current value
**Symptom:** Charts tab → Portfolio Value last point shows ~19.76L; Summary card shows ~23.38L (gap ~3.62L). Total Gains chart shows ~22.4L vs Summary ~24.7L (gap ~2.3L). Realized Gains matches exactly.

**What was ruled out:**
- All 82 yf_symbols have yfinance price history (check_yf_history.py: 0 failures)
- All MF holding qtys are correct — net BUY−SELL = h.quantity for every holding (debug_chart_gap.py: all OK)
- Live price = historical last close (ratio=1.000) for all 14 MF `.BO` symbols (check_mf_prices.py)

**Hypothesis:** Chart uses stale browser localStorage history cache (`staleTime: Infinity`, 7-day maxAge). MF NAVs change daily — if chart data was cached days ago, last chart point drifts from today's live price.

**To confirm:** Click ↻ on Charts tab while on MF segment. If Portfolio Value updates from 19.76L → ~23.38L, stale cache is confirmed.

**Proposed fix:** In `useForceRefresh`, call `qc.invalidateQueries(['history'])` so chart data silently re-fetches after each portfolio refresh (keeps old data visible — does not blank the chart).

**Status:** Pending confirmation ⚠️

---

---

## AN — Analysis Tab (HoldingsPage)

Navigate to any holdings page (e.g. `/holdings/segment/total` or `/holdings/segment/stk`) → Analysis tab.
All three pills (Allocation, Benchmarking, Returns) are tested below.

---

### Allocation Pill

#### AN-ALLOC-1: By Sector alloc% sums to 100%
**How to check:**
1. Analysis → Allocation → expand all sector rows
2. Sum the Alloc% column across all sector header rows (Banking, Finance, Healthcare, IT, Growth, Tech, Smallcap, Equity, Other)

**Expected:** Sum = 100% (±1% rounding tolerance)

**Status:** Pending ⬜

---

#### AN-ALLOC-2: Sector value = sum of holding values within it
**How to check:**
1. Expand any sector row (e.g. Banking)
2. Sum the Value column of all holding rows inside it
3. Compare to the sector header row's Value

**Expected:** Exact match

**Status:** Pending ⬜

---

#### AN-ALLOC-3: Holding alloc% = value / portfolio current × 100
**How to check:**
1. Pick any holding in an expanded sector row
2. Note its displayed Alloc%
3. Calculate: holding Value / Summary card current value × 100

**Expected:** Match to ±0.1%

**Status:** Pending ⬜

---

#### AN-ALLOC-4: By Market Cap alloc% sums to 100%
**How to check:**
1. Open By Market Cap section (tap header to expand if collapsed)
2. Sum alloc% across the 4 bucket rows: Large Cap + Mid Cap + Small Cap + US Stocks

**Expected:** Sum = 100% (±1%)

**Status:** Pending ⬜

---

#### AN-ALLOC-5: Accordion exclusivity — opening one collapses others
**How to check:**
1. Default state: By Sector open, By Market Cap and By Holdings Concentration collapsed
2. Tap By Market Cap header → By Sector must collapse, By Market Cap must open
3. Tap By Holdings Concentration header → By Market Cap must collapse, Concentration opens
4. Tap By Sector header → Concentration collapses, By Sector opens

**Expected:** Only one section open at a time

**Status:** Pending ⬜

---

#### AN-ALLOC-6: By Holdings Concentration — Top N coverage is monotonically increasing
**How to check:**
1. Analysis → Allocation → open By Holdings Concentration section
2. Note coverage % for Top 5 toggle
3. Switch to Top 10 → note coverage %
4. Switch to Top 20 → note coverage %

**Expected:** Top 5 coverage < Top 10 coverage < Top 20 coverage.
Pie chart segment count matches the selected N.

**Status:** Pending ⬜

---

#### AN-ALLOC-7: Deduplication — same symbol held in multiple portfolios appears once
**How to check:**
1. Navigate to `/holdings/segment/total` (or `/holdings/segment/stk`) — a segment view with Grouped mode
2. Analysis → Allocation → expand a sector containing a symbol held in multiple portfolios (e.g. INFY in Zerodha + AngelOne, or META in Vested + IndMoney US)
3. Count rows for that symbol in the expanded list

**Expected:** Symbol appears exactly once. Its Value = combined value from all portfolios. `#` column (if visible) shows count of portfolios.

**Status:** Pending ⬜

---

#### AN-ALLOC-8: Sector XIRR is a realistic number (pooled cashflows, not inflated)
**How to check:**
1. Expand any sector row — note the XIRR% shown
2. Specific canary: Tech sector XIRR

**Expected:** Tech sector XIRR is a plausible annualized return (roughly 15–50%). If it shows ~94% that is the old weighted-average bug and means the pooled-cashflow fix was lost.

**Status:** Pending ⬜

---

#### AN-ALLOC-9: Today gain — inline format, single line, no wrap
**How to check:**
1. Expand any sector that has a non-zero today gain
2. Inspect the today column on the sector header row and on each holding row

**Expected:** Displayed as `+₹1.2K (+0.5%)` on a single line. Must be green (positive) or red (negative). Must not wrap to a second line even on 360px viewport.

**Status:** Pending ⬜

---

### Benchmarking Pill

#### AN-BENCH-1: Overall card — Alpha = Your XIRR − Benchmark XIRR
**How to check:**
1. Analysis → Benchmarking
2. Note the three values on the overall card: Your XIRR, Benchmark, Alpha

**Expected:** Alpha = Your XIRR − Benchmark (±0.1pp)

**Status:** Pending ⬜

---

#### AN-BENCH-2: Sector Alpha = Sector XIRR − Sector Benchmark XIRR
**How to check:**
1. Pick any sector row (e.g. Banking, benchmark = NSEBANK)
2. Note: Sector XIRR, Benchmark XIRR shown in merged Benchmark column, Alpha

**Expected:** Alpha = Sector XIRR − Benchmark XIRR (±0.1pp)

**Repeat for:** IT, Tech, Finance, Smallcap

**Status:** Pending ⬜

---

#### AN-BENCH-3: Index ETF alpha ≈ 0%
**How to check:**
1. Expand IT sector row → find ITBEES (tracks Nifty IT index ^CNXIT)
2. Note ITBEES per-holding alpha
3. Expand Tech sector → find MON100 and/or MAFANG (track NASDAQ / ^NDX)
4. Note their per-holding alpha

**Expected:** Alpha for index-tracking ETFs/funds = −2% to +2%.
Reason: benchmark is simulated using the ETF's own transaction dates, so ITBEES vs Nifty IT ≈ 0% alpha by construction.

**Status:** Pending ⬜

---

#### AN-BENCH-4: Alpha bar direction and proportionality
**How to check:**
1. Find a sector with positive alpha (e.g. IT or Tech if outperforming)
2. Find a sector with negative alpha
3. Observe the centered bar below each sector row

**Expected:**
- Positive alpha: bar extends right from center (green)
- Negative alpha: bar extends left from center (red)
- Largest |alpha| sector has the widest bar (occupies full 50% half)
- Other sectors' bars are proportionally shorter

**Status:** Pending ⬜

---

#### AN-BENCH-5: Benchmark column shows index name + XIRR
**How to check:**
1. Look at any collapsed sector row's Benchmark column
2. Should read something like `NSEBANK (12.3%)`
3. Expand that sector → each holding row also shows the same benchmark label in its Benchmark column

**Expected:** Format = `LABEL (X.X%)`; label matches BENCHMARK_LABEL map for the sector; same label in parent sector and child holding rows.

| Sector | Expected benchmark label |
|--------|--------------------------|
| Banking | NSEBANK |
| IT | CNXIT |
| Tech | NDX |
| Finance | NIFTY_FIN_SERVICE |
| Healthcare | CNXPHARMA |
| Growth | CRSLDX |
| Smallcap | NSMCAP250 |
| Equity / Other | NSEI |

**Status:** Pending ⬜

---

#### AN-BENCH-6: Benchmark data loads only when Analysis tab is active
**How to check:**
1. Open a holdings page → stay on Holdings tab for 30s
2. Switch to Analysis → Benchmarking
3. Observe: benchmark XIRR values appear after a brief delay (network fetch), not immediately

**Expected:** `→` or `--` placeholder while loading; real values appear once `useBenchmarkXirr` resolves. No fetch happens before Analysis tab is tapped.

**Status:** Pending ⬜

---

#### AN-BENCH-7: Holding rows (expanded) show per-holding alpha, not sector alpha
**How to check:**
1. Expand any sector row with ≥2 holdings
2. Note the Alpha column value for individual holdings

**Expected:** Each holding's alpha is independently computed as `holdingXirr − holdingBenchXirr` (not copied from sector row). Different holdings in the same sector should show different alpha values.

**Status:** Pending ⬜

---

### Returns Pill

#### AN-RET-1: Year mode, All sectors — bar sum ≈ total P&L
**How to check:**
1. Analysis → Returns → Sector = All, Period = Year, Metric = Gains
2. Sum the value of all yearly bars (positive bars add, negative bars subtract)
3. Compare to Summary card total gain (unrealized + realized)

**Expected:** Sum ≈ current total P&L (~68L). Tolerance: ±2L (daily close vs live price difference on open positions).
Current year bar is labeled YTD and appears semi-transparent.

**Status:** Pending ⬜

---

#### AN-RET-2: Month mode — year selector appears and filters bars
**How to check:**
1. Toggle Period → Month
2. Verify a row of year pills appears
3. Select a past completed year (e.g. 2023)
4. Bars should show Jan–Dec for 2023

**Expected:**
- Year selector only appears in Month mode
- One pill active at a time
- Exactly 12 bars for a completed year; current year shows Jan→current month only
- Current month bar is labeled MTD, semi-transparent

**Status:** Pending ⬜

---

#### AN-RET-3: Month mode — monthly bars sum ≈ year bar for same year
**How to check:**
1. In Year mode, note the Gains bar value for year 2023
2. Switch to Month mode → select 2023
3. Sum the 12 monthly Gains bars

**Expected:** Sum ≈ full-year 2023 bar (±5% due to daily close approximation)

**Status:** Pending ⬜

---

#### AN-RET-4: Metric toggle — Return %
**How to check:**
1. Switch Metric → Return %
2. Observe bars in Year mode

**Expected:** Bars show percentage values (e.g. +23.4%), not INR amounts. Colors still green/red. Y-axis labeled in %.

**Status:** Pending ⬜

---

#### AN-RET-5: Metric toggle — XIRR
**How to check:**
1. Switch Metric → XIRR
2. Observe Year mode bars

**Expected:** Bars show annualized XIRR % for each year (cumulative from first transaction in the period to end of that year). Values should be plausible (10–60% range). YTD bar shows XIRR to today.

**Status:** Pending ⬜

---

#### AN-RET-6: Sector filter isolates correctly
**How to check:**
1. Switch Sector pill from All → Banking
2. Note the summary line above the chart (shows Banking's total P&L)
3. Switch to Tech → summary line and bars update to Tech only

**Expected:**
- Summary line changes for each sector
- Bar values are smaller than All-sectors view (subset of portfolio)
- Sector-specific bars: values derived from holdings in that sector only

**Status:** Pending ⬜

---

#### AN-RET-7: Gear icon popover — controls are functional
**How to check:**
1. Tap ⚙ gear icon (extreme right of summary line)
2. Popover opens showing: Sector list with color dots, Period slider, Year pills (if Month mode), Metric slider
3. Tap a different sector inside the popover → chart updates in real time
4. Tap outside to dismiss

**Expected:** Popover opens/closes cleanly. All four controls (sector, period, year, metric) update the histogram immediately on change.

**Status:** Pending ⬜

---

#### AN-RET-8: Sector change auto-resets year to current year
**How to check:**
1. Switch to Month mode → select year 2022
2. Change sector to a different one (e.g. All → Banking)

**Expected:** Year selection resets to current year automatically

**Status:** Pending ⬜

---

#### AN-RET-9: No data for early years before first transaction
**How to check:**
1. Year mode, All sectors → check leftmost bars
2. The chart should start from the first year you made any investment (approx 2020–2021)

**Expected:** No bars shown for years before the first transaction. Chart does not show zero bars stretching back to 2010 etc.

**Status:** Pending ⬜

---

## Known Limitations (not bugs)

| Item | Detail |
|------|--------|
| A1/A3/A5 chart gap | Chart uses last daily close; Summary uses live price. Gap = today's intraday move. Closes to zero after market close. |
| Upstox historical chart | Upstox's historical portfolio value (before positions were closed) is not shown in segment charts — only its realized gains are included. Full historical value would require fetching price history for fully-closed symbols. |
| XIRR Trend early points | XIRR is unstable in the first few months of investing. Wide swings at the left edge of XIRR Trend chart are expected. |
| Invested chart approximation | Uses current avg_cost × historical qty, not true historical cost basis. Chart shows what you would have invested at your current avg_cost — useful directionally but not a historical ledger. |
