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
| **Buckets & Labels (user-defined classification)** | `frontend/src/utils/buckets.ts`, `frontend/src/components/ManageBucketsModal.tsx`, `frontend/src/hooks/useSetTags.ts` | `backend/routers/add_txn.py` (`set_tags` endpoint), `src/portfolio.py`/`src/price_fetcher.py` (`tags`/`quote_type` fields) |
| **Manage Portfolio menu (Add/Delete/Copy landing)** | `frontend/src/components/ManagePortfolioModal.tsx` | — |
| **Delete Holding modal** | `frontend/src/components/DeleteHoldingModal.tsx` | `backend/routers/add_txn.py` (`delete-holding` endpoint) |
| **Copy Holdings modal** | `frontend/src/components/PullHoldingsModal.tsx` | `backend/routers/add_txn.py` (`set_tags` endpoint) |
| **Currency/skip-portfolio helpers (USD_PORTS/SKIP_PORTS only)** | `frontend/src/utils/segments.ts` | — |
| **Sectors / benchmark** | `frontend/src/utils/sectors.ts` | `frontend/src/hooks/useBenchmarkXirr.ts` |
| **XIRR calculation** | `frontend/src/utils/xirr.ts` | `src/xirr.py` |
| **Formatting helpers** | `frontend/src/utils/fmt.ts` | — |
| **Gemini API types/client** | `frontend/src/api/gemini.ts` | `backend/routers/gemini.py` |
| **Settings popover / CSV upload** | `frontend/src/pages/PortfoliosPage.tsx` | `backend/routers/portfolio.py` |
| **BSE filings** | — | `backend/routers/filing.py` |
| **Symbol search autocomplete** | `frontend/src/pages/PortfoliosPage.tsx` | `backend/routers/search.py` |
| **Notes (any page)** | `frontend/src/components/AnalysisTab.tsx` | — |
| **Add transaction flow** | `frontend/src/components/AddTransactionModal.tsx`, `frontend/src/hooks/useAddTransaction.ts` | `backend/routers/add_txn.py` |
| **Dividends tab** | `frontend/src/components/DividendsTab.tsx`, `frontend/src/hooks/useDividends.ts`, `frontend/src/api/dividends.ts` | `backend/routers/dividends.py` |
| **FX / currency gains tab** | `frontend/src/components/FxGainsTab.tsx` | — |
| **Portfolio aggregate chart (sum across holdings)** | `frontend/src/hooks/usePortfolioHistory.ts` | `backend/routers/history.py` (same `/api/history` endpoint as single-holding charts, called once per symbol then summed client-side) |
| **Realized gain calc** | `frontend/src/utils/realized.ts` | — |
| **Research Links pills (Screener/Finviz etc.)** | `frontend/src/utils/reportLinks.ts` | — |
| **Loading skeletons** | `frontend/src/components/LoadingSkeleton.tsx` | — |
| **Debug overlay (🐛 panel, active per user request)** | `frontend/src/components/DebugOverlay.tsx`, `frontend/src/utils/debugLog.ts` (mounted in `App.tsx`) | — |
| **App boot / IndexedDB hydration gate** | `frontend/src/main.tsx` (awaits `idbReady` before first render) | — |
| **Market hours / open-closed check** | — | `backend/market_hours.py` |
| **Raw data loading / CSV schema** | — | `src/data_loader.py`, `src/schema.py` |
| **API response shaping** | — | `backend/serializers.py` |

## Caching & Storage Layer (check here first for "stale/short/wrong data" bugs)

| Layer | File | Notes |
|---|---|---|
| Frontend shared KV cache | `frontend/src/utils/idbStore.ts` | Single IndexedDB store backing `hist:*`, `qs:*`, `dividends:cache:*`, `gemini:*` keys. Hydrates into an in-memory `Map` once at boot (`idbReady`, awaited in `main.tsx`). All reads after boot are synchronous against the Map — a value only shows up post-boot if `idbSet` was called, not just written to IndexedDB directly. |
| Chart history cache (frontend) | `frontend/src/hooks/useHistory.ts` (`lsGet`/`lsSet`, prefix `hist:`) | Sends the last cached date as `since` to request a delta instead of full history. `mergeHistory()` only merges if the backend response carries `partial_since` — otherwise it **replaces** the cache. A missing `partial_since` flag on a real delta response is exactly what caused the 2026-06-19 flat-line/dot chart bug. |
| Chart history cache (backend, resident) | `backend/routers/history.py` (`_series_cache`) | Trimmed to last `_RETENTION_DAYS` (15) per symbol to control RAM (session 139 OOM fix). Persisted to disk at `data/.hist_cache.pkl`, but disk is ephemeral across Render deploys — a fresh deploy starts with an empty resident cache. The frontend's IndexedDB is the actual long-term store for deep history, not this. |
| PWA / service worker | `frontend/vite.config.ts` (`VitePWA` / workbox) | Precaches only static build assets (`js/css/html/svg/png/ico`) — **no `runtimeCaching` for `/api/*`**, so API responses are never served from the service worker cache. Rule out SW caching quickly by checking this file has no `runtimeCaching` block before suspecting it. |
| Browser HTTP cache | n/a — check response headers | `backend/routers/history.py` doesn't set explicit `Cache-Control`; Cloudflare in front of Render shows `cf-cache-status` header (`DYNAMIC` = not edge-cached). Use `curl -D -` against the live Render URL to check headers/cache status directly without needing the user's browser. |
| Other localStorage (not yet migrated) | grep `localStorage` directly if a key isn't one of the `idbStore.ts` prefixes above | Most caches moved to IndexedDB in the OOM fix (session 139) — if investigating a cache bug, confirm which store (localStorage vs IndexedDB) the key actually lives in before assuming. |
| Benchmark index history cache | `frontend/src/hooks/useBenchmarkXirr.ts` (`bench:` prefix in idbStore) | Added session 150 — previously had zero persistence (full re-fetch from 2015 on every reload). Now mirrors the Charts/Dividends pattern: IndexedDB-backed, incremental `since`/`partial_since` fetch, real `lastFetchedAt` exposed instead of `new Date()`. |
| Installed PWA storage (Android) | n/a | On Android, an installed PWA (home-screen icon / WebAPK) has storage separate from Chrome's own "Site settings → Clear site data." Must clear via **Android Settings → Apps → [app name] → Storage & cache → Clear storage** instead. Confirmed 2026-06-19: chart-truncation bug looked unfixed on phone after clearing Chrome site storage, resolved once app-level storage was cleared. |

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
