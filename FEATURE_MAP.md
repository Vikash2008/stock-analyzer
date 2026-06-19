# FEATURE_MAP.md — Feature → File Lookup

> Always-loaded at session start. Use this to find the right file instantly — no exploration needed.
> When user says "Working on: X", look up X here and cache those files for the session.

## Feature → File Map

| Feature / Area | Frontend file(s) | Backend file(s) |
|---|---|---|
| **Deep Research cards** | `frontend/src/components/ReportTab.tsx` | `backend/routers/gemini.py` |
| **AI Assistant chat** | `frontend/src/components/DeepResearchChat.tsx` | `backend/routers/gemini.py` |
| **Quick Stats grid** | `frontend/src/components/ReportTab.tsx` | `backend/routers/quickstats.py` |
| **Explore / Research page** | `frontend/src/pages/ResearchPage.tsx` | `backend/routers/quickstats.py`, `backend/routers/search.py` |
| **Transactions page** | `frontend/src/pages/TransactionsPage.tsx` | — |
| **Holdings page** | `frontend/src/pages/HoldingsPage.tsx` | — |
| **Portfolio home page** | `frontend/src/pages/PortfoliosPage.tsx` | `backend/routers/portfolio.py` |
| **Price chart** | `frontend/src/components/PriceChart.tsx` | `backend/routers/history.py` |
| **Zoom overlay** | `frontend/src/components/ZoomChartOverlay.tsx` | — |
| **Benchmarking tab** | `frontend/src/pages/HoldingsPage.tsx` | `frontend/src/hooks/useBenchmarkXirr.ts` |
| **Allocation tab** | `frontend/src/pages/HoldingsPage.tsx` | — |
| **Holding card** | `frontend/src/components/HoldingCard.tsx` | — |
| **Summary card** | `frontend/src/components/SummaryCard.tsx` | — |
| **TxRow (transaction row)** | `frontend/src/components/TxRow.tsx` | — |
| **Portfolio data fetch** | `frontend/src/hooks/usePortfolio.ts`, `frontend/src/api/portfolio.ts` | `backend/routers/portfolio.py` |
| **History / chart data** | `frontend/src/hooks/useHistory.ts`, `frontend/src/hooks/usePortfolioHistory.ts` | `backend/routers/history.py` |
| **FIFO / P&L logic** | — | `src/portfolio.py` |
| **Price fetching / cache** | — | `src/price_fetcher.py`, `src/cache.py` |
| **Portfolio bundle build** | — | `src/engine.py` |
| **API routing** | — | `backend/main.py` |
| **Segments / classification** | `frontend/src/utils/segments.ts` | `src/classify.py` |
| **Sectors / benchmark** | `frontend/src/utils/sectors.ts` | `frontend/src/hooks/useBenchmarkXirr.ts` |
| **XIRR calculation** | `frontend/src/utils/xirr.ts` | `src/xirr.py` |
| **Formatting helpers** | `frontend/src/utils/fmt.ts` | — |
| **Gemini API types/client** | `frontend/src/api/gemini.ts` | `backend/routers/gemini.py` |
| **Settings popover / CSV upload** | `frontend/src/pages/PortfoliosPage.tsx` | `backend/routers/portfolio.py` |
| **BSE filings** | — | `backend/routers/filing.py` |
| **Symbol search autocomplete** | `frontend/src/pages/PortfoliosPage.tsx` | `backend/routers/search.py` |
| **Notes (any page)** | `frontend/src/components/AnalysisTab.tsx` | — |

## Hot-Spot Line Anchors (oversized files)

> `HoldingsPage.tsx` (2472 lines) and `PortfoliosPage.tsx` (1289 lines) are too big to read in full for a targeted fix. Grep the symbol first to confirm the line hasn't moved, then `Read` with `offset`/`limit` around the anchor — don't read the whole file.

**HoldingsPage.tsx**
| Section | ~Line |
|---|---|
| Component start / state (activeTab etc.) | 190–230 |
| Allocation tab logic | 442 |
| Benchmarking logic (benchTxns etc.) | 634 |
| Settings / gear popover | 1313 |
| Tab bar + tab switch | 1369–1392 |
| Holdings tab content | 1413–1532 |
| Charts tab content | 1392, 1570 |
| Analysis tab (Allocation/Benchmarking/Returns sub-tabs) | 1503–1726 |
| Dividends tab | 2416 |
| FX tab | 2419 |

**PortfoliosPage.tsx**
| Section | ~Line |
|---|---|
| BreakCard component | 161 |
| Main component start | 227 |
| Explore New Holdings search | 393–433 |
| Stocks/MF tile XIRR computation | 494–613 |
| Settings / gear popover | 867 |
| Currency toggle | 1018 |
| Hero card | 1057 |
| Card rendering loop | 1191 |
| Explore FAB + modal | 1200–1243 |

## Usage Rule

```
User prompt: "UI fix / Deep Research / Sources button overlaps model name"
→ Look up "Deep Research cards" → frontend/src/components/ReportTab.tsx
→ Read that file → make change. Done. No exploration.

User prompt: "Working on: Quick Stats for next few changes"  
→ Cache: ReportTab.tsx + quickstats.py in session context
→ All follow-up Quick Stats prompts: go directly to these files, no re-read
→ Evict only when user says "Quick Stats done" or "moving on"
```
