# FEATURE_MAP.md — Feature → File Lookup

> Always-loaded at session start. Use this to find the right file instantly — no exploration needed.
> When user says "Working on: X", look up X here and cache those files for the session.

## Feature → File Map

| Feature / Area | Frontend file(s) | Backend file(s) |
|---|---|---|
| **Deep Research cards** | `frontend/src/components/ReportTab.tsx` (each of the 8 cards expands independently now, not an accordion; trend tables auto-render a small Recharts chart via `parseTrendTable()`), `frontend/src/utils/reportLinks.ts` (2026-08-11: `SECTOR_METRICS_CATALOG` — shared 21-category sector classification + metrics reference the 8 prompts self-classify into, replacing the old India/US content split; `PROGRESS_MESSAGES` — per-card looping loading-panel text), `frontend/src/utils/geminiGenerationStore.ts` (module-level generation state, survives unmount/navigation) | `backend/routers/gemini.py` (`/api/gemini/stream` — auto-fallback 2.5 Flash→2.5 Lite, manual-only 3.1) |
| **AI Assistant chat** | `frontend/src/components/DeepResearchChat.tsx` (2026-08-13: per-card Gemini shortcut icon removed from `ReportTab.tsx` cards — chat now only opened via the general "AI Assistant" button + its own context picker, which still shows a per-card emoji) | `backend/routers/gemini.py` (`/api/gemini/chat/stream` prompt rewritten 2026-08-13: grounds in card context for follow-ups about what's shown, searches freely for anything outside the context's scope like news/management commentary; non-streaming `/api/gemini/chat` is dead code, unused by frontend) |
| **Quick Stats grid** | `frontend/src/components/ReportTab.tsx`, model-name/timestamp caption under each card now `text-[9px]` (2026-08-13) | `backend/routers/quickstats.py` (2026-08-13: added `previous_close`/`today_pct` fields — today's % change, computed last so it reflects the post-Screener-overlay price for Indian stocks) |
| **Explore / Research page** | `frontend/src/pages/ResearchPage.tsx` — reworked 2026-08-13: header (Back/Watchlist star/Settings nav row + dark-hero overview card) now visually fused into one block and recolored teal to match Transactions/Holdings pages (was violet); new top-right Settings popover (Add Txn/Charts/AI Model/API Key, same 320px sizing as other pages' Settings modals); overview card shows "Day change ±%" instead of sector; full-screen toggle for Deep Research tab (collapses header, keeps Research strip). Now calls `usePortfolio()` for the Add Txn modal's portfolio/holdings data. | `backend/routers/quickstats.py`, `backend/routers/search.py` |
| **Transactions page** | `frontend/src/pages/TransactionsPage.tsx` | — |
| **Holdings page** | `frontend/src/pages/HoldingsPage.tsx` | — |
| **Portfolio home page** | `frontend/src/pages/PortfoliosPage.tsx` | `backend/routers/portfolio.py` |
| **Price chart** | `frontend/src/components/PriceChart.tsx`, `frontend/src/components/ChartStateBlock.tsx` (shared empty/error/stale/freshness states, also used by aggregate chart) | `backend/routers/history.py` — reads/writes shared `backend/price_store.py` (2026-07-03, unified with portfolio_history.py's price fetch) |
| **Zoom overlay** | `frontend/src/components/ZoomChartOverlay.tsx` | — |
| **Benchmarking tab** | `frontend/src/pages/HoldingsPage.tsx` | `frontend/src/hooks/useBenchmarkXirr.ts` |
| **Allocation tab** | `frontend/src/pages/HoldingsPage.tsx` | — |
| **Activity tab (Analysis, added 2026-07-07)** | `frontend/src/pages/HoldingsPage.tsx` — reuses the existing `benchTxns` memo (already scoped to portfolio/segment/bucket/label) filtered to BUY/SELL, with range preset/custom-date/stock/type filters | — |
| **Holding card** | `frontend/src/components/HoldingCard.tsx` | — |
| **Summary card / hero card** | `frontend/src/components/SummaryCard.tsx` — shared by `PortfoliosPage.tsx` (Total Portfolio hero), `HoldingsPage.tsx`, `TransactionsPage.tsx` (per-symbol card); identical top-bar+card format on all three | — |
| **TxRow (transaction row)** | `frontend/src/components/TxRow.tsx` | — |
| **Portfolio data fetch** | `frontend/src/hooks/usePortfolio.ts`, `frontend/src/api/portfolio.ts` | `backend/routers/portfolio.py` |
| **History / chart data** | `frontend/src/hooks/useHistory.ts`, `frontend/src/hooks/usePortfolioHistory.ts` | `backend/routers/history.py` |
| **FIFO / P&L logic** | — | `src/portfolio.py` |
| **Price fetching / cache** | — | `src/price_fetcher.py` (live quotes), `src/cache.py`, `backend/price_refresh.py` (background 2-min warm-up loop), `backend/price_store.py` (NEW 2026-07-03 — shared historical daily-close store, replaces two separate per-symbol caches that used to live in history.py and portfolio_history.py) |
| **Portfolio bundle build** | — | `src/engine.py` |
| **API routing** | — | `backend/main.py` |
| **Buckets & Labels (user-defined classification)** | `frontend/src/utils/buckets.ts` (also `getLabelCurrency`/`setLabelCurrency`, 2026-07-04), `frontend/src/components/ManageBucketsModal.tsx` (collapsible sections, collapsed by default on open; non-deletable "Broker Portfolios" section moved to the end, 2026-07-04), `frontend/src/hooks/useSetTags.ts` | `backend/routers/add_txn.py` (`set_tags` endpoint), `src/portfolio.py`/`src/price_fetcher.py` (`tags`/`quote_type` fields) |
| **Manage Portfolio menu (Add/Delete/Copy landing)** | `frontend/src/components/ManagePortfolioModal.tsx` | — |
| **Delete Holding modal** | `frontend/src/components/DeleteHoldingModal.tsx` (2026-07-04: Bucket/Label scope is ALWAYS an untag now — the old "Show txn" real-delete escape hatch from a Label view was removed; those rows are read-only detail) | `backend/routers/add_txn.py` (`delete-holding` endpoint) |
| **Copy Holdings modal** | `frontend/src/components/PullHoldingsModal.tsx` | `backend/routers/add_txn.py` (`set_tags` endpoint) |
| **Currency/skip-portfolio helpers** | `frontend/src/utils/segments.ts` (`USD_PORTS`/`SKIP_PORTS` are now only seed defaults; `getPortfolioCurrency`/`setPortfolioCurrency` — user-configurable per-broker-portfolio currency, localStorage `portfolio:currency`, 2026-07-04), `frontend/src/utils/currency.ts` (`resolveDisplayCurrency`/`fxMultiplier` — single shared toggle-resolution util replacing 3 duplicated implementations) | — |
| **Sectors / benchmark** | `frontend/src/utils/sectors.ts` | `frontend/src/hooks/useBenchmarkXirr.ts` |
| **XIRR calculation** | `frontend/src/utils/xirr.ts` | `src/xirr.py` |
| **Formatting helpers** | `frontend/src/utils/fmt.ts` | — |
| **Gemini API types/client** | `frontend/src/api/gemini.ts` | `backend/routers/gemini.py` |
| **Settings popover / CSV upload** | `frontend/src/pages/PortfoliosPage.tsx` | `backend/routers/portfolio.py` |
| **BSE filings** | — | `backend/routers/filing.py` |
| **Symbol search autocomplete** | `frontend/src/pages/PortfoliosPage.tsx` | `backend/routers/search.py` |
| **Price Alerts / Push Notifications (NEW 2026-08-11)** | `frontend/src/components/NotificationBell.tsx` + `NotificationsPanel.tsx` (bell icon + unread badge on `PortfoliosPage.tsx`, bottom-sheet list; "Show all set alerts" footer button toggles to every `AlertRule` via `useAlertRules()`, tap → `/transactions/:portfolio/:symbol` with `state.openAlerts=true`), `frontend/src/components/ManageAlertsModal.tsx` (opened from `TransactionsPage.tsx`'s 🔔 icon, or auto-opened by that page's `openAlerts` nav-state read; two independent rows — % Move / Price Level — each fillable on its own; exports `CUR()`/`ruleSummary()` for reuse), `frontend/src/hooks/useAlerts.ts`, `frontend/src/api/alerts.ts`, `frontend/src/utils/clientId.ts` (per-browser identity, no login system), `frontend/src/utils/pushSubscribe.ts`, `frontend/src/sw.ts` (custom service worker, push handling) | `backend/routers/alerts.py`, `backend/alerts_store.py` (client-partitioned JSON store), `backend/alerts_engine.py` (`evaluate()`, called from `backend/price_refresh.py`'s 2-min loop) |
| **Watchlist (NEW 2026-08-11)** | Star toggle on `frontend/src/pages/ResearchPage.tsx`'s overview card; list lives inside `frontend/src/pages/PortfoliosPage.tsx`'s Explore FAB modal (below the search bar, shown whenever not actively searching) via local `WatchlistRow` (swipe-right-to-remove), `frontend/src/hooks/useWatchlist.ts`, `frontend/src/api/watchlist.ts` | `backend/routers/watchlist.py`, `backend/watchlist_store.py` (client-partitioned JSON store, same pattern as alerts) |
| **Login / Access Control (NEW 2026-08-13, hardened later same day)** | Google Sign-In via `frontend/src/components/GoogleSignInButton.tsx`; session in `frontend/src/utils/auth.ts` (idbStore-backed JWT). `App.tsx`'s `SignInGate` **removed** — the app must never fully block on auth; `ReauthBanner` is now the only auth UI (shown whenever `!isSignedIn()`, never blocking, copy "Sign in to analyse your portfolio"); it publishes its live height as CSS var `--reauth-banner-h` (`document.documentElement.style`) which `ResearchPage`/`TransactionsPage`/`HoldingsPage` (all `100dvh`-locked pages) consume via `height: calc(100dvh - var(--reauth-banner-h,0px))` so the banner doesn't overlap their nav row — `PortfoliosPage` doesn't need this, it isn't height-locked. Settings → Account in `PortfoliosPage.tsx`: sign-out now opens a Cancel/Sign-out confirm modal (was instant); confirming clears session + `portfolio:csv`/`:meta`/`:hash`/`:owner` + wipes the `['portfolio']` query cache, auto-refetching to demo. **Cross-account CSV leak fix**: every CSV import stamps `portfolio:csv:owner` = importing account's email; `usePortfolio.ts`'s `getCsvContent()`/exported `hasOwnCsv()` refuse to send/trust a CSV whose owner doesn't match the current `getUserEmail()` (falls back to demo instead) — checked synchronously in the hook's render path, not just an effect, so a persisted cross-account cache can't flash for a frame; legacy un-owned CSVs backfill their owner on next successful real fetch. `fetchPortfolioGuarded` only sends the CSV when signed in, and drops a token the backend rejects (401) instead of erroring forever. `frontend/src/pages/JoinPage.tsx` (`/join`, plain landing page, no token) | `backend/routers/auth.py` (`POST /api/auth/google`, `GET /api/auth/me`), `backend/users_store.py` (`data/.users.json`), `backend/auth_deps.py` (`get_current_user`/`get_current_admin` — admin status is the static `ADMIN_EMAILS` env var, separate from users_store) |
| **Admin panel (NEW 2026-08-13, reworked later same day)** | Settings → dedicated "Admin panel" section (admin-only) in `PortfoliosPage.tsx`: "Manage Users" row opens its own centered modal (add/list/revoke/restore/delete, same visual pattern as Manage Buckets) + "Debug Log" row beside it (moved here from Configuration, no longer visible to non-admins); `frontend/src/hooks/useAdmin.ts`, `frontend/src/api/admin.ts` | `backend/routers/admin.py` — admin-only (`ADMIN_EMAILS` env var) add/revoke/restore/delete over `users_store.py`; revoke/delete both reject the caller's own email (`cannot revoke/delete your own admin account`) to prevent self-lockout |
| **Google Drive backup (NEW 2026-08-13, reworked later same day)** | Settings → Account: separate "Backup to Drive" (shows "Last backup: <timestamp>" inline) and "Restore from Drive" rows in `PortfoliosPage.tsx` — Restore is two-step (first tap checks Drive and shows the backup's timestamp, second tap confirms and restores); `frontend/src/utils/driveBackup.ts` (`drive.file` OAuth scope, browser talks directly to Google's Drive API; backup file renamed `nexus-portfolio-backup.csv`, `restoreFromDrive()` falls back to the old `stock-analyzer-portfolio-backup.csv` name; `getDriveBackupInfo()` fetches just the timestamp) | — (no backend involvement by design — see Pending/ARCHITECTURE.md) |
| **Notes (any page)** | `frontend/src/components/AnalysisTab.tsx` (2026-08-10: CSV-backed per-symbol notes — shared across all portfolios holding that stock, survives reimport — whenever a `transactions` prop is passed (TransactionsPage/real holdings); falls back to old `localStorage` behavior when omitted (ResearchPage's "research" pseudo-portfolio, stock may not be held at all)), `frontend/src/hooks/useSetNotes.ts` (mutation → set-notes endpoint) | `backend/routers/add_txn.py` (`set-notes` endpoint, `notes` column also carried forward by `import-merge-tags`), `src/data_loader.py` (`notes` column parsing) |
| **Add transaction flow** | `frontend/src/components/AddTransactionModal.tsx`, `frontend/src/hooks/useAddTransaction.ts` | `backend/routers/add_txn.py` |
| **Dividends tab** | REWORKED 2026-07-04 — `frontend/src/hooks/useDividends.ts`'s `useDividendEvents`/`refreshDividendEvents` (one shared module-level store, `useSyncExternalStore`, no auto-fetch, batches of 10 with priority-symbols-first) is the single fetch pipeline, replacing the old dual `useDividends`+`useDividendsBatched`; `frontend/src/utils/dividends.ts`'s `computeDividendsForScope()` (TS port of the old backend aggregation) turns the shared raw events into portfolio/segment/bucket-scoped totals client-side — same pattern `HoldingsPage.tsx`'s `xirrMap` already used; `frontend/src/components/DividendsTab.tsx` consumes both, no longer fetches itself; `frontend/src/api/dividends.ts` (`fetchDividendEvents`, raw per-symbol response types) | `backend/routers/dividends.py` — `GET /api/dividends?symbols=...` only, no `portfolio` param, no result cache; returns raw per-symbol events only. **Fix (2026-07-04)**: `HoldingsPage.tsx`'s `allDividendSymbols`/`divScopePortfolios` now derive from `data.transactions` (every symbol/portfolio ever traded), not `data.holdings` (open positions only) — a fully-sold symbol or a portfolio with zero open positions left was silently excluded before. `DividendsTab.tsx` header no longer has a Refresh button (redundant with Settings popover); just shows "Updated HH:MM" top-right. |
| **FX / currency gains tab** | `frontend/src/components/FxGainsTab.tsx` | — |
| **Portfolio aggregate chart (Holdings + Txn page, unified 2026-07-03, CSV-privacy-fixed same day, bucket/label scoping fixed 2026-07-05)** | `frontend/src/hooks/useBackendPortfolioHistory.ts` — used by BOTH `HoldingsPage.tsx` (whole-portfolio/bucket-label, no `symbol` param) AND `TransactionsPage.tsx` (scoped via `symbol` param); now sends `csvContent` (POST) like `usePortfolio.ts` does, keys its cache/query by `csvHash`, and refetches in step with the main portfolio bundle's refresh instead of its own timer; now also takes `bucket`/`label` params, passed by `HoldingsPage.tsx` for Bucket/Label views | `backend/routers/portfolio_history.py` — GET (demo) + POST (real CSV) /api/portfolio-history?currency=&portfolio=&segment=&symbol=&bucket=&label=; result-cache key now `csvHash:currency:portfolio:segment:symbol:bucket:label` (was missing csvHash — cross-user collision risk); raw prices come from shared `backend/price_store.py`, not a private cache; `usePortfolioHistory.ts` now ONLY provides symbolPriceMap (start=2022-01-01, lsKey `${sym}:3y`), no aggregate math left client-side. **2026-07-05 fix**: added `bucket`/`label` filter (Python port of `resolveLabel()`) — Bucket/Label Charts-tab views previously had no way to scope this endpoint at all and silently got the full portfolio total |
| **Realized gain calc** | `frontend/src/utils/realized.ts` | — |
| **Research Links pills (Screener/Finviz etc.)** | `frontend/src/utils/reportLinks.ts` | — |
| **Loading skeletons** | `frontend/src/components/LoadingSkeleton.tsx` | — |
| **Debug overlay (🐛 panel, active per user request)** | `frontend/src/components/DebugOverlay.tsx`, `frontend/src/utils/debugLog.ts` (mounted in `App.tsx`); opened via "Debug Log" row in `PortfoliosPage.tsx` Settings → Configuration (2026-08-11 — no longer a floating button; dispatches `window` event `'debug-overlay:open'`) | — |
| **App boot / IndexedDB hydration gate** | `frontend/src/main.tsx` (awaits `idbReady` before first render) | — |
| **Market hours / open-closed check** | — | `backend/market_hours.py` |
| **Raw data loading / CSV schema** | — | `src/data_loader.py`, `src/schema.py` |
| **API response shaping** | — | `backend/serializers.py` |

## Caching & Storage Layer (check here first for "stale/short/wrong data" bugs)

| Layer | File | Notes |
|---|---|---|
| Frontend shared KV cache | `frontend/src/utils/idbStore.ts` | Single IndexedDB store backing `hist:*`, `qs:*`, `dividends:events:v1` (2026-07-04, replaces the old per-portfolio `dividends:cache:*`/`dividends:cache:v2:*` keys — one flat key holding every symbol's raw dividend events, no portfolio dimension), `gemini:*` keys. Hydrates into an in-memory `Map` once at boot (`idbReady`, awaited in `main.tsx`). All reads after boot are synchronous against the Map — a value only shows up post-boot if `idbSet` was called, not just written to IndexedDB directly. |
| Chart history cache (frontend) | `frontend/src/hooks/useHistory.ts` (`lsGet`/`lsSet`, prefix `hist:`) | Sends the last cached date as `since` to request a delta instead of full history. `mergeHistory()` only merges if the backend response carries `partial_since` — otherwise it **replaces** the cache. A missing `partial_since` flag on a real delta response is exactly what caused the 2026-06-19 flat-line/dot chart bug. |
| Chart history cache (backend, resident) | `backend/price_store.py` (shared, was `history.py`'s private `_series_cache` until 2026-07-03) | No longer trimmed — unified with `portfolio_history.py`'s price fetch onto one full-history store (capped at 150 symbols instead of a date-window trim). Persisted to disk at `data/.price_store.pkl`, but disk is ephemeral across Oracle VM deploys — a fresh deploy starts with an empty resident cache. The frontend's IndexedDB is still the long-term store for deep history from this user's own device. |
| Live price/FX cache (backend, disk) | `src/cache.py` (prices/prev_closes/fx layers, `data/.cache.pkl`) | TTL 2 min (2026-07-02, was 30 min). Kept warm independent of requests by `backend/price_refresh.py`'s background loop (every 2 min) — a real request almost always reads already-fresh cache instead of waiting on a live yfinance call. 2026-07-03: loop now merges fresh prices over the last-known-good cache (`Cache.get_stale()`) instead of replacing wholesale, so a partial/timed-out fetch can't wipe prices for symbols it missed. |
| Uploaded-CSV FIFO cache (backend, RAM-only) | `src/cache.py` (`_RAM_FIFO` dict) | 2026-07-02 privacy fix: real portfolio holdings/txns for an uploaded CSV live only in process RAM (keyed by CSV content hash, capped at 5 most recent), never written to `data/.cache.pkl`. Only the bundled demo file's FIFO entry is still disk-cached. Lost on every backend restart — a cache miss just costs one recompute from the browser's own `localStorage` CSV copy. |
| CSV owner tag (frontend, localStorage) | `portfolio:csv:owner` key, stamped in `PortfoliosPage.tsx`'s `handleImport`, checked in `usePortfolio.ts`'s `getCsvContent()`/`hasOwnCsv()` | NEW 2026-08-13 — holds the email of the account that imported the current `portfolio:csv`; a mismatch against the currently signed-in account means the CSV is treated as absent (prevents one Google account seeing another's real portfolio on a shared device). Cleared on sign-out along with the CSV itself. |
| PWA / service worker | `frontend/vite.config.ts` (`VitePWA` / workbox) | Precaches only static build assets (`js/css/html/svg/png/ico`) — **no `runtimeCaching` for `/api/*`**, so API responses are never served from the service worker cache. Rule out SW caching quickly by checking this file has no `runtimeCaching` block before suspecting it. |
| Browser HTTP cache | n/a — check response headers | `backend/routers/history.py` doesn't set explicit `Cache-Control`; Cloudflare in front of Render shows `cf-cache-status` header (`DYNAMIC` = not edge-cached). Use `curl -D -` against the live Render URL to check headers/cache status directly without needing the user's browser. |
| Other localStorage (not yet migrated) | grep `localStorage` directly if a key isn't one of the `idbStore.ts` prefixes above | Most caches moved to IndexedDB in the OOM fix (session 139) — if investigating a cache bug, confirm which store (localStorage vs IndexedDB) the key actually lives in before assuming. |
| Benchmark index history cache | `frontend/src/hooks/useBenchmarkXirr.ts` (`bench:` prefix in idbStore) | Added session 150 — previously had zero persistence (full re-fetch from 2015 on every reload). Now mirrors the Charts/Dividends pattern: IndexedDB-backed, incremental `since`/`partial_since` fetch, real `lastFetchedAt` exposed instead of `new Date()`. |
| Alerts store (backend, disk) | `backend/alerts_store.py` (`data/.alerts.json`) | Not a cache, user-authored rules; partitioned by `client_id` — UPDATED 2026-08-13, now the caller's verified email, not the old per-browser UUID (`utils/clientId.ts`, retired). Gitignored like `.cache.pkl`. |
| Users store (backend, disk) | `backend/users_store.py` (`data/.users.json`) | NEW 2026-08-13 — approved-users list, source of truth for who can sign in; not derived/regenerable. Gitignored. |
| Watchlist store (backend, disk) | `backend/watchlist_store.py` (`data/.watchlist.json`) | NEW 2026-08-11 — same shape/pattern as the alerts store above (`client_id`-partitioned, gitignored); quotes for the list are NOT cached here — fetched live on demand by `routers/watchlist.py`'s `/quotes` endpoint |
| Aggregate chart cache (frontend) | `frontend/src/hooks/useBackendPortfolioHistory.ts` (`portfolioHist:` prefix in idbStore) | Added 2026-07-03 — previously had ZERO on-device persistence (in-memory React Query cache only), so closing the app always lost it. Now paints instantly on reopen like the other charts; 30-min staleTime (raised from 5 min 2026-07-04, matches backend's `_CACHE_TTL` and market_hours' own 30-min is_stale gate) backed by a real elapsed-time-poll auto-refresh (was staleTime-only before, never actually ticked while the page sat open). Per-symbol history feeding XIRR/benchmarking (`usePortfolioHistory.ts`'s `OPEN_REFRESH_MS`) also raised to 30 min same day; `PriceChart.tsx`'s own fetch stays at 2 min (`useHistory.ts`'s `REFRESH_MS`, unchanged) since it's the closest thing to a live quote. |
| Aggregate chart raw price cache (backend, disk) | Same shared `backend/price_store.py` as the row above (was its own separate `_price_cache`/`data/.portfolio_hist_cache.pkl` until 2026-07-03, now one store for both chart types) | Makes each 5-min recompute incremental instead of a full multi-year `yf.download()`. Capped at 400 symbols (raised from 150 on 2026-07-03 — was smaller than a single portfolio's own symbol count, causing eviction mid-request and wrong aggregate totals); the outer computed-*result* cache (`_cache` in portfolio_history.py) still has no eviction cap, only a 5-min TTL — see ARCHITECTURE.md Pending. |
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
| Analysis tab (Allocation/Benchmarking/Returns/Activity sub-tabs) | 1873–2703 |
| Activity sub-tab (filters + txn list) | 2573 |
| Dividends tab | 2575 |
| FX tab | 2419 |

**PortfoliosPage.tsx**
| Section | ~Line |
|---|---|
| BreakCard component | 161 |
| Main component start | 227 |
| Explore New Holdings search state | 538–545 |
| `WatchlistRow` component (module scope, swipe-to-remove) | 213–293 |
| Stocks/MF tile XIRR computation | 494–613 |
| Settings / gear popover | 867 |
| Currency toggle | 1018 |
| Hero card | 1057 |
| Card rendering loop | 1191 |
| Explore FAB + modal (top-anchored, search+watchlist merged view) | 1335–1465 |

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
