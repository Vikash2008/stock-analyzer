# ROADMAP.md â€” Stock Analyzer

> Prioritized backlog. Update this at the end of every session that adds, fixes, or drops an item.
> Status: `pending` | `in-progress` | `done`

---

## Phase 4 â€” Data Accuracy & Charts

| # | Item | What's needed | Status |
|---|------|---------------|--------|
| 1 | Fix P&L and realized values showing wrong numbers | SKIP_PORTS excluded from totals; realized included in portfolio/segment cards | done |
| 2 | XIRR at portfolio + segment level | Bundle now carries xirr_total, xirr_stk, xirr_mf, xirr_by_portfolio | done |
| 2b | XIRR per individual holding card | Client-side per-symbol computation; also on Overview BreakCards | done |
| 3 | HoldingsPage â€” Charts tab | 7 line charts (Value, Invested, Unrealized, Realized, Total, Return%, XIRR Trend); client-side computation via usePortfolioHistory | done |
| 4 | SummaryPage removed | Unreachable dead page â€” deleted | done |

---

## Backlog â€” Benchmarking Accuracy

| # | Item | Notes | Status |
|---|------|-------|--------|
| 1 | UI 2pp alpha gap | Root cause found: debug_benchmark.py was including MON100/MAFANG (us_stock ETFs in Zerodha) in Indian stocks pool, inflating debug actual XIRR by ~4pp. UI correctly excludes them via getSegmentType. Fixed debug script with US_ETF_SYMS filter. UI 3.1% alpha is the correct Indian-stocks-only figure. | done |

---

## Backlog â€” Cold Start UX

| # | Item | Notes | Status |
|---|------|-------|--------|
| 1 | Keep-alive ping (GitHub Actions cron) | Add `.github/workflows/keepalive.yml` â€” pings backend every 14 min so Render free tier never sleeps. Risk: against Render ToS spirit; GitHub private repo = 500 min/month free (est. ~150â€“200 min/month used). Cron jitter may cause occasional miss. | done |
| 2 | Returns tab per-period gains â€” use portSeries.total | sectorValueSeries only tracks open positions; closed positions create mismatch. Fix: for "All Sectors" use portSeries.total differences (same series Charts tab uses â€” already correct). For specific sectors: needs discussion â€” may require price history for sold positions or a different approach. | done |

> Note: Render free tier spin-down (15 min idle) is not configurable. Paid Starter plan ($7/month) gives always-on. For now, keep-alive + UI messaging is the free solution.

---

## Backlog — Report Tab Redesign

| # | Item | Notes | Status |
|---|------|-------|--------|
| 1 | Report tab — Section 1 fundamentals grid | 4×4 grid (Valuation/Returns/Growth/Context); Screener.in data source; PEG fallback; D/E; Rev 1Y/3Y; EPS 1Y/3Y; ↻ sync + progress bar; PE History chart | done |
| 2 | Report tab — Revenue Segments Perplexity card | Direct search query (no doc URL); `site:nsearchives.nseindia.com` for Indian; table format instruction; PDF reading limitation noted | done |
| 7 | Report tab — Gemini 2.5 Flash inline answers | Perplexity replaced; POST /api/gemini with Google Search grounding; react-markdown rendering; elapsed timer; force-refresh on ↻; localStorage cache per section | done |
| 5 | Report tab — Section 2 Research Links | Screener/Trendlyne/NSE pills for Indian; Finviz/Macrotrends/EDGAR for US | done |
| 8 | Deep Research — 8-card redesign | Card 1: Business Overview & Moat; Card 2: Industry Outlook & Macro; Card 3: Latest Earnings & Guidance; Card 4: Valuation Metrics; Card 5: Peer Comparison Matrix; Card 6: Financial Health & Trends; Card 7: News, Sentiment & Red Flags; Card 8: Technical Analysis Setup | done |

---

## Backlog — Explore & Deep Research

| # | Item | Notes | Status |
|---|------|-------|--------|
| 1 | Report tab Section 2 — Research Links | Indian: Screener / Trendlyne / NSE pills; US: Finviz / Macrotrends / EDGAR pills | done |
| 3 | Better prompts for Deep Research cards | Audit and improve all 8 section prompts (Indian + US variants) for depth, specificity, and output quality | done |
| 4 | Custom search on Deep Research | Free-form question input in the Deep Research tab; user types any question, Gemini answers via Google Search grounding; optional: pre-fill context from selected card results; works independently of the 8 section cards | done |

---

## Backlog — Upcoming

| # | Item | Notes | Status |
|---|------|-------|--------|
| 2 | FX conversion new feature | Toggle in PortfoliosPage gear (amber) + 5th tab in HoldingsPage (cross-portfolio, visible only when toggle ON); per-lot FX gain = qty×cost_usd×(usd_inr−buy_fx_rate); `buy_fx_rate` read from CSV col 13 (`Purchase Exchange Rate`); XIRR recalculated using actual INR at purchase time when toggle ON; fx_lots in bundle | done |
| 3 | Yearly activity performance analysis | Analysis/visualisation of performance broken down by year — e.g. annual returns, P&L, invested vs realised per year | pending |
| 4 | Research Links | Indian: Screener / Trendlyne / NSE pills; US: Finviz / Macrotrends / EDGAR pills | pending |
| 5 | Better Deep Research prompts | Audit and improve all 8 section prompts (Indian + US variants) for depth, specificity, and output quality | pending |

---

## Backlog — App Launch & Chart Caching

| # | Item | Notes | Status |
|---|------|-------|--------|
| 1 | App-launch loader gate | App.tsx renders instantly from cached real portfolio data on reopen (skips blocking loader) unless nothing cached yet or CSV present without real data | done |
| 2 | Chart data caching (3 surfaces) | Price chart, Holding 7-charts, Portfolio 7-charts share one per-symbol localStorage cache (`hist:*`, useHistory.ts); usePortfolioHistory.ts now reads/writes it too via placeholderData; errored symbols (no cache, retries exhausted) no longer wedge the progress bar forever | done |
| 3 | localStorage quota eviction for chart cache | `lsSet` evicts oldest 20 `hist:*` entries and retries once on QuotaExceededError, instead of silently failing (which was also silently breaking the React Query persister's portfolio-cache write and the debug log itself) | done |
| 4 | Backend cache memory growth (Render memory-limit emails) | `src/cache.py` `prune()` added — drops expired named/per-symbol layers, caps fifo:{hash}:* to 5 entries | done |
| 5 | Verify app-launch loader gate on real device | Added `gate:` debug log line in App.tsx (hasData/csv_hash/hasCsv/hasRealData/decision); confirmed via real close-reopen test with the localStorage-quota fix in place — original "30s loader despite recent fetch" symptom resolved | done |
| 6 | Incremental chart fetch | `backend/routers/history.py` `_fetch_incremental()` — daily history cached per-symbol as one contiguous series (`_series_cache`); re-fetches only pull from the last cached bar forward and merge, instead of re-downloading 2015→now every time | done |
| 7 | Chart auto-refresh unified with 30-min price-sync cadence | `useHistory.ts`/`usePortfolioHistory.ts` — Price chart + Holdings/Portfolio 7-charts now auto-refresh every 30 min (same cadence + visibilitychange pattern as `usePortfolio.ts`), instead of never auto-refetching within a session | done |
| 8 | Market-hours-aware chart staleness | `backend/market_hours.py` (new) — Indian (`.NS`/`.BO`) symbols re-check every 30 min only while NSE/BSE is open (~09:15–15:30 IST), then stay cached until the next close; US symbols same on NYSE/NASDAQ hours (~09:30–16:00 ET) | done |
| 9 | Closed-holding chart cache tiering | Fully-exited symbols get a 30-day localStorage TTL (`CLOSED_LS_TTL`) and a separate `['history-closed', sym]` query key — excluded from the 7-charts' 30-min auto-refresh and from the manual Refresh button; only the single-stock Price chart still fetches fresh data for them | done |
| 10 | Priority fetch ordering on manual chart refresh | HoldingsPage Refresh button now does a two-phase `refetchQueries` — the active portfolio/segment's symbols are awaited first, then the rest follow | done |
| 11 | Chart-cache RAM duplication removed | `history.py`'s `_series_cache` was being mirrored into `src.cache`'s shared `Cache` singleton too (`hist:` prefix) — same full-size daily series held twice in RAM for no benefit. Now persists to its own dedicated file (`data/.hist_cache.pkl`); `_PREFIX_TTL["hist:"]` removed from `cache.py` | done |
| 12 | Chart-cache rolling-window retention | Resident `_series_cache` trimmed to last 15 days per symbol (`_RETENTION_DAYS`) instead of the full multi-year series — client's own IndexedDB cache is now the long-term home for deep history; `_covers()` guards both the fast-path cache hit and `_fetch_incremental()` so a client without a usable `since` hint still gets a correct full re-fetch instead of a silently truncated range; symbol caps `_MAX_SERIES_SYMBOLS`/`_MAX_INTRADAY_SYMBOLS` lowered 300→120 | done |
| 13 | Frontend caches migrated localStorage → IndexedDB | New `utils/idbStore.ts` — sync-Map-backed (hydrated via `idbReady`, awaited in `main.tsx` before first render), write-through to IndexedDB. Migrated `hist:*` (useHistory.ts), `qs:*` (useQuickStats.ts), `dividends:cache:*` (useDividends.ts), `gemini:*`/`gemini:chat:*` (ReportTab.tsx/DeepResearchChat.tsx) off localStorage's ~5-10MB per-origin quota wall (root cause of several past bugs) onto IndexedDB's much larger disk-backed quota; removed now-dead quota-eviction fallbacks (`evictOldestHist`, `safeLocalSet`'s gemini-key-clearing branch) | done |
| 14 | Chart-burst peak/plateau reduction | `_sem` concurrency 4→3 (smaller peak, ~33% slower full-cold-burst clear); `_trim_memory()` (new) forces `gc.collect()`+libc `malloc_trim(0)` debounced 30s after a burst settles — glibc doesn't hand freed memory back to the OS on its own, so RSS was staying elevated near peak long after the resident cache had shrunk; frontend `usePrefetchHoldingCharts` now batches in groups of 20 instead of firing ~150-200 requests at once (no added delay) | done |
| 15 | Chart Refresh button — "already up to date" toast | Clicking Refresh within the existing 30-min staleness window previously did nothing visible; now shows a 3s toast instead of silently no-op'ing, and skips the redundant network call entirely | done |
| 16 | Dead code removed | `.github/workflows/keepalive.yml` (superseded by UptimeRobot) + 6 throwaway Playwright test scripts (`h_test.mjs`, `h_full.mjs`, `h_remaining.mjs`, `h_final.mjs`, `hc_test.mjs`, `t_test.mjs`) | done |

---

## Backlog — Mobile CSV Persistence (RESOLVED)

| # | Item | Notes | Status |
|---|------|-------|--------|
| 1 | Portfolio CSV reverts to demo data unpredictably on Android | RESOLVED 2026-06-17 (session 129). Root cause: (a) import handler wrote `portfolio:csv:meta` unconditionally even when the `portfolio:csv` content write silently failed on quota — settings showed correct filename while content was empty; (b) quota-fallback eviction checked key prefix `'history:'` which doesn't exist (real prefix `'hist:'`) — never freed the several-MB of chart-cache keys actually filling localStorage; (c) orphaned 1.4MB `stock-analyzer-chart-cache` key (dead, unused) never cleaned up. Diagnosed via a temporary in-app debug overlay (chrome://inspect/USB debugging couldn't be gotten working on Windows) — see `reference_mobile_csv_persistence.md` memory. Verified fixed end-to-end on device, including surviving a real app update. | done |
| 2 | In-memory CSV cache (attempted, reverted) | `setCsvMem()` in `usePortfolio.ts` kept an in-session JS-memory copy of the CSV so price refreshes wouldn't depend on `localStorage` mid-session. Reverted (commit `c8abf26`) because user pointed out "close and reopen the app" is more common than "mid-session refresh," and a full app close/OS reclaim still resets JS memory, falling back to the same vulnerable `localStorage` read — so it only partially addressed the real-world need. Superseded by the actual fix above. | reverted |

---

## Done

| Item | Completed |
|------|-----------|
| Render OOM — second root cause + IndexedDB migration — diagnosed live via Render API that the prior session's disk-persisted chart cache (`hist:` prefix in `src.cache`'s shared singleton) duplicated `history.py`'s `_series_cache` in RAM for no benefit; removed the mirror (own dedicated `data/.hist_cache.pkl` file instead), trimmed resident retention to 15 days/symbol (`_RETENTION_DAYS`, client's IndexedDB cache is now the long-term home for deep history), and lowered symbol caps 300→120. Migrated `hist:*`/`qs:*`/`dividends:cache:*`/`gemini:*` frontend caches off localStorage's ~5-10MB quota wall onto IndexedDB (new `utils/idbStore.ts`). Live-tested: a "double-cold" first burst (empty server cache + empty IndexedDB cache simultaneously, right after deploy) still plateaued at ~513MB — survived, no OOM, but tight — so further reduced concurrency `_sem` 4→3, added a debounced `malloc_trim(0)` to force glibc to actually return freed memory to the OS (RSS was staying elevated near peak after a burst even though the real resident cache had shrunk), and batched the frontend's chart-prefetch into groups of 20 instead of firing ~150-200 requests at once. Also removed dead code (`keepalive.yml` cron, 6 throwaway Playwright test scripts) and added a "Charts already up to date" toast for the no-op Refresh-button case | 2026-06-19 |
| Render OOM fix — chart-burst memory safety + disk-persisted chart cache — root-caused repeated `oomKilled` restarts to last session's `_sem` concurrency cap (4→8) holding too many full OHLCV DataFrames in memory at once during multi-symbol Charts-tab bursts; reverted to 4, `del df` per-request memory trim. Also eliminated redundant yfinance re-fetches: `history.py`'s `_series_cache` now persists to disk (`src/cache.py`, survives OOM-restarts/redeploys within the same container) and an optional `since` client hint lets a genuinely cold server cache serve a delta instead of a full re-download, merged client-side. A bug introduced by the disk-persistence fix itself (`Cache.set()` pickling the whole cache dict per chart fetch, no thread lock) caused a crash + a second fresh OOM within minutes of deploying — fixed with a `threading.Lock` + 5s write debounce in `src/cache.py`. Verified live: post-restart fetch 1.6s→0.3s; 16-symbol concurrent burst clean, no errors | 2026-06-19 |
| Live sync reliability overhaul — fixed root cause of sync icon taking 50-90s (sometimes crashing with 500): yfinance's internal cookie-fetch step ignores the `timeout` kwarg on one code path, always defaulting to ~30s; bounded via a `ThreadPoolExecutor` hard wall-clock timeout instead, falling back immediately on a hang. Also: live price/FX fetch switched to Yahoo's lightweight `v7/finance/quote` endpoint (~10x faster than the old 5-day OHLCV download); fixed the actual Render "exceeded memory limit" cause — two unbounded in-memory chart-history dicts in `backend/routers/history.py` capped to 300 symbols (LRU); Charts tab progress counter no longer jumps backward after the app is backgrounded/resumed (was tracking in-flight request count, not real progress); chart-fetch concurrency cap raised 4→8 so a mass refetch burst (all symbols going stale after backgrounding) clears faster; `PriceChart.tsx`'s 1D range selector no longer disappears during loading. Verified live on Render: warm sync now 4-5s (was 50-90s/crashing) | 2026-06-19 |
| `/health` route 405 fix — UptimeRobot's free plan always sends `HEAD` requests (HTTP method selection is Pro-plan-only); `backend/main.py`'s `/health` route only registered `GET`, causing every UptimeRobot check to fail with a 100%-reproducible `405 Method Not Allowed` regardless of cold/warm state — misdiagnosed at first as a Render hibernation/Cloudflare issue before being root-caused via a direct `curl -X HEAD` reproduction showing `Allow: GET`; fixed via `@app.api_route("/health", methods=["GET", "HEAD"])`; also investigated and confirmed GitHub Actions' `schedule` cron (`keepalive.yml`) is unreliable for sub-15min cadences (actual gaps of 1.5-4.8h between "successful" runs) — user added UptimeRobot as a more reliable 5-min keep-alive ping | 2026-06-19 |
| Chart auto-refresh reopen fix — `useHistory.ts`/`usePortfolioHistory.ts` open-symbol queries switched from `placeholderData` to `initialData`+`initialDataUpdatedAt` seeded from the cache's real stored timestamp, so React Query's `staleTime` check correctly skips the background fetch when the app is reopened within 30min of the last real fetch (previously always re-fetched on every fresh mount/reopen regardless of cache age, causing an unnecessary loader — most visible on the Total/hero view's progress bar) | 2026-06-18 |
| Benchmark XIRR refresh overhaul — `useBenchmarkXirr.ts` cache key changed from per-view `['benchmark-hist', sym, startDate]` (earliest-transaction-date, varied per portfolio/segment, caused re-fetches on view switch) to fixed `['benchmark-hist', sym]` anchored at `BENCH_START='2015-01-01'` — shared across every view; new `useRefreshAllBenchmarks()` force-fetches every `SECTOR_BENCHMARK` index directly + `setQueryData` (same dedupe-avoidance pattern as the dividends force-refresh fix); `HoldingsPage.tsx` Benchmarking analysis "Refresh" button now calls it instead of `qc.invalidateQueries`; `App.tsx` added once-per-calendar-day auto-refresh on app launch via `benchmark:autoRefreshDay` localStorage gate | 2026-06-18 |
| Dividends refresh overhaul — manual "Update" button now force-refreshes every portfolio (priority/current portfolio first → global aggregate → remaining portfolios throttled in chunks of 3), not just the active view; new once-per-calendar-month automatic refresh on app launch (no other auto-refresh exists for dividends); fixed a real bug where `force_refresh=true` never actually bypassed the backend's per-symbol 30-day disk cache (only the 24h computed-result cache), so genuinely new dividends wouldn't surface; fixed a second bug found via Playwright testing where `qc.fetchQuery` silently deduped the forced request against any already-mounted `useQuery` observer for the same key — switched to direct `fetchDividends`+`qc.setQueryData`; `backend/routers/dividends.py` (`force` param plumbed through `_fetch_symbol_divs`/`_compute`), `frontend/src/hooks/useDividends.ts` (`useRefreshAllDividends`, month-gate helpers), `HoldingsPage.tsx`, `App.tsx`; also fixed two unrelated pre-existing TS errors (`DebugOverlay.tsx` void-truthiness bug, `DeepResearchChat.tsx` `useKey` type missing the 3rd API key value) | 2026-06-18 |
| Add Transaction from UI — `AddTransactionModal.tsx` (new component); entry from HoldingsPage gear "Add Holding" + TransactionsPage "+ Txn" button; pre-fills symbol/portfolio/price from context; `useAddTransaction.ts` hook POSTs to `/api/portfolio/add-txn`, updates localStorage CSV + `['portfolio']` query cache; backend: `add_txn.py` router loads existing txns from FIFO cache, appends row, rebuilds bundle, returns new CSV + hash | 2026-06-16 |
| Dividends feature — auto-fetch yfinance dividend history for all held stocks; cross-reference with holding periods (net BUY−SELL per ex-date); toggle in gear icon (settings.includeDividends) includes dividends in total gains; Dividends tab (4th tab, amber) on HoldingsPage with summary strip, year bar chart, month calendar, per-stock expandable table (YoC, projected annual, TDS note); dividend row in SummaryCard + HoldingCard when toggle ON; collapsible "Dividends received" section in TransactionsPage; backend: dividends.py router + FIFO cache-first pattern (_load_txns reads shared cache so user's uploaded CSV is used, not hardcoded demo); IST timezone fix: tz_localize(None) strips without converting; debug endpoint GET /api/dividends/debug?symbol=X | 2026-06-12 |
| Deep Research Chat — bottom-sheet modal per stock; per-card 💬 Ask button + global Ask about [Name] button; context selector (All Cards or per-card); thread with react-markdown, source links, 🌐 Live badge; Google Search grounding (same cascade as section cards); prompt forces web search beyond context for historical data; localStorage 7-day persistence per yf_symbol; both TransactionsPage + ResearchPage supported via ReportTab | 2026-06-05 |
| Demo mode (CSV upload) — backend defaults to data/demo_msp_v2.csv (committed fake transactions); user uploads real msp_v2.csv once via ⚙ settings popover → stored in localStorage → auto-POSTed to /api/portfolio on every fetch; GET /api/portfolio → demo data; POST /api/portfolio with CSV body → real portfolio; GET /api/demo-csv → download demo CSV; settings popover: current file info, download, browse & import with % progress bar; data/msp_v2.csv gitignored | 2026-06-05 |
| Explore page Charts tab — 3-tab bar (Research \| Charts \| Notes); sky-50 strip with Price pill + sync ↻; PriceChart in card; hideLegend hides BUY/SELL; showZoom shows ⤢ button + ZoomChartOverlay (lightweight-charts v5: pinch zoom, pan, crosshair H+V dashed lines, Range mode 2-tap % gain); allChartData passed to overlay for full history | 2026-06-04 |
| Explore page overview card — CAGR 1Y text-[14px] right of price; CAGR 5Y bottom-right; 52W bottom-left; sector top-right; ago price removed; backend: _compute_1y_data uses daily history + returns current_from_history as current_price fallback; partial=False when current_price available from history | 2026-06-04 |
| Explore page UI improvements — banner renamed "Explore New Opportunities" (emerald gradient), light green search input, green autocomplete dropdown, mt-8 gap; overview card: company name (locName→qs.company_name→yf_symbol), sector/5Y CAGR on right, price + 1Y return % + 1Y ago price on same row, 52W below; back button text-[#2563eb]; max-w-xl mx-auto; quickstats adds company_name/sector/industry/one_year_return/price_1y_ago/five_year_cagr | 2026-06-04 |
| Explore New Holdings — PortfoliosPage search section (debounced autocomplete via /api/search Yahoo Finance proxy, recent search pills, navigates to /research/:symbol) + ResearchPage (Quick Stats + Deep Research + Notes tabs; reuses ReportTab + AnalysisTab; indigo overview card) | 2026-06-04 |
| PWA update toast — __BUILD_TIME__ injected at Vite build time; on controllerchange (new SW), green pill toast "✓ App updated · Built D Mon HH:MM IST" shows 2.5s before reload | 2026-06-04 |
| Quick Stats cold-start fix — useQuickStats throws on partial:true (TanStack Query auto-retries 2×15s); backend no longer caches partial results; curl_cffi added to requirements | 2026-06-04 |
| Gemini API keys — moved to Render env vars GEMINI_KEY_MAIN / GEMINI_KEY_BACKUP; local .env for dev | 2026-06-03 |
| Deep Research 8-card redesign — 7→8 sections; new prompts (Indian+US variants); per-card color system (blue/green/grey palette, accentHex hex value for inline border); card wrapper borderLeftWidth=4+borderTopWidth=2 (SummaryCard pattern); header right: Research/Show Results/Refresh button + attribution text "Results fetched by X on D Mon HH:MM"; fmtSavedAt includes HH:MM; footer legend removed | 2026-06-03 |
| 30-min auto-refresh fix — refetchInterval removed from usePortfolio (called backend without force_refresh, returned stale as_of); replaced with setInterval in PortfoliosPage calling handleRefresh() every 30 min via ref (force_refresh=true guaranteed) | 2026-06-03 |
| Research tab Quick Stats button color — inactive state changed to emerald tones (distinct from Deep Research violet) | 2026-06-03 |
| Gemini API keys moved to env vars — GEMINI_KEY_MAIN / GEMINI_KEY_BACKUP; _load_keys() reads os.environ at request time; local .env for dev; Render env vars for prod; git history squashed to remove keys from all commits | 2026-06-03 |
| Tab UI overhaul — active tabs darkened (100→200 shades), Notes tab amber→rose; Charts strip fixed sky color (not metric-dependent); inner bar buttons (metric pills, sub-tabs, model toggle) get visible border on active; Realized Gains amber→pink; both HoldingsPage + TransactionsPage updated | 2026-06-03 |
| quickstats reliability — `_TimeoutAdapter` 10s per-call timeout on all yfinance HTTP calls; top-level try/except in `get_quickstats` returns partial JSON instead of 503; disk cache errors caught separately; `isFetching` used in loading prop to avoid "Stats unavailable" flash during retry gap | 2026-06-03 |
| Research tab — renamed from Report; Quick Stats default sub-tab; emerald design language on Quick Stats card; pill style (rounded-md, solid active, track container) unified across all chart/analysis strips; 30-min auto portfolio refresh; resetQueries fix for stuck quickstats; "none"→"Neutral" analyst rec; Analyst Ratings link to Yahoo Finance /analysis/ | 2026-06-03 |
| Report tab — Deep Research / Quick Stats sub-tabs; violet strip in TransactionsPage; model toggle + gear (Deep Research) or ↻ sync (Quick Stats) in strip; reportTab/useLite/useKey lifted to TransactionsPage as props | 2026-06-03 |
| Report tab — API key toggle: gear icon popover (iOS toggle "Backup Key"), hardcoded _KEYS[Main, Backup] in gemini.py, key_index in POST body + cache key, _read_api_key simplified to use _KEYS directly; localStorage persist; quickstats 503 fix: retry 1×10s + gated on !!data | 2026-06-03 |
| Report tab — model toggle (2.5 Flash / 3.1 Lite); force_lite param; accordion + auto-expand; card header shows 🌐/⚡ model icon+name; footer legend; _is_fatal_error fallback (catches 503/timeout); attempt 2 retries once; gemini-2.5-flash grounding confirmed working | 2026-06-03 |
| Report tab — Gemini model stabilised: gemini-3.1-flash-lite (500 RPD, 15 RPM); Google Search grounding removed (Gemini 3.x has 0/0 free grounding quota; account-level quota exhausted); .env key read at request time (no restart needed for key rotation); retry loop removed (caused timeout cascades) | 2026-06-02 |
| Report tab — Gemini card UX: collapsible by default (▶/▼ left), "Updated DD Mon + ↻" right, 7-day localStorage cache with savedAt, error reason shown under Retry, markdown headings/bullets/tables fixed, gemini-2.0-flash (200 RPD), async endpoint with 25s timeout, .env local fallback | 2026-06-02 |
| Report tab — Gemini 2.5 Flash inline answers replacing Perplexity; POST /api/gemini (google-genai + Google Search grounding); react-markdown + remark-gfm rendering; elapsed timer; force-refresh ↻; localStorage cache per section | 2026-06-02 |
| Report tab Section 1 — 4×4 fundamentals grid; Screener.in data source; PEG fallback computation; D/E; Rev 1Y/3Y + EPS 1Y/3Y from Screener compounded growth + yfinance 3Y CAGR; loading progress bar; PE History 5Y chart from Macrotrends (US only) | 2026-06-02 |
| Report tab Revenue Segments card — new 7th Perplexity section; targeted web search query with site: operators; table format; PDF limitation documented | 2026-06-02 |
| Report tab Section 1 — 3×4 fundamentals grid; Screener.in data source for Indian stocks; 9 new quickstats fields (ROCE, ROE, ROA, margins, EPS, rev growth, P/B, PEG); ↻ sync button + source link | 2026-06-01 |
| HoldingsPage search/filter — search input (name/symbol) + sector dropdown + sort in single strip row; count in placeholder; `visibleRows` memo; `symbolSectorMap` for open+closed | 2026-06-01 |
| HoldingsPage Allocation tab rows clickable — By Sector, By Market Cap, Concentration rows navigate to TransactionsPage; matches Benchmarking tab behaviour | 2026-06-01 |
| TxRow 2-column mobile layout — 3-col → 2-col grid; left=Date+Invested, right=stacked gains; fixes truncation on 412px | 2026-06-01 |
| PriceChart BUY/SELL dot size by txn value — radius scales r=3→r=10 based on qty×price; buyR/sellR on ChartPoint | 2026-06-01 |
| Closed holdings charts — `holdingArrForCharts` synthetic Holding[] in TransactionsPage; yf_symbol from first transaction; all 7 historical metrics now render for fully exited positions | 2026-06-01 |
| TypeScript cleanup — `BenchmarkOutput` interface + tsconfig lib ES2022; zero tsc errors | 2026-06-01 |
| Boot context reduction — archived old design decisions + done items to `DESIGN_HISTORY.md`/`ROADMAP_ARCHIVE.md`; ~574 lines/session saved | 2026-06-01 |
| US stocks benchmarking ^NDX fix â€” `history.py` retries `yf.download` with `auto_adjust=False` when first call returns empty; newer yfinance on Render silently returns empty for US index symbols; benchmark XIRR and alpha now show correctly on production | 2026-05-31 |
| Charts + Analysis tab padding fix â€” extra horizontal padding removed from both tab wrappers; content flush with page edges | 2026-05-31 |
| Returns pill â€” histogram border card + bar value labels (year mode â‰¤8 bars) + multi-select year in month mode (labels `Jan '23`, summary shows range `2023â€“2025`) | 2026-05-31 |
| Allocation accordion 4-column layout â€” Sector/Alloc(%+bar)/Value(XIRR)/Today columns; sectorData+mktCapData include todayGain; sunburst reverted (nivo tooltip crash on undefined datum) | 2026-05-31 |
| Analysis tab holding rows clickable â€” Allocation (By Sector + Market Cap expanded rows) + Benchmarking holding rows now navigate to TransactionsPage on tap | 2026-05-31 |
| HoldingsPage Analysis strip â€” violet-50 bg (matches tab); gradient active pills (amber/sky/emerald inline styles); tinted inactive pills; benchmarking sync moved into strip with datetime | 2026-05-31 |
| TransactionsPage full makeover â€” iOS segmented tab bar (Txns/Charts/Report/Notes); per-tab colored strips; METRIC_HEX inline-style charts strip (bg+pills+sync gradient change per metric); overview card shadow+gradient strip; TxRow whisper tint; charts sync with datetime | 2026-05-31 |
| HoldingsPage Charts strip â€” METRIC_STYLE gradient pills, tinted inactive, metric-colored line+progress+strip+sync; chart card border (white rounded-xl shadow-sm); whitespace reduced | 2026-05-31 |
| HoldingsPage "Light Banking" overhaul â€” iOS segmented tab bar (colored active pills: teal/sky/violet); Holdings strip (teal-50) with count + funnel sort; SummaryCard white+shadow+highlight prop (green/teal by segment); HoldingCard shadow-sm + very light gain/loss tint; Benchmarking XIRR column truncation fix | 2026-05-31 |
| Overview 3-color scheme â€” teal hero card (light, dark text); STOCK_CARD_STYLE green shared across all stock tiles/brokers; MF_CARD_STYLE navy-blue shared across all MF tiles/brokers; Portfolio Manager banner height reduced | 2026-05-31 |
| Visual design overhaul â€” Hero card dark gradient; Stocks/MF tiles type-specific color identity; iOS breakdown toggle; colored section labels; TYPE_ACCENT BreakCard borders; XIRR chips on BreakCard/HoldingCard/SummaryCard; SummaryCard 3px gradient top strip; Charts sync inside metrics bar; Benchmarking sync inside date filter row | 2026-05-31 |
| Sync pill relocations + styling â€” Charts â†» inside sky-50 metrics strip (`bg-sky-100`, `text-[9px]`, mid-aligned); Benchmarking â†» in date filter row (`bg-teal-100`, `ml-auto`, `w-1/3` date column, chevron moved left); both as single button with `flex items-center` | 2026-05-31 |
| _(see [ROADMAP_ARCHIVE.md](ROADMAP_ARCHIVE.md) for older entries)_ | — |
