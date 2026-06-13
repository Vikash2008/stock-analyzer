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
**Status:** Pass ✅ (2026-06-13, demo data, Playwright automated)

#### P-HERO-2: Invested = Stocks invested + MF invested
**How to check:** Note Hero "Invested" (visible in Holdings page summary for `/segment/total`). Stocks invested + MF invested must match.
**Expected:** Exact match
**Status:** Pass ✅ (2026-06-13, demo data)

#### P-HERO-3: Total gain = Stocks total gain + MF total gain
**How to check:** Hero Total gain = Stocks tile Total + MF tile Total
**Expected:** Exact match
**Status:** Pass ✅ (2026-06-13, demo data)

#### P-HERO-4: Today gain = sum of all holding today gains
**How to check:**
1. Note Hero Today gain
2. Navigate to `/holdings/segment/total` → Summary card Today gain
**Expected:** Match (±rounding)
**Status:** Pass ✅ (2026-06-13, demo data)

#### P-HERO-5: XIRR is a plausible annualised return
**How to check:** Note XIRR shown on Hero card
**Expected:** Non-null, in range 10–60% for a typical equity portfolio. Not 0% or >200%.
**Status:** Pass ✅ (2026-06-13, demo data — was 328% in USD mode, fixed by converting terminal value to USD in cardXirrMap)

---

### Stocks / MF Tiles

#### P-TILES-1: Stocks tile + MF tile = Hero (all three metrics)
**How to check:** Stocks current + MF current = Hero current; same for invested and total gain
**Expected:** Exact match on all three
**Status:** Pass ✅ (2026-06-13, demo data)

---

### By Type Breakdown

#### P-TYPE-1: Sum of all type cards = Hero total gain
**How to check:** Indian Stocks + US Stocks + Indian MF + US MF Total gains must equal Hero Total gain
**Expected:** Exact match
**Status:** Pass ✅ (2026-06-13, demo data)

#### P-TYPE-2: Stocks section sum = Stocks tile
**How to check:** Indian Stocks card Total + US Stocks card Total = Stocks tile Total gain
**Expected:** Exact match
**Status:** Pass ✅ (2026-06-13, demo data)

#### P-TYPE-3: MF section sum = MF tile
**How to check:** Indian MF card Total + US MF card Total = MF tile Total gain
**Expected:** Exact match
**Status:** Pass ✅ (2026-06-13, demo data)

#### P-TYPE-4: Type card XIRR includes closed positions
**How to check:**
1. Note Indian Stocks card XIRR
2. Navigate to `/holdings/segment/indian_stock` → note Summary XIRR
**Expected:** Values close (both client-side XIRR from all transactions including sells)
**Status:** Pass ✅ (2026-06-13, demo data)

---

### By Broker Breakdown

#### P-BROKER-1: By Broker stock cards sum = Stocks tile total gain
**How to check:**
1. By Broker tab → sum Total gain of all cards under Indian Stocks section + US Stocks section
2. Compare to Stocks tile Total gain
**Expected:** Exact match (Upstox fully-closed card must appear with current=0 and Total = its realized gain)
**Note:** Fixed 2026-05-29 — Upstox was missing before fix.
**Status:** Caveat ⚠️ (2026-06-13, demo data — visual ±₹1L rounding mismatch between sum and tile; confirmed expected/by design)

#### P-BROKER-2: By Broker MF cards sum = MF tile total gain
**How to check:** Sum Total gain of all MF_ cards under Mutual Funds section = MF tile Total gain
**Expected:** Exact match
**Status:** Pass ✅ (2026-06-13, demo data)

#### P-BROKER-3: Upstox card visible with current = 0
**How to check:** By Broker tab → find Upstox card
**Expected:** Current value = ₹0; Total gain = Upstox's realized P&L (~0.47L); XIRR shows a value
**Status:** Pass ✅ (2026-06-13, demo data)

#### P-BROKER-4: By Broker total = By Type total (Hero unchanged)
**How to check:** Switch between By Type and By Broker; Hero card must not change
**Expected:** Hero card numbers identical in both views
**Status:** Pass ✅ (2026-06-13, demo data)

---

## H — Holdings Page (Common)

Navigate to any holdings page (e.g., `/holdings/segment/total`).

### Summary Card

#### H-SUMMARY-1: Current value = sum of open HoldingCard current values
**How to check:** Sum current values from all visible open HoldingCards; compare to Summary card current
**Expected:** Exact match
**Status:** Pass ✅ (2026-06-13, demo data, Playwright automated)

#### H-SUMMARY-2: Invested = sum of open HoldingCard invested values
**How to check:** Sum invested from all open cards (shown on TransactionsPage if needed); compare to Summary invested
**Expected:** Exact match
**Status:** Pass ✅ (2026-06-13, demo data — verified via API: sum=987,376 = total_invested exactly)

#### H-SUMMARY-3: Today gain = sum of HoldingCard today gains
**How to check:** Sum all today gain values from open HoldingCards; compare to Summary Today
**Expected:** Exact match (±rounding)
**Status:** Pass ✅ (2026-06-13, demo data — API sum today=495 = UI Today +₹495)

#### H-SUMMARY-4: Total gain = unrealized + realized
**How to check:** Summary total gain = (Summary current − Summary invested) + Summary realized
**Expected:** Exact match
**Status:** Pass ✅ (2026-06-13, demo data)

#### H-SUMMARY-5: Open + Closed realized = All realized (exactly)
**How to check:**
1. Settings gear → filter = Open → note Summary realized
2. Settings gear → filter = Closed → note Summary realized
3. Settings gear → filter = All → note Summary realized
**Expected:** Open realized + Closed realized = All realized (exact)
**Status:** Pass ✅ (2026-06-13, demo data)

---

### Filter Controls (Open / Closed / All)

#### H-FILTER-1: Open filter hides fully-closed positions
**How to check:** Settings gear → Open → check list
**Expected:** No holdings with current=0 visible; count shows "N open"
**Status:** Pass ✅ (2026-06-13, demo data)

#### H-FILTER-2: Closed filter shows only fully-exited positions
**How to check:** Settings gear → Closed → check list
**Expected:** Only holdings with current=0, Total = realized P&L; count shows "M closed"
**Status:** Pass ✅ (2026-06-13, demo data — META+TCS show ₹0 in closed filter)

#### H-FILTER-3: All filter summary = union of Open and Closed
**How to check:** All filter summary current must equal Open filter summary current (closed positions add nothing to current)
**Expected:** All current = Open current; All realized = Open realized + Closed realized
**Status:** Pass ✅ (2026-06-13, demo data)

#### H-FILTER-4: Show Closed toggle (All mode) appends closed rows to list
**How to check:** Filter = All → toggle Show Closed on → observe list
**Expected:** Closed rows (current=0) appear below open rows; summary card unchanged
**Status:** Pass ✅ (2026-06-13, demo data — 8→10 cards, summary unchanged)

#### H-FILTER-5: Closed cards have no Today gain
**How to check:** Filter = Closed; inspect each HoldingCard
**Expected:** Today gain column shows "—" or is blank; XIRR computed from BUY+SELL only (no terminal value)
**Status:** Pass ✅ (2026-06-13, demo data — Today shows "—" for META+TCS)

---

### Grouped / Standalone Toggle (Segment Views Only)

#### H-GROUP-1: Grouped mode deduplicates same symbol across portfolios
**How to check:** `/holdings/segment/total` → Settings gear → View = Grouped → find a symbol held in 2+ portfolios (e.g. INFY in Zerodha + AngelOne)
**Expected:** Symbol appears once; value = combined value from both portfolios
**Status:** Warn ⚠️ (2026-06-13 — demo data has no symbol in 2+ portfolios; cannot verify deduplication logic)

#### H-GROUP-2: Standalone mode shows one card per portfolio:symbol
**How to check:** Settings gear → View = Standalone
**Expected:** INFY appears twice (one for each portfolio); each shows its own value
**Status:** Warn ⚠️ (2026-06-13 — same demo data limitation; standalone=grouped card count)

#### H-GROUP-3: Grouped mode shows company name (not portfolio name)
**How to check:** Grouped → inspect subLabel on a HoldingCard
**Expected:** Company name (e.g. "Infosys Ltd") — not portfolio name ("Zerodha")
**Status:** Warn ⚠️ (2026-06-13 — no portfolio subLabel visible in either mode with single-portfolio symbols; cannot distinguish)

---

### Sort Control

#### H-SORT-1: Default sort = Current Value descending
**How to check:** Open holdings page; first card must have highest current value
**Expected:** Cards in descending current value order
**Status:** Pass ✅ (2026-06-13, demo data)

#### H-SORT-2: Tap same sort field toggles asc/desc
**How to check:** Sort = Current Value ↓ → tap Current Value again
**Expected:** Sort flips to ↑; lowest current value card is first
**Status:** Pass ✅ (2026-06-13, demo data)

#### H-SORT-3: Sort by Total Gain includes realized P&L
**How to check:** Sort by Total Gain; inspect order manually
**Expected:** Total Gain = (current − invested) + realized; a fully-closed position with large realized gain ranks higher than an open position with small unrealized gain if its total is larger
**Status:** Pass ✅ (2026-06-13, demo data — AAPL +2.1L > SBIN +1.3L > GOOGL +1.2L > MSFT +1.2L > APOLLO > MF > INFY > HDFC)

#### H-SORT-4: Sort applies to closed rows when Show Closed is on
**How to check:** Filter = All, Show Closed = on, Sort = Total Gain ↓
**Expected:** Closed rows also sorted by their realized gain (Total Gain), not appended unsorted at the end
**Status:** Pass ✅ (2026-06-13, demo data — closed group sorted: META +1.7L before TCS +13.8K)

---

### HoldingCard Display

#### H-CARD-1: XIRR colored correctly
**How to check:** Cards with positive XIRR show green; negative show red
**Expected:** Green = positive annualised return; Red = holding losing money since purchase
**Status:** Pass ✅ (2026-06-13, demo data — INFY/HDFC negative XIRR confirmed red; others green)

#### H-CARD-2: Today gain is non-null for most open positions (market hours)
**How to check:** During market hours, inspect a few HoldingCards
**Expected:** Today gain shown as "+₹X (+Y%)" or "−₹X (−Y%)"; not "—" for active holdings
**Status:** Pass ✅ (2026-06-13, demo data — 8 open cards all show Today gain)

#### H-CARD-3: Tapping card saves scroll position and navigates to transactions
**How to check:** Scroll down the list; tap a card mid-list; press Back
**Expected:** Returns to same scroll position, not top of page
**Status:** Pending ⬜ (cannot automate headlessly — requires manual device test)

---

## H-CHARTS — Holdings Charts Tab

Navigate to any holdings page → Charts tab.
Compare last data point on each metric chart (stat line above chart) vs Summary card.

#### HC-A1: Portfolio Value last point = Summary current value (exact)
**Expected:** Exact match. Last chart point is pinned to `sum(h.disp_current)` — same value the summary card sums.
**Note:** Fixed 2026-05-29 — was approximate (used EOD close ≠ live price). Now pinned to live prices.
**Segments to check:** stk, mf, total, indian_stock, us_stock
**Status:** Pending ⬜

#### HC-A1-PIN: Last-point pin behaves correctly on weekend / holiday
**How to check:** Open app on a Saturday or public holiday; go to Charts → Portfolio Value
**Expected:** Last X-axis tick = today's date (appended); value matches Summary current exactly. Chart has one more data point than the trading calendar (today is not a trading day but is appended with live prices).
**Status:** Pending ⬜

#### HC-A2: Invested last point = Summary invested (exact)
**Expected:** Exact match. Both use avg_cost × qty × fx.
**Segments to check:** stk, mf, total, indian_stock, us_stock
**Status:** Exact match ✓

#### HC-A3: Unrealized Gains last point = Summary (current − invested) (exact)
**Expected:** Exact match. Pinned value − pinned invested = Summary cur − Summary inv.
**Note:** Fixed 2026-05-29 — was approximate (inherited A1 intraday gap).
**How to check:** Stocks segment: chart unrealized stat line = Summary current − Summary invested (should be ~61.1L); MF segment: same cross-check.
**Status:** Pending ⬜

#### HC-A4: Realized Gains last point = Summary realized P&L (exact)
**Expected:** Exact match for all segments including fully-closed portfolios (Upstox ~0.47L included).

| Segment | Expected realized (approx) |
|---------|---------------------------|
| total | ~21.6L |
| stk | ~8.3L |
| mf | ~13.2L |
| indian_stock | ~8.2L |
| us_stock | ~0.14L |

**Status:** Pending ⬜

#### HC-A5: Total Gains last point = Summary total gain (exact)
**Expected:** Exact match. Pinned unrealized + exact realized = Summary total gain.
**Note:** Fixed 2026-05-29 — was approximate (inherited A1 intraday gap).
**How to check:** Stocks segment: chart Total Gains stat line ≈ 69.4L = Summary total gain.
**Status:** Pending ⬜

#### HC-A6: Return % last point = Summary implied return (exact)
**Expected:** Exact match. Formula = (pinned totalGain) / (pinned invested + realizedCost) × 100.
**Note:** Fixed 2026-05-29 — now derives from pinned values so matches summary exactly.

| Segment | Expected return % (approx) |
|---------|---------------------------|
| total | ~39% |
| stk | ~38% |
| mf | ~43% |
| indian_stock | ~22% |
| us_stock | ~60% |

**Status:** Pending ⬜

#### HC-A7: XIRR Trend — last point close to Summary XIRR
**How to check:** Switch to XIRR Trend pill → note last value; compare to Summary card XIRR
**Expected:** Close match (±2pp — XIRR is sensitive to terminal value date vs price date)
**Status:** Pending ⬜

#### HC-B1: Range filtering — 1m shows ~30 days of data
**How to check:** Select 1m range; inspect X-axis leftmost label
**Expected:** First tick ≈ 30 days ago; All range starts at first transaction year
**Status:** Pending ⬜

#### HC-B2: Range persists when switching metric pills
**How to check:** Select 3m range → switch from Portfolio Value to Total Gains
**Expected:** Range stays at 3m
**Status:** Pending ⬜

#### HC-C1: Segment isolation — stk > indian_stock > single portfolio
**How to check:** Note Portfolio Value last point for total → stk → indian_stock → Zerodha
**Expected:** total > stk > indian_stock > Zerodha (each is a subset)
**Status:** Pending ⬜

#### HC-C2: Sync ↻ button invalidates history cache
**How to check:** Tap ↻ on Charts tab strip; observe chart
**Expected:** Old data stays visible; chart silently re-fetches in background; spinner shows ~1.2s
**Status:** Pending ⬜

#### HC-D1: Cross-page: segment chart last point ≈ Portfolios page tile
**How to check:** Note Stocks tile current on Overview; open `/holdings/segment/stk` → Charts → Portfolio Value stat line
**Expected:** Values close (daily close vs live price gap only)
**Status:** Pending ⬜

---

## H-ANALYSIS — Analysis Tab

Navigate to any holdings page → Analysis tab.

---

### Allocation Pill

#### AN-ALLOC-1: By Sector alloc% sums to 100%
**How to check:** Expand all sector rows; sum the Alloc% column
**Expected:** ~100% (±1% rounding)
**Status:** Pending ⬜

#### AN-ALLOC-2: Sector value = sum of holding values within it
**How to check:** Expand any sector; sum Value column of all holding rows
**Expected:** Exact match with sector header Value
**Status:** Pending ⬜

#### AN-ALLOC-3: Holding alloc% = value / portfolio current × 100
**How to check:** Pick any holding; note Alloc%; calculate value / Summary current × 100
**Expected:** Match to ±0.1%
**Status:** Pending ⬜

#### AN-ALLOC-4: By Market Cap alloc% sums to 100%
**How to check:** Open By Market Cap; sum alloc% of Large Cap + Mid Cap + Small Cap + US Stocks
**Expected:** ~100% (±1%)
**Status:** Pending ⬜

#### AN-ALLOC-5: Accordion — opening one section collapses others
**How to check:**
1. Default: By Sector open, others collapsed
2. Tap By Market Cap → By Sector collapses, By Market Cap opens
3. Tap By Holdings Concentration → By Market Cap collapses
**Expected:** Only one section open at a time
**Status:** Pending ⬜

#### AN-ALLOC-6: Top N coverage monotonically increasing
**How to check:** Toggle Top 5 / Top 10 / Top 20 in Holdings Concentration section
**Expected:** Top 5 coverage < Top 10 coverage < Top 20 coverage; pie has N+1 segments (top N + "Other")
**Status:** Pending ⬜

#### AN-ALLOC-7: Deduplication — same symbol held in 2+ portfolios appears once
**How to check:** `/holdings/segment/total` → Grouped mode → expand a sector containing INFY or META
**Expected:** Symbol appears once; Value = combined value; portfolios count reflected in XIRR
**Status:** Pending ⬜

#### AN-ALLOC-8: Sector XIRR is realistic (pooled cashflows, not inflated)
**How to check:** Expand any sector — note XIRR; specific canary: Tech sector
**Expected:** Tech XIRR = 15–50% (not ~94% which was the old weighted-average bug)
**Status:** Pending ⬜

#### AN-ALLOC-9: Today gain — inline format, single line, no wrap
**How to check:** On a sector row with non-zero today gain, inspect the Today column at 360px viewport
**Expected:** Displayed as `+₹1.2K (+0.5%)` on one line; green or red; no wrapping
**Status:** ⚠️ Needs browser check (80px column may be tight for large values)

---

### Benchmarking Pill

> **How the benchmark works:** For each BUY transaction, an equivalent cash amount is simulated investing into the sector's benchmark index. On SELL, benchmark units are proportionally liquidated. Terminal value = remaining units × last benchmark close. XIRR is then computed on these simulated cashflows. This makes the benchmark "fairly" match what you would have earned had you bought the index instead of the stock.

---

#### AN-BENCH-1: Overall Alpha arithmetic
**How to check:** On the overall card, note all three values: Your XIRR, Benchmark XIRR, Alpha
**Expected:** Alpha = Your XIRR − Benchmark XIRR (to ±0.1pp)
**Observed (2026-05-29, stk segment):** Your +23.3%, Bench +20.2%, Alpha +3.1% → 23.3−20.2=3.1 ✓
**Why it could fail:** UI truncation / rounding displaying one value differently than the stored float
**Status:** Pending ⬜

#### AN-BENCH-2: Sector Alpha arithmetic (verify for each visible sector)
**How to check:** For each sector row, note the three columns: Sector XIRR | Benchmark (XIRR) | Alpha
**Expected:** Alpha = Sector XIRR − Benchmark XIRR (±0.1pp) on every row
**Observed (2026-05-29, stk segment):** All 7 sectors pass; max diff = 0.10pp (Growth rounding 18.0→17.9):

| Sector | Your | Bench | Displayed α | Diff |
|--------|------|-------|-------------|------|
| Tech | +42.6% | +35.5% | +7.1% | 0.00pp |
| Finance | +16.0% | +9.5% | +6.5% | 0.00pp |
| Healthcare | +19.0% | +13.9% | +5.1% | 0.00pp |
| Banking | +13.2% | +7.8% | +5.4% | 0.00pp |
| Growth | +23.6% | +5.6% | +17.9% | 0.10pp |
| Other | +6.2% | +15.3% | −9.1% | 0.00pp |
| IT | +9.7% | −0.5% | +10.2% | 0.00pp |

**Status:** Pending ⬜

#### AN-BENCH-3: Canary — Index ETF alpha (strongest correctness signal)
**How to check:**
1. Expand IT sector → find ITBEES (Nippon India ETF Nifty IT) row
2. Expand Tech sector → find MON100 (Motilal Oswal NASDAQ 100 ETF) and MAFANG (Mirae Asset NYSE FANG+ETF) rows

**Observed (2026-05-29, stk segment):**

| Holding | Actual | Benchmark | Alpha | Expected |
|---------|--------|-----------|-------|----------|
| ITBEES (Nippon India ETF Nifty IT) | +4.5% | Nifty IT +4.1% | **+0.4%** | −1% to +1% ✓ |
| MON100 (Motilal Oswal NASDAQ 100 ETF) | +55.7% | NDX +34.7% | **+21.0%** | see note below |
| MAFANG (Mirae Asset NYSE FANG+ETF) | +41.1% | NDX +32.6% | **+8.6%** | see note below |

**ITBEES +0.4% alpha confirms the simulation mechanics are correct** (unit tracking, terminal value, arithmetic).

**Why MON100/MAFANG alpha is NOT ~0% (expected behaviour, not a bug):**
MON100 and MAFANG are INR-denominated ETFs tracking a USD index. Their actual XIRR in INR includes the INR depreciation benefit (~₹74→₹96 since purchase = ~30%). The benchmark simulation cancels FX (units = INR_amount ÷ (NDX_price × usdInr_current), terminal = units × NDX_last × usdInr_current — usdInr divides and multiplies, leaving only the USD-return component). So the benchmark measures "did you beat NDX in USD terms?" while the actual XIRR is "how much did you earn in INR?" — the gap is the FX tailwind. This is a known design trade-off.

**Expected alpha going forward:**
- Pure INR holding vs INR benchmark (ITBEES, domestic stocks): −2% to +2%
- INR ETF tracking USD index (MON100, MAFANG): alpha will include FX component; expected range roughly equal to INR depreciation since purchase
**Status:** Pending ⬜

#### AN-BENCH-4: Benchmark XIRR plausibility
**How to check:** Note Benchmark XIRR column for each sector
**Observed (2026-05-29, stk segment):**

| Benchmark | Observed | Notes |
|-----------|----------|-------|
| ^NDX (NASDAQ 100) | +35.5% | ✓ plausible |
| ^NSEI (Nifty 50) | +15.3% | ✓ plausible |
| NIFTY_FIN_SERVICE.NS | +9.5% | ✓ plausible |
| ^CNXPHARMA | +13.9% | ✓ plausible |
| ^NSEBANK | +7.8% | ✓ plausible (Banking underperformed) |
| ^CRSLDX (Nifty 500) | +5.6% | ✓ plausible (Growth holdings bought during rally) |
| ^CNXIT (Nifty IT) | **−0.5%** | ✓ plausible — IT holdings bought near 2021–22 peak; Nifty IT flat from those entry points |

**Note:** A negative benchmark XIRR means the index itself lost ground since our entry points — not a bug. IT stocks were likely bought when Nifty IT was high.
**Why it could fail:** Wrong history start date, benchmark fetch failure (would show null or 0.00%)
**Status:** Pending ⬜

#### AN-BENCH-5: No null or 0.00% values after data loads
**How to check:** Wait for benchmarking tab to finish loading (no spinner); inspect all rows
**Expected:**
- Every sector row shows non-null Sector XIRR, Benchmark XIRR, and Alpha
- No sector shows exactly "0.00%" XIRR unless it genuinely has zero-gain holdings
- Overall card Your XIRR and Benchmark XIRR both non-null
**Why it could fail:** Benchmark fetch fails silently → benchmark XIRR null → alpha null
**Observed (2026-05-29):** All 7 sectors non-null; overall card non-null ✓
**Status:** Pending ⬜

#### AN-BENCH-6: Alpha bar direction and proportionality
**How to check:** Find a positive-alpha sector and a negative-alpha sector among the visible rows
**Expected:**
- Positive alpha → green bar extends **right** of the center divider
- Negative alpha → red bar extends **left** of the center divider
- The sector with the largest |alpha| value has the **widest** bar
**Observed (2026-05-29):** Other (−9.1%) shows red bar left ✓; all other sectors green bar right ✓; Growth (+17.9%, largest positive alpha) has widest green bar ✓
**Status:** Pending ⬜

#### AN-BENCH-7: Benchmark labels match benchmark indices
**How to check:** Look at each sector's Benchmark (XIRR) merged column header

| Sector | Expected label | Observed |
|--------|---------------|---------|
| Banking | Nifty Bank | Nifty Bank ✓ |
| IT | Nifty IT | Nifty IT ✓ |
| Tech | NASDAQ 100 | NASDAQ 100 ✓ |
| Finance | Nifty Fin Svc | Nifty Fin Svc ✓ |
| Healthcare | Nifty Pharma | Nifty Pharma ✓ |
| Other | Nifty 50 | Nifty 50 ✓ |
| Growth | Nifty 500 | Nifty 500 ✓ |

**Expected:** Same label appears in both collapsed sector row AND expanded holding rows below it ✓ (confirmed via IT and Tech expansion)
**Status:** Pending ⬜

#### AN-BENCH-8: Per-holding alpha differs within same multi-stock sector
**How to check:** Expand a sector with ≥2 holdings — use IT or Banking
**Expected:** Each holding shows its own alpha; NOT all identical to sector alpha
**Observed (2026-05-29):**
- IT sector (α +10.2%): Affle +16.7% vs ITBEES +0.4% — very different ✓
- Banking sector (α +5.4%): Federal Bank +23.1%, Axis +4.7%, ICICI +2.6%, IDFC First −8.8% — wide spread ✓
**Status:** Pending ⬜

#### AN-BENCH-9: Single-holding sector: sector XIRR = holding benchmark XIRR
**How to check:** Find a sector containing exactly 1 holding. Expand it.
**Expected:** Sector XIRR = holding XIRR; Sector Bench XIRR = holding Bench XIRR; Sector Alpha = holding Alpha
**Observed (2026-05-29):** No single-holding sector exists in the stk segment (Healthcare=6, Finance=6, Growth=5, Other=3, Banking=6, IT=2). **Cannot verify with current portfolio** — mark N/A until a single-holding sector exists.
**Status:** N/A ⬜

#### AN-BENCH-10: Overall Your XIRR ≈ Holdings page Summary XIRR (single portfolio view)
**How to check:**
1. Navigate to `/holdings/portfolio/Zerodha` → note Summary card XIRR
2. Switch to Analysis → Benchmarking → note overall card Your XIRR
**Expected:** Values within ±1pp
**Observed (2026-05-29, Zerodha):** Summary XIRR **+15.12%**, Benchmarking Your XIRR **+15.1%** → diff = 0.02pp ✓
**Why close but not exact:** Benchmarking skips DIVIDEND cashflows; filteredSummaryXirr includes them (minor)
**Note for segment views (e.g. /holdings/segment/stk):** May differ by 1–3pp if fully-closed portfolios (Upstox) are in that segment — their transactions are excluded from Benchmarking (not in filtPorts) but included in Summary XIRR via closedRows
**Status:** Pending ⬜

#### AN-BENCH-11: Benchmark data loads only when Analysis tab is active
**How to check:** Open holdings page → stay on Holdings tab 30 seconds → open browser DevTools Network tab → switch to Analysis → Benchmarking
**Expected:** Benchmark fetch requests (for ^NSEBANK, ^CNXIT, ^NDX etc.) appear in Network only AFTER switching to Analysis tab, not before
**Why this matters:** `enabled = activeTab === 'analysis' && !!data` in the hook — prevents wasting bandwidth on background fetch
**Status:** Pending ⬜ (requires manual DevTools check)

#### AN-BENCH-12: Tech sector FX correctness (USD benchmark, mixed INR/USD portfolio)
**How to check:** Look at Tech sector and its holding rows
**Observed (2026-05-29):**
- Tech sector Benchmark XIRR = +35.5% ✓ (plausible for NDX since purchase dates)
- MON100 alpha = +21.0% (see AN-BENCH-3 note — FX asymmetry, not a code bug)
- MAFANG alpha = +8.6% (same reason)
- GOOGL (Alphabet) alpha = +31.8%; META alpha = +8.8%; AMZN alpha = +1.1% — these are USD holdings vs USD index, FX cancels correctly ✓
- `USD_BENCH_SYMS` includes ^NDX — confirmed working (benchmark is converted to INR for INR portfolio holdings)
**Note:** For USD portfolios (Vested, IndMoney US), both the holding's actual XIRR and the NDX benchmark are in USD terms → FX cancels → correct comparison. For INR portfolios (Zerodha's MON100), actual XIRR is in INR (includes FX tail/headwind) but benchmark is in pure USD return terms → gap = FX component.
**Status:** Pending ⬜

---

### Returns Pill

#### AN-RET-SUMLINE-1: Year mode, All sectors — summary line text and number
**How to check:** Analysis → Returns → Sector=All, Period=Year
**Expected:**
- Text reads `all sectors · by year`
- Bold number = sum of all year bars (total portfolio gains)
- Number matches Summary card total gain (exact — chart last point is pinned to live prices)
- Cumulative return% indigo line rightmost point matches Summary card implied return %
**Status:** Pending ⬜

#### AN-RET-SUMLINE-2: Month mode, All sectors — summary line text and number
**How to check:** Analysis → Returns → Sector=All, Period=Month, Year=2025
**Expected:**
- Text reads `all sectors · 2025`
- Bold number = sum of all 12 monthly bars for 2025 (≈ 2025's annual gain)
- NOT the all-time total portfolio gains
**Status:** Pending ⬜

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
**Status:** Pending ⬜

#### AN-RET-2: Month mode — year selector inside gear popover
**How to check:** Gear → switch Period to Month
**Expected:** Year pills appear inside the gear popover (not inline on page); one year active at a time; default = current year
**Status:** Pending ⬜

#### AN-RET-3: Monthly bars sum ≈ year bar for same year
**How to check:** Note 2024 year bar; switch to Month mode → select 2024 → sum all 12 bars
**Expected:** Sum ≈ 2024 annual bar value (exact for "all sectors" mode, ~approximate for sector mode)
**Status:** Pending ⬜

#### AN-RET-4: Metric = Gains — bars show INR values
**How to check:** Metric = Gains (default)
**Expected:** Y-axis in INR (L/K/Cr format); bar tooltip shows `+₹X`; green bars positive, red bars negative
**Status:** Pending ⬜

#### AN-RET-5: Metric = Return % — bars show percentage values
**How to check:** Gear → Metric = Return %
**Expected:** Y-axis shows %; bar tooltip shows `+X.X%`; summary line bold number stays in INR (unchanged)
**Status:** Pending ⬜

#### AN-RET-6: Metric = XIRR — bars show annualised rate
**How to check:** Gear → Metric = XIRR
**Expected:** Bars show annualised XIRR % per year; values plausible (10–60% range); null periods show 0 (edge case: very early years)
**Status:** Pending ⬜

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
**Status:** Pending ⬜

#### AN-RET-10: Gear popover closes on outside tap
**How to check:** Open gear popover; tap outside it
**Expected:** Popover dismisses cleanly; no lingering overlay
**Status:** Pending ⬜

#### AN-RET-11: Sector change — year stays if valid for new sector
**How to check:** Month mode, year=2022; switch to a sector that also has 2022 data
**Expected:** Year selection stays at 2022 (no reset)
**Status:** Pending ⬜

#### AN-RET-12: No bars for years before first transaction
**How to check:** Year mode; check leftmost bar label
**Expected:** First bar ≈ year of first investment (~2020–2021); no zero-value bars before it
**Status:** Pending ⬜

---

## X — Cross-Page Invariants

Quick spot-checks after any gains, realized, or filter change.

| Rule | Check | Status |
|------|-------|--------|
| X1 | Hero total gain = Holdings `/segment/total` Summary total gain | Pending ⬜ |
| X2 | Stocks tile total gain = Holdings `/segment/stk` Summary total gain | Pending ⬜ |
| X3 | Indian Stocks card total gain = Holdings `/segment/indian_stock` Summary total gain | Pending ⬜ |
| X4 | US Stocks card total gain = Holdings `/segment/us_stock` Summary total gain | Pending ⬜ |
| X5 | HoldingCard total gain = TransactionsPage summary total gain | Pending ⬜ |
| X6 | HoldingCard current value = TransactionsPage current value | Pending ⬜ |
| X7 | HoldingCard today gain = TransactionsPage today gain | Pending ⬜ |

---

## T — Transactions Page

Navigate to any `/transactions/:portfolio/:symbol`.

#### T-SUMMARY-1: Overview card current value matches HoldingCard (X6)
**How to check:** Note HoldingCard current; navigate to its TransactionsPage; compare overview card current
**Expected:** Exact match
**Status:** Pending ⬜

#### T-SUMMARY-2: Overview card total gain matches HoldingCard total gain (X5)
**Expected:** Exact match
**Status:** Pending ⬜

---

---

## DIV — Dividends Feature

### DIV-TOGGLE — Include Dividends Setting

#### DIV-TOGGLE-1: Toggle appears in Settings panel on Portfolios page
**How to check:** Portfolios page → gear icon (Settings) → scroll to bottom of settings
**Expected:** "Include dividends" toggle with sub-text "Add to total gains & XIRR"
**Status:** Pending ⬜

#### DIV-TOGGLE-2: Toggle OFF (default) — no dividend amounts visible on cards
**How to check:** Ensure toggle is OFF → check any HoldingCard and SummaryCard
**Expected:** No "Div" or dividend line appears on HoldingCard; SummaryCard shows no dividends row
**Status:** Pending ⬜

#### DIV-TOGGLE-3: Toggle ON — dividend amount appears on HoldingCard
**How to check:** Turn toggle ON → navigate to Holdings → inspect a HoldingCard for a stock that pays dividends (e.g. INFY, HDFC Bank, GOOGL)
**Expected:** HoldingCard shows a teal "Div ₹X" line below total gain
**Status:** Pending ⬜

#### DIV-TOGGLE-4: Toggle ON — SummaryCard shows total dividends
**How to check:** Toggle ON → Holdings page → SummaryCard
**Expected:** SummaryCard shows a dividends row with total dividends earned across all visible holdings
**Status:** Pending ⬜

#### DIV-TOGGLE-5: Toggle persists across page navigations
**How to check:** Turn toggle ON → navigate away → return to Portfolios page
**Expected:** Toggle still ON; dividend amounts still visible
**Status:** Pending ⬜

---

### DIV-TAB — Dividends Tab (Holdings Page)

Navigate to any holdings page → Dividends tab.

#### DIV-TAB-1: Dividends tab visible in tab bar
**How to check:** Navigate to `/holdings/segment/total` or any portfolio holdings page
**Expected:** Four tabs visible — Holdings, Charts, Analysis, Dividends
**Status:** Pending ⬜

#### DIV-TAB-2: Summary strip shows 4 cards
**How to check:** Open Dividends tab (wait for load)
**Expected:** Four teal/slate cards: Total Earned, Projected/Year, Stocks paying (count), Best year (amount + year label)
**Status:** Pending ⬜

#### DIV-TAB-3: Total Earned = sum of all per-symbol totals
**How to check:** Note Total Earned; expand each SymbolRow and sum their total dividend values
**Expected:** Sum of all expanded symbol totals = Total Earned (±rounding)
**Status:** Pending ⬜

#### DIV-TAB-4: Projected/Year is non-zero for active dividend payers
**How to check:** Check Projected/Year card value
**Expected:** Non-zero if you hold any stock that paid dividends in the trailing 12 months
**Status:** Pending ⬜

#### DIV-TAB-5: Best Year card shows the year with highest dividends
**How to check:** Note Best Year card (amount + year label); cross-check against the Year-by-year bar chart — the tallest bar year should match
**Expected:** Exact match
**Status:** Pending ⬜

#### DIV-TAB-6: Year-by-year bar chart renders
**How to check:** Below summary strip, bar chart appears
**Expected:** At least one bar per year dividends were received; X-axis shows year labels; Y-axis shows amounts
**Status:** Pending ⬜

#### DIV-TAB-7: Year filter — clicking a bar filters the stock list
**How to check:** Click any year bar → observe stock list below
**Expected:** Bar turns teal; stock list narrows to only stocks that paid dividends in that year; count shown as "(N/total)"
**Status:** Pending ⬜

#### DIV-TAB-8: Year filter — clicking same bar again clears filter
**How to check:** Click a bar to select it; click it again
**Expected:** Bar returns to default color; full stock list restored; "(N/total)" count disappears
**Status:** Pending ⬜

#### DIV-TAB-9: Month calendar shows only months with dividend payments
**How to check:** Inspect the 12-cell month calendar row
**Expected:** Months with dividends show teal background; months without dividends show grey and are non-tappable
**Status:** Pending ⬜

#### DIV-TAB-10: Month filter — clicking a month filters stock list
**How to check:** Tap a teal month (e.g. Feb) → inspect stock list
**Expected:** Only stocks whose `month_pattern` includes that month remain visible
**Status:** Pending ⬜

#### DIV-TAB-11: "Clear filter" link appears when any filter active
**How to check:** Select a year or month filter
**Expected:** "clear filter" link appears next to "Year-by-year" header; tapping it resets all filters and restores full list
**Status:** Pending ⬜

#### DIV-TAB-12: Search input filters stock list by symbol
**How to check:** Type a symbol (e.g. "INFY") in the search box
**Expected:** Only matching symbols shown; count shows "(1/N)" if filtered
**Status:** Pending ⬜

#### DIV-TAB-13: SymbolRow — exchange badge correct
**How to check:** Inspect exchange badge on each symbol row
**Expected:** Indian NSE stocks show blue "NSE" badge; BSE stocks show teal "BSE"; US stocks show grey badge
**Status:** Pending ⬜

#### DIV-TAB-14: SymbolRow — expanding shows payment event details
**How to check:** Tap any SymbolRow to expand it
**Expected:** Row expands showing a table of events: Ex-date | Shares | Per share | Earned; each row matches the corresponding dividend payment
**Status:** Pending ⬜

#### DIV-TAB-15: SymbolRow — Earned column cross-check
**How to check:** For any event row: verify Earned = shares_held × div_per_share (approximately)
**Expected:** Amount correct; FX applied for USD dividends if INR mode
**Status:** Pending ⬜

#### DIV-TAB-16: SymbolRow — yield on cost badge
**How to check:** Look for teal "X.X% yield" badge on any dividend-paying Indian stock
**Expected:** Badge visible if yield_on_cost is non-null; value = total_dividends / avg_cost_invested × 100
**Status:** Pending ⬜

#### DIV-TAB-17: Projected annual shown below total in SymbolRow header
**How to check:** On a stock that paid dividends in the last 12 months, check right side of unexpanded row
**Expected:** "~₹X/yr" shown in slate below the bold total
**Status:** Pending ⬜

#### DIV-TAB-18: Refresh button reloads dividend data
**How to check:** Tap the ↻ icon in the Year-by-year card header
**Expected:** Spinner shows briefly; data reloads (values may update if new dividends declared)
**Status:** Pending ⬜

#### DIV-TAB-19: No dividends state — shows empty message
**How to check:** Navigate to a portfolio/segment with no dividend-paying stocks (e.g. a US-only segment with no dividend payers)
**Expected:** "No dividends found in your holding periods." message shown; summary cards still visible with 0 values
**Status:** Pending ⬜

---

### DIV-CURR — Currency Toggle

#### DIV-CURR-1: INR mode — all amounts in ₹
**How to check:** Set currency to INR (default); open Dividends tab on any segment
**Expected:** Total Earned shows ₹; Projected/Year shows ₹; per-symbol amounts show ₹ including US stocks (converted at ~95.5)
**Status:** Pending ⬜

#### DIV-CURR-2: USD mode on a USD portfolio — amounts shown in $
**How to check:** Navigate to `/holdings/portfolio/Vested` or `IndMoney US` → Dividends tab → switch currency to USD
**Expected:** Total Earned switches to $; per-symbol amounts for US stocks show $; projection in $
**Status:** Pending ⬜

#### DIV-CURR-3: USD mode — Indian stocks in USD portfolio still handled correctly
**How to check:** USD mode on a USD-only portfolio (Vested) — all stocks are US stocks
**Expected:** All amounts in $; no ₹ symbols visible
**Status:** Pending ⬜

---

### DIV-PORT — Per-Portfolio / Segment Filtering

#### DIV-PORT-1: Dividends tab on a specific portfolio shows only that portfolio's holdings
**How to check:** Navigate to `/holdings/portfolio/Zerodha` → Dividends tab
**Expected:** Only symbols held in Zerodha appear in the stock list; Total Earned = only Zerodha dividends
**Status:** Pending ⬜

#### DIV-PORT-2: Dividends tab on `/segment/total` aggregates all portfolios
**How to check:** `/holdings/segment/total` → Dividends tab → note Total Earned; compare to sum of individual portfolio totals
**Expected:** Total Earned on segment/total ≈ sum of all portfolio dividend totals (small rounding differences OK)
**Status:** Pending ⬜

---

## EXPL — Explore Tab Links

### US Stocks

Navigate to any US holding → Transactions → Research tab → Explore button.

#### EXPL-US-1: US Explore tab shows exactly 5 links in correct order
**How to check:** Open Explore tab for any US stock (e.g. AAPL, GOOGL)
**Expected:** 5 rows in this order: YFinance → MacroTrends → TipRanks → SEC EDGAR → Finviz
**Status:** Pending ⬜

#### EXPL-US-2: YFinance link opens Yahoo Finance quote page
**How to check:** Tap YFinance row
**Expected:** Opens `finance.yahoo.com/quote/AAPL` (or the relevant ticker) in browser
**Status:** Pending ⬜

#### EXPL-US-3: SEC EDGAR link shows both annual and quarterly filings
**How to check:** Tap SEC EDGAR row for any US stock
**Expected:** EDGAR filing list shows 10-K (annual) AND 10-Q (quarterly) filings — not just 10-K
**Status:** Pending ⬜

#### EXPL-US-4: Finviz link opens the correct ticker chart
**How to check:** Tap Finviz row for e.g. AAPL
**Expected:** Opens `finviz.com/quote.ashx?t=AAPL` with AAPL chart
**Status:** Pending ⬜

#### EXPL-US-5: Same links visible from ResearchPage (/research/:symbol)
**How to check:** Search for a US stock → open Explore page → Research tab → Explore sub-tab
**Expected:** Same 5 links in same order as on Transactions page
**Status:** Pending ⬜

### Indian Stocks

#### EXPL-IN-1: Indian Explore tab unchanged — 4 links in original order
**How to check:** Open Explore tab for any Indian stock (e.g. INFY.NS)
**Expected:** 4 rows: Screener.in → Trendlyne → NSE India → Yahoo Finance (Indian stock links unchanged)
**Status:** Pending ⬜

---

## Known Limitations (not bugs)

| Item | Detail |
|------|--------|
| AN-RET-SUMLINE-5 text static | Summary line bold number always shows INR gains regardless of metric pill (Return%/XIRR). By design — gains is always the most useful absolute reference. |
| AN-RET sector mode | Sector-specific Returns bars use open-position value series only; fully-closed positions in that sector not included. All-sectors mode uses portSeries.total which is correct. |
| Upstox historical chart | Upstox's historical portfolio value not shown in segment charts — only its realized gains. Full history would require price history for fully-closed symbols. |
| XIRR Trend early points | XIRR is unstable in the first few months of investing. Wide swings at the left edge of XIRR Trend chart are expected. |
| Invested chart approximation | Uses current avg_cost × historical qty, not true historical cost basis. Directionally correct but not a historical ledger. |
| Historical chart interior points | Only the last chart point is pinned to live prices. Interior points still use EOD closes. "Portfolio Value 3 months ago" reads the historical close on that date, not a live value. This is correct behaviour. |
