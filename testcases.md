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

## Known Limitations (not bugs)

| Item | Detail |
|------|--------|
| A1/A3/A5 chart gap | Chart uses last daily close; Summary uses live price. Gap = today's intraday move. Closes to zero after market close. |
| Upstox historical chart | Upstox's historical portfolio value (before positions were closed) is not shown in segment charts — only its realized gains are included. Full historical value would require fetching price history for fully-closed symbols. |
| XIRR Trend early points | XIRR is unstable in the first few months of investing. Wide swings at the left edge of XIRR Trend chart are expected. |
| Invested chart approximation | Uses current avg_cost × historical qty, not true historical cost basis. Chart shows what you would have invested at your current avg_cost — useful directionally but not a historical ledger. |
