# Architecture — Multi-Portfolio Stock Analyzer

> Single source of truth for active components and finalized design.
> Everything not listed here is either dead code or not yet built.

---

## Line Anchors (for "Backend fix" boot reads)

> CLAUDE.md says backend-fix tasks read "Active File Map + API Endpoints + Data Flow + Key Functions" — grep to confirm, then `Read` with offset/limit on just these ranges instead of the whole 340+ line file.

| Section | ~Line |
|---|---|
| Active File Map | 8–93 |
| Navigation Flow | 94–106 |
| Data Flow | 107–122 |
| API Endpoints | 123–146 |
| Key Functions — Edit Anchors | 322–340 |

---

## Active File Map

```
CLAUDE.md                   Session rules, trigger table, prompt contract, boot protocol (65 lines)
QUICK_REF.md                Always-loaded compact reference — URLs, portfolio config, invariants, validated numbers, dev commands
FEATURE_MAP.md              Feature-to-file lookup — 28 features mapped to exact frontend + backend files; use instead of exploration

validate.py                 Terminal CLI (independent of backend)
testcases.md                Manual test cases — Charts tab + Portfolios page invariants
scripts/convert_broker_export.py  One-off CLI: reshapes a raw broker export (old MSP-format columns) into the app's single import/export schema — run manually before importing, since data_loader.py no longer auto-detects/transforms that raw shape (removed 2026-06-21)
meta_filings_agent.py       Standalone research tool — fetches SEC EDGAR 10-Q/10-K for any US ticker, downloads HTML→text, uploads to Claude Files API, generates per-filing analysis + cross-quarter trend report; outputs meta_filings/META_Filing_Analysis.md

src/
  engine.py                 build(currency, force_refresh) → PortfolioBundle; computes fx_gain/disp_fx_gain per USD holding; filters fx_lots to selected portfolios ∩ _USD_PORTS; _fill_usd_fx_rates(txns) auto-fetches historical USDINR=X rates via yfinance for USD BUY rows where buy_fx_rate is missing or ≤1.5; called in FIFO layer before calculate_holdings so rates bake into avg_buy_fx_rate and serialized transactions. FIXED 2026-06-22: the current CSV schema (session 148 trim) never includes a buy_fx_rate column at all, and the function used to bail out entirely whenever the column was fully absent (not just empty) — every USD txn silently stayed at the dummy 1.0 default forever, which made fx_lots always empty (gated on real rate >1.5) and the FX-gains toggle a no-op. Now creates the column at the 1.0 default first if missing, so the mask still catches every USD BUY row.
  cache.py                  Disk cache (data/.cache.pkl) — prices/fx/prev_closes TTL 30min, info 7d; set_fifo(key, txns, holdings, realized, fx_lots) 4-tuple; get_fifo() → (txns, holdings_raw, realized, fx_lots); fifo_is_fresh() checks for "fifo:value:lots" key to force recompute on first deploy; _FIFO_VERSION = "2" class constant — increment to force recompute even when CSV hash unchanged (e.g. after engine logic changes); prune() called on every disk write — actively drops expired named layers, expired qs:/divs: per-symbol entries (_PREFIX_TTL, since dynamic keys fall outside _TTL and were previously treated as permanent), and caps fifo:{hash}:* entries to _MAX_FIFO_HASHES=5 (demo excluded) — fixes unbounded memory growth that was triggering Render's memory-limit alerts; chart history (`hist:*`) no longer lives here (moved to its own dedicated file in history.py — see below) — mirroring the same full-size daily series into this shared singleton duplicated that cache's entire memory footprint for no benefit, since the mirror was only ever read once (to reseed after a restart); module-level `threading.Lock` guards every mutation of the shared `_data` dict + the `pickle.dump` — `set()` is now called from multiple real OS threads at once (history.py's chart-fetch concurrency runs each request via `asyncio.to_thread`), and without it one thread's `prune()`/dict-mutation could race another's `pickle.dump()` iterating the same dict (`RuntimeError: dictionary changed size during iteration` — hit live in production); `set()`'s actual disk write (full re-pickle of `_data`) is debounced to once per `_SAVE_DEBOUNCE=5s` regardless of call frequency — the in-memory dict (shared singleton, all `Cache()` instances) still updates synchronously so `get()` always sees the latest value, only the disk flush is coalesced; `save()`/`set_fifo()`/`invalidate()` bypass the debounce (immediate write) since they're low-frequency
  data_loader.py            CSV ingestion — single schema only (no more raw-broker MSP auto-detect, removed 2026-06-21); REQUIRED_COLUMNS = date/symbol/exchange/type/quantity/price/portfolio; charges/currency/yf_symbol/tags/name/buy_fx_rate optional/derived; `tags` (Bucket=Label;Bucket=Label string) defaults to "" when absent. A raw broker export must be reshaped into this schema first via `scripts/convert_broker_export.py` (contains the old MSP-format transform logic, now an explicit one-off conversion step instead of silent auto-detection on import)
  portfolio.py              FIFO engine; _Lot dataclass has buy_fx_rate + is_usd fields (is_usd added session 150 — only True when buy_fx_rate is a real rate >1.5, not the INR default 1.0); _run_fifo returns (holdings, realized, fx_lots); fx_lot_rows only emitted when lot.is_usd — previously emitted for every lot regardless of currency, so an INR lot's price got multiplied by (usd_inr - 1.0) downstream as a bogus FX gain; calculate_holdings aggregates fx_lots across portfolios; carries `tags` through to holding/realized rows; `enrich_holdings()` adds `quote_type` (EQUITY/MUTUALFUND/ETF) from ticker_info
  price_fetcher.py          yfinance wrappers; loads names from data/names.json first (Render-safe fallback); get_prices_and_prev_close()/get_usd_inr_rate() try Yahoo's lightweight v7/finance/quote endpoint first (single small JSON vs 5-day OHLCV download — ~10x faster), falling back to the old yf.download path on failure; both wrapped in `_with_hard_timeout()` (ThreadPoolExecutor, 10s wall-clock cap) — yfinance's own cookie/crumb fetch ignores the `timeout` kwarg on one internal code path (always its unbounded ~30s default), so this is the only way to actually bound worst-case latency; a hung attempt is abandoned (thread keeps running in background) and the fallback runs immediately; `get_tickers_info()` also fetches `quoteType` (1 retry + 0.5s backoff on throttle, then falls back to a `0P`-prefix symbol check for Indian MF — needed because Yahoo throttles the per-symbol `.info` loop on large portfolios, silently returning EQUITY for ~80% of MF holdings without the fallback); `_static_names` cache entries missing `quote_type` are treated as stale and re-fetched live
  schema.py                 Frozen schema + validation
  xirr.py                   XIRR calculation

backend/
  main.py                   FastAPI app; CORS hardcodes https://stock-analyzer-blush.vercel.app + reads ALLOWED_ORIGIN env var (additional origin); load_dotenv() reads .env for local dev (python-dotenv)
  serializers.py            PortfolioBundle → JSON-safe dict (NaN/Timestamp/numpy handling); serializes fx_lots list
  routers/
    portfolio.py            GET /api/portfolio?currency=INR&force_refresh=false
    history.py              GET /api/history?yf_symbol=INFY.NS&start=YYYY-MM-DD&since=YYYY-MM-DD OR ?period=1d (intraday; timestamps in IST; includes prev_close); daily history cached as one contiguous per-symbol series in `_series_cache` (not month-bucketed), **trimmed to `_RETENTION_DAYS=15`** after every write (`_trim()` in `_save_entry()`) — the client's own IndexedDB cache holds the deep multi-year history, so the server only needs enough of a tail to serve cheap deltas; `_covers(entry, needed_from)` checks whether the resident (possibly trimmed) window or the caller's `since` hint actually reaches back far enough before trusting a cache hit — both the route's fast path and `_fetch_incremental()` fall through to a full fetch instead of silently returning a truncated range when it doesn't; `_fetch_incremental()` re-fetches only from the last cached bar forward and merges when the window does cover what's needed; staleness gated by `market_hours.is_stale()` instead of a flat TTL; `_series_cache`/`_intraday_cache` capped to the 120 most-recently-fetched symbols each (`_evict_oldest()`, lowered from 300 — real portfolio is ~80-90 symbols, 300 was mostly holding one-off Explore lookups); persisted directly to its own file `data/.hist_cache.pkl` (not mirrored into `src.cache`'s shared `Cache` singleton — that duplicated the whole cache's memory footprint for no benefit); intraday fetch (`_fetch_intraday`) runs the 5m-bars download and the prev_close lookup concurrently via `asyncio.gather` instead of sequentially, and prev_close now uses `price_fetcher.get_prices_and_prev_close()` (lightweight quote) instead of a second full OHLCV download; `_sem` concurrency cap is 3 (4→8→4→3 across sessions — 8 pinned the 512MB ceiling outright; even at 4, a first-load "double-cold" burst — empty server cache + empty client cache simultaneously, e.g. right after this session's IndexedDB migration — plateaued at ~513MB, so trimmed further to 3, trading some burst-clear time for a lower peak); `_download()`/`_fetch_intraday_bars()` `del df` immediately after extracting the `Close` series (`.copy()`'d first so it's detached from the parent frame's memory); `_trim_memory()` (new) forces `gc.collect()` + libc `malloc_trim(0)` after a burst settles (debounced 5s, lowered from 30s session 155) — glibc's allocator doesn't hand freed memory back to the OS on its own, so the process's reported RSS can stay elevated near its peak long after the actual resident cache has shrunk back down; no-ops safely on non-Linux; `_direct_trim()` (new, session 155) is the non-debounced variant called immediately after each per-symbol `_download()` in `_fetch_incremental` so freed pages return to OS between symbols in a burst, not only after the whole burst settles. `since` query param (optional) lets the client hint its own already-cached last date — lets a request be answered from the short resident window even when it doesn't reach back to `start`, since the caller already has everything older than `since` themselves; when neither the resident window nor `since` cover what's needed, a full fetch runs and is returned to that caller in full, but only the trimmed recent window is kept resident afterward
  market_hours.py           is_indian_symbol() (.NS/.BO suffix check); is_market_open(yf_symbol, now_utc) — flat trading-hours window per exchange (Indian 09:15–15:30 IST, US 09:30–16:00 ET via zoneinfo, DST-correct); last_close_before(); is_stale(yf_symbol, last_fetch_ts, last_bar_date, now_utc?) — market open → stale after 30min since last fetch (matches frontend auto-refresh tick); market closed → stale only if no bar captured since the most recent close. No holiday calendar/early-close handling (accepted: worst case is one harmless no-op yfinance call)
    quickstats.py           GET /api/quickstats?yf_symbol=...&force_refresh=false (fundamentals + analyst; 30min mem _MEM_TTL=1800s + 30-day disk per-symbol key "qs:{key}"); rec_label normalizes yfinance "none" → "Neutral"; Indian stocks: Screener.in scrape overrides PE/PB/ROCE/ROE/DivYield/MCap/52W + Compounded Sales/Profit Growth 3Y+TTM; trailing_pe NOT from yfinance for Indian stocks (unreliable — returns wrong values); Screener is primary PE source, price/EPS is computed fallback; if Screener succeeds, partial=False even when yfinance info empty; debt_to_equity: yfinance returns as percentage → backend divides by 100; (2026-06-23) Screener overlay extended to debt_to_equity/return_on_assets/profit_margins/trailing_eps for Indian stocks too — yfinance rarely populates these for Indian tickers (esp. recent IPOs); `_screener_row_values(html, label)` parses the Balance Sheet/P&L tables' latest column (handles both plain and expandable `<button>+</button>`-wrapped row labels); D/E=Borrowings÷(Equity Capital+Reserves), ROA=Net Profit÷Total Assets, Net Margin=Net Profit÷Sales, EPS=last "EPS in Rs" row — `result.update(screener)` overlay pattern means these only override yfinance when Screener actually returns a value, yfinance stays as fallback otherwise; _with_timeout(fn, timeout=12.0) wraps all blocking yfinance calls via ThreadPoolExecutor to prevent hangs; US stocks: yfinance + _compute_roce() + _compute_growth_3y() from income_stmt + _fetch_macrotrends_pe() for PE history; PEG fallback = PE/(earningsGrowth×100) when yfinance null; _yf_ticker() returns plain yf.Ticker(symbol) — requires curl_cffi installed; top-level try/except returns {"partial":True} instead of 503; partial results NOT cached to disk or memory (so retries always hit yfinance fresh); _compute_1y_data() returns (one_year_return, price_1y_ago, current_from_history) from 1Y DAILY history; current_price uses history end-bar as fallback when yfinance info empty; partial=True only when current_price is None AND info empty; _compute_5y_cagr() returns annualised 5Y price CAGR from monthly history; fields: trailing_pe, forward_pe, price_to_book, peg_ratio, debt_to_equity, return_on_equity, return_on_assets, roce, profit_margins, trailing_eps, revenue_growth, revenue_growth_3y, earnings_growth, earnings_growth_3y, dividend_yield, beta, market_cap, week_52_*, recommendation, target_mean_price, upside_pct, pe_history, company_name, sector, industry, one_year_return, price_1y_ago, five_year_cagr
    search.py               GET /api/search?q=... — proxies Yahoo Finance v1/finance/search; returns EQUITY+ETF results [{symbol, name, exchange}]; max 6 results; 8s timeout; used by PortfoliosPage Explore section autocomplete
    filing.py               GET /api/filing/{symbol} — serves latest quarterly investor presentation PDF from BSE (downloads with proper headers, caches 2h in-memory); GET /api/filing/{symbol}/text — same but returns plain text extracted by pdfplumber (prefers Financial Results PDF over large PPT; first 30 pages; 15MB cap); scrip code from hardcoded map (50+ stocks) or BSE dynamic lookup; BSE rows sorted newest-first (by DT_TM desc) before _pick_target selection so latest filing is always returned, not oldest in window
    gemini.py               POST /api/gemini — async; attempt 1a: gemini-2.5-flash + grounding + thinking_budget=8192 (bounded, ~15-20s), 45s timeout; attempt 1b on timeout: same model + grounding, thinking_budget=0, 55s timeout; attempt 2 fallback: gemini-3.1-flash-lite plain (500 RPD), retries once; any non-auth error on attempt 1 falls through to attempt 2; body: {symbol, section_id, prompt, force_refresh?, force_lite?, key_index?}; returns {text, sources[], grounded, model}; 1h in-memory cache per (symbol, section_id, force_lite, key_index); keys read from env vars GEMINI_KEY_MAIN / GEMINI_KEY_BACKUP / GEMINI_KEY_3 via _load_keys() at request time; local .env loaded at module start for dev; _heavy flag (peers section) extends timeouts to 70s+85s vs default 45s+55s. POST /api/gemini/chat — free-form Q&A; body: {symbol, question, context_text, force_lite?, key_index?}; same grounding cascade as /api/gemini; prompt instructs model to search beyond context for historical/trend data; no caching; returns {text, sources[], grounded, model}. POST /api/gemini/stream (REWORKED 2026-06-23 — this is the one ReportTab's Deep Research cards actually call) — default path: gemini-2.5-flash, and on failure now AUTOMATICALLY falls back to gemini-2.5-flash-lite in the same request (previously required a manual frontend retry click); yields `data: {progress: "..."}` right before that fallback attempt starts, so the UI can show a real status line instead of a generic "still working" guess; if 2.5-flash-lite ALSO fails, yields `data: {error: "gemini_both_failed", detail}` and stops — no more silent auto-jump to ungrounded gemini-3.1-flash-lite; 3.1 is now ONLY reachable via explicit `force_31=true` (a manual user action). `force_lite=true` (explicit lite request, e.g. a default-model setting) also no longer silently falls back to 3.1 on failure — same `gemini_both_failed` terminal error. All raw SDK exception strings now go through `_clean_error_message(err)` before being sent to the frontend — maps quota/503-overload/timeout/auth errors to a fixed clean sentence, otherwise cuts at the first newline (not a blind `[:400]` mid-word character slice, which is what previously showed truncated raw JSON-ish SDK error text in the UI). Still: yields `data: {text}` chunks as tokens arrive (thought parts filtered out), then `data: {done, sources[], model, grounded}`; cache hit replays full text as single chunk then done; X-Accel-Buffering:no header disables Render nginx buffering; STREAMING PATTERN: generate_content_stream() is a coroutine — must `stream = await c.aio.models.generate_content_stream(...)` then `async for chunk in stream` (NOT `async for chunk in c.aio.models.generate_content_stream(...)` — that fails with __aiter__ error). POST /api/gemini/chat/stream — SSE streaming version of /api/gemini/chat; UNCHANGED this session (still old cascade 2.5-flash → 2.5-flash-lite → 3.1-flash-lite, no progress events) — only the section-card stream (`/api/gemini/stream`) was reworked, scoped deliberately since that's what the user's bug report was about; no caching. SSE helpers: _sse(dict)→str, _chunk_text(chunk)→str (filters thought=True parts), _chunk_sources(chunk)→list[str], _clean_error_message(err)→str (new)
    add_txn.py              POST /api/portfolio/add-txn?csv_hash={hash} — loads existing txns from FIFO cache via csv_hash, appends new row(s), runs _fill_usd_fx_rates if USD, rebuilds full bundle via engine.build(csv_content=), returns {portfolio, csv, csv_hash}; one row appended per portfolio in portfolios[] array; new csv_hash stored under new FIFO slot. Same file also has POST /api/portfolio/set-tags and POST /api/portfolio/delete-holding (session 143) — delete-holding masks by portfolio(+symbol), optionally narrowed to one exact transaction row via date/type/quantity/price (no stable row ID in the CSV schema, so exact-field-match is the only way to target a single row); drops matched rows, rebuilds bundle, same return shape. `_EXPORT_COLS` trimmed to 8 columns (date/symbol/exchange/type/quantity/price/portfolio/tags) 2026-06-21 — every export path now matches the single import schema exactly; currency/yf_symbol/buy_fx_rate/name/charges all regenerate on next load
    portfolio_history.py    GET /api/portfolio-history?currency=INR&portfolio=&segment= — bulk yf.download(all_symbols)['Close'] in one call (not 80 individual /api/history calls); computes full PortfolioSeries (value/invested/unrealized/realized/total/returnPct/xirrTrend) server-side; gc.collect()+malloc_trim(0) called immediately after download (not debounced); 30-min in-memory _cache per (currency,portfolio,segment) key; eliminates the 80-request burst that caused OOM on fresh chart loads. Frontend: useBackendPortfolioHistory.ts hook returns PortfolioSeries|null; portSeries in HoldingsPage now from this hook. usePortfolioHistory.ts retained for symbolPriceMap only, start date 2015→2022, lsKey ${sym}:3y (separate from useHistory.ts's ${sym}:${start} key to avoid cross-contamination). history.py _TRIM_DEBOUNCE 30s→5s so freed pages return to OS faster during per-symbol burst.
    dividends.py            GET /api/dividends?force_refresh=false&symbols=A.NS,B.NS — `symbols` param (session 156) limits _compute to those yf_symbols only, skips in-memory cache (used by frontend batched fetch); parallel fetch: ThreadPoolExecutor(max_workers=10) for the batch; 24h in-memory cache skipped for partial requests; caching: per-symbol 30-day disk cache "divs:{YF_SYMBOL}" + 24h in-memory per portfolio; stocks only (MF IDCW excluded); GET /api/dividends/debug?symbol=X; response: {summary, by_symbol, by_year, by_month, timeline, skipped_symbols}
  requirements_backend.txt  Backend-only deps

frontend/
  src/
    api/types.ts            TypeScript interfaces matching backend JSON; FxLot interface {symbol,yf_symbol,portfolio,date,qty,cost_usd,buy_fx_rate}; Holding adds avg_buy_fx_rate/fx_gain/disp_fx_gain; Transaction adds buy_fx_rate; PortfolioData adds fx_lots: FxLot[]; PortfolioData adds csv_hash?: string (present only on POST/real-CSV responses, absent on GET/demo responses — used as the "is this real data" signal)
    api/portfolio.ts        fetch wrapper (uses VITE_API_URL env var)
    hooks/usePortfolio.ts        TanStack Query, staleTime=30min, gcTime=Infinity, refetchInterval=30min, refetchIntervalInBackground=false, refetchOnWindowFocus=false, refetchOnMount='always', retry 3 retryDelay 20s; auto-refresh persists across page navigation and tab minimise (all 3 pages subscribe → query always has active observer); useForceRefresh() uses qc.fetchQuery({staleTime:0,force_refresh:true}) for on-demand fresh prices; CSV upload mode: reads portfolio:csv from localStorage and POSTs to /api/portfolio if present, else GET returns demo data from demo_msp_v2.csv; fetchPortfolioGuarded() throws if a CSV was sent but the response lacks csv_hash (forces a retry instead of silently caching/showing demo data over real data); ALWAYS fetches currency=INR from backend regardless of USD toggle — all disp_* values are INR; per-portfolio USD conversion done on frontend (HoldingsPage/TransactionsPage/DividendsTab) using USD_PORTS membership check; queryKey is ['portfolio'] (no currency in key)
    hooks/useHistory.ts          TanStack Query for price history; REFRESH_MS=30min exported (matches usePortfolio.ts cadence) — open/default symbols get staleTime+refetchInterval=REFRESH_MS plus a visibilitychange elapsed-check effect (mobile timer suspension); `isClosed?` param (4th arg) switches to staleTime:Infinity (no auto-tick, still fetches fresh on every mount) + CLOSED_LS_TTL (30d) cache TTL instead of LS_TTL (7d); daily queryKey=['history',yf_symbol] (no start in key — shares React Query cache with usePortfolioHistory); intraday queryKey=['history',yf_symbol,'1d']; lsKey=${yf_symbol}:${period??start}; placeholderData from cache for instant chart render; lsGet(key, ttlMs?) takes an optional TTL override. `lsGet`/`lsSet`/`lsGetTimestamp` are now backed by `utils/idbStore.ts` (IndexedDB) instead of `localStorage` — same sync-call ergonomics (React Query's `initialData`/`placeholderData` need a value synchronously), but no more ~5-10MB quota wall; the old quota-eviction fallback (`evictOldestHist`) was removed as dead code along with the migration. `usePrefetchHoldingCharts()` issues prefetch requests in batches of 20 (`BATCH`) instead of firing all ~150-200 symbols at once — reduces pending-request overhead on the backend during a cold-cache burst with no added delay (the backend's own concurrency limit already gates real throughput)
    hooks/usePortfolioHistory.ts useQueries per-symbol history → value/invested/P&L/return/xirr series; exposes loadedCount+totalCount+fetchingCount+symbolPriceMap (Map<yf_symbol,Map<dateStr,price>>); extraSymbols? param fetches closed-symbol prices into symbolPriceMap; closedSymbols? param (new) — subset of symbols treated as fully-exited: separate `['history-closed',sym]` queryKey (excluded from any `refetchQueries({queryKey:['history']})` call), no 30-min refetchInterval, `enabled` skips the network once a <30-day localStorage entry exists; prioritySymbols? param (new) reorders the fetch queue so the caller's active-view symbols are issued first; open symbols get the same REFRESH_MS auto-refresh + visibilitychange pattern as useHistory.ts; qty-delta accumulation (build invested/value series) walks a sorted-pointer per holding that catches up any tx dated on/before the current chart date (2026-06-20 fix) — previously used exact-date `Map.get(d)`, which silently dropped any BUY/SELL whose date had zero trading bars across every held symbol (market holiday/weekend), undercounting invested for the rest of that holding's history until the "today" pin (live disp_invested) masked it as a sudden end-of-chart jump
    hooks/useBenchmarkXirr.ts    useQueries benchmark histories in parallel; queryKey ['benchmark-hist', sym] fixed at BENCH_START='2015-01-01' (portfolio/segment-agnostic — switching views never re-fetches); useRefreshAllBenchmarks() force-fetches every SECTOR_BENCHMARK index directly + setQueryData (avoids fetchQuery/useQueries observer dedupe race); Option B period XIRR (opening balance at T1, terminal at T2); sector + per-holding XIRR vs benchmark; exports holdingBenchXirr Map + loadedCount+totalCount+fetchingCount; params: periodStart/periodEnd/symbolPriceMap; Other sector excluded from overallActual/overallBench cashflows
    hooks/useQuickStats.ts       TanStack Query ['quickstats', yf_symbol]; staleTime=Infinity; enabled when Report tab active; throws on partial:true response so TanStack Query auto-retries; retry 2×15s delay; partial results never cached; 12h cache backed by `utils/idbStore.ts` (IndexedDB, migrated from localStorage)
    hooks/useAddTransaction.ts   useMutation: POST /api/portfolio/add-txn?csv_hash={hash}; onSuccess: saves portfolio:csv, portfolio:csv:hash, portfolio:csv:meta to localStorage; qc.setQueryData(['portfolio'], data.portfolio); clears dividend localStorage cache; qc.invalidateQueries(['dividends'])
    hooks/useDeleteHolding.ts    useMutation: POST /api/portfolio/delete-holding?csv_hash={hash}; body {deletions: [{portfolio, symbol?, date?, type?, quantity?, price?}]}; same onSuccess cache-update shape as useAddTransaction/useSetTags
    components/ManagePortfolioModal.tsx   Landing menu opened from HoldingsPage Settings → "Manage Portfolio" row; 3 options (Add/Delete/Copy) each open their own full modal (AddTransactionModal / DeleteHoldingModal / PullHoldingsModal); Add disabled when not on a real broker page (bucket/label or Total), Copy disabled when on a real broker page
    components/DeleteHoldingModal.tsx     Portfolio/Bucket-Label scope picker (optgroups: real portfolios + every bucket's labels), auto-filled+locked (disabled select) when opened with preFilledPortfolio or preFilledBucket+preFilledLabel from the current page. Portfolio scope = real permanent delete (POST delete-holding) via per-holding checklist with "Show txn" per-transaction granularity. Label/Bucket scope = untag only (POST set-tags, label='') — never deletes real transactions, since the same symbol can be tagged in from multiple brokers; selection is whole-holding only (no per-transaction picks, since a tag isn't transaction-scoped). Holdings list (`holdingsInScope`) includes closed (fully-sold) positions synthesized from transactions, not just `data.holdings`, so a closed holding can still be found/untagged/deleted
    components/PullHoldingsModal.tsx (Copy Holdings)  Bucket+Label select/input locked (disabled) when opened with preFilledBucket+preFilledLabel from a Bucket/Label page — destination is unambiguous from navigation context
    utils/fmt.ts                 fmtINR/fmtUSD/fmtPct/fmtGainLine
    utils/segments.ts            classify.py TypeScript port
    utils/realized.ts            _agg_realized() TypeScript port
    utils/xirr.ts                Client-side XIRR (bisection + Newton fallback)
    utils/sectors.ts             SYMBOL_SECTOR (170+ symbols → SectorKey incl. all MF funds + closed positions), SECTOR_COLOR, SECTOR_BENCHMARK, BENCHMARK_LABEL, getSectorForHolding(); 11 sectors: Banking/Finance/Healthcare/IT/Growth/Tech/Smallcap/Equity/Consumer/Global/Other; Global=#6366f1 ^GSPC (S&P 500-themed MFs); Consumer=#ec4899 ^CNXFMCG; Smallcap=NIFTY_MIDCAP_100.NS; all 70 MF symbols classified; MarketCapKey, MARKET_CAP_COLOR, SYMBOL_MARKET_CAP, getMarketCapForHolding()
    api/gemini.ts                fetchGeminiSection / fetchGeminiChat — legacy non-streaming helpers (kept); streamGeminiSection(symbol, sectionId, prompt, forceRefresh?, forceLite?, keyIndex?, force31?) → AsyncGenerator<StreamChunk>; streamGeminiChat(symbol, question, contextText, forceLite?, keyIndex?, force31?) → AsyncGenerator<StreamChunk>; StreamChunk: {text?, done?, sources?, model?, grounded?, error?, detail?, progress?} (progress field added 2026-06-23 for the gemini.py auto-fallback status line); _readSSE(response) shared SSE parser (buffer-based, handles split chunks)
    utils/geminiGenerationStore.ts (new, 2026-06-23) Module-level (NOT React state) pub/sub store for in-flight Deep Research generations, keyed `${yfSymbol}::${sectionId}`. Lives outside any component's lifecycle so a generation survives ReportTab unmounting (page navigation, brief app backgrounding) — the fetch was never actually tied to the component before this either, but progress was lost on remount since only the final chunk was persisted; now every streamed chunk is written to IndexedDB (`gemini:{yfSymbol}:{sectionId}`), not just the done one. `startGeneration()` is a no-op if a generation is already running for that key (remount just subscribes, doesn't double-fire); `subscribeGeneration`/`getGenerationState`/`getGenerationStartedAt` for the result state + elapsed-timer anchor; `subscribeProgress`/`getProgressNote` is a separate pub/sub channel for the new backend `progress` SSE chunks (doesn't touch the main state, since the section is still technically 'loading'). ReportTab.tsx's mount effect now checks this store before falling back to the IndexedDB snapshot, so navigating back mid-stream shows live progress instead of looking ungenerated.
    api/dividends.ts             DividendEvent / DividendSymbol / DividendsData (now incl. optional skipped_symbols) interfaces; fetchDividends(forceRefresh?, portfolio?, csvHash?, sinceHints?) → DividendsData; sinceHints={yf_symbol:last_ex_date} sent as JSON `since_hints` query param — lets backend fetch incrementally from the client's own IndexedDB knowledge when its own disk cache is cold (e.g. post-Render-redeploy)
    hooks/useDividends.ts        LS_KEY: global (portfolio='') → "dividends:cache:" (preserved); per-portfolio → "dividends:cache:v2:{p}" (v2 busts stale wrong-data entries where per-portfolio views showed full 1.75L instead of scoped amount); clearDividendLocalCache() wipes all "dividends:cache:*" entries (now via `idbKeys()`/`idbDelete()` in `utils/idbStore.ts`, migrated from localStorage — called on CSV upload)
    hooks/useDividends.ts        useDividends(portfolio?) — TanStack Query ['dividends', portfolio ?? ''], staleTime=30d, gcTime=Infinity, refetchOnWindowFocus=false, retry 2×5s; 30-day TTL cache (key: dividends:cache:{portfolio}, IndexedDB-backed via `utils/idbStore.ts`); placeholderData (NOT initialData) — shows localStorage data while fetching fresh; initialData would mark query as succeeded and block real fetch; queryFn saves to localStorage after fetch; useForceRefreshDividends(portfolio?) — thin wrapper over shared forceRefreshOne(qc,key,csvHash); useDividendForSymbol(symbol) — reads from ['dividends', ''] global cache (no portfolio filter); getIncludeDividends()/setIncludeDividends() — localStorage 'settings.includeDividends'; getIncludeFxGains()/setIncludeFxGains() — localStorage 'settings.includeFxGains'; useRefreshAllDividends() — force-refreshes every portfolio: priority portfolio (or global "" if none) first → global "" second (if priority wasn't already global) → remaining named portfolios throttled in chunks of 3; returns Promise<string[]> of deduped skipped_symbols aggregated across every call in the batch (surfaced as an amber banner + debugLog entry in HoldingsPage.tsx); getSinceHints() builds the per-symbol hints map from the cached global entry; forceRefreshOne fetches via fetchDividends(true,...) directly + qc.setQueryData (deliberately NOT qc.fetchQuery — fetchQuery dedupes by queryKey against any in-flight fetch from a mounted useQuery observer for the same key, e.g. PortfoliosPage's global useDividends(), silently swallowing the forced request); getLastDividendAutoRefreshMonth/setLastDividendAutoRefreshMonth — localStorage 'dividends:autoRefreshMonth', gates App.tsx's once-per-calendar-month automatic refresh (the only automatic dividends refresh that exists — otherwise purely manual via the HoldingsPage "Update" button); getDividendsLastFetched(portfolio?) — reads the real IndexedDB cache-write ts (not "now") for HoldingsPage's "last synced" label, fixing a bug where reopening the app with hours/days-old cached data showed it as freshly synced (same fix applied to charts via usePortfolioHistory.ts's lastFetchedAt, derived from each per-symbol query's dataUpdatedAt; benchmarking has no persisted cache so its existing "now" stamp was already accurate and left unchanged)
    utils/reportLinks.ts         SECTIONS (8 configs: business/industry/results/valuation/peers/financial/news/technical), SectionConfig interface includes color{bg,border,accentHex,btnSolid,btnOutline}; buildGeminiPrompt(name, sectionId, isIndian, yf_symbol?, apiUrl?) — injects today's date prefix + returns prompt string with FORMAT_SUFFIX; all 8 sections have per-section "Data requirement" line (Indian + US) instructing Gemini to use latest available filing/data; results section on Indian stocks embeds filing text URL; accentHex used for inline border styling (borderLeftWidth:4 borderTopWidth:2)
    utils/debugLog.ts        logDebug(msg)/getDebugLog()/clearDebugLog() — temporary diagnostic log persisted to localStorage key debug:csvlog (200-entry cap); survives reloads/SW updates; called from usePortfolio.ts (fetch start/done/error) and PortfoliosPage.tsx import handler (success/failure paths, distinguishes localStorage-quota failure from backend-POST failure)
    utils/idbStore.ts        (new) Shared key/value cache backed by IndexedDB instead of localStorage — quota is a slice of actual free disk (tens-to-hundreds of MB) instead of localStorage's fixed ~5-10MB per-origin ceiling, the root cause behind several past bugs (mobile CSV revert, silent write failures). `idbReady` (awaited in `main.tsx` before first render) hydrates the whole store into an in-memory `Map` once at boot; `idbGet`/`idbSet`/`idbDelete`/`idbKeys` read/write that Map synchronously (write-through to IndexedDB in the background) — preserves the synchronous-read ergonomics React Query's `initialData`/`placeholderData` need. Backs the `hist:*` (useHistory.ts), `qs:*` (useQuickStats.ts), `dividends:cache:*` (useDividends.ts), and `gemini:*`/`gemini:chat:*` (ReportTab.tsx/DeepResearchChat.tsx) caches; settings flags, CSV content/hash, and the debug log stayed on localStorage (small, not a quota concern)
    components/DebugOverlay.tsx  Temporary 🐛 floating button (bottom-left, 44px) → full-screen log viewer; shows portfolio:csv length/meta + localStorage total size & top-15 keys-by-size breakdown + timestamped event log; kept in production per user request as a safety net for the mobile CSV-persistence bug (see memory reference_mobile_csv_persistence.md) — remove App.tsx mount + this file + debugLog.ts + logDebug call sites when retired
    components/             LoadingSkeleton, SummaryCard (shared hero/summary card — used by PortfoliosPage/HoldingsPage/TransactionsPage for identical top-bar+card format; dividends?/fxGain? props render their row whenever defined, not gated on amount>0, so a toggled-on-but-₹0 value still shows; optional onClick for hero-card navigation), HoldingCard (fxGain? prop — both cards include FX in totalGain when prop provided, teal footer line), TxRow, AnalysisTab, ReportTab, DividendsTab, AddTransactionModal (props: open/onClose/data/preFilledSymbol?/preFilledSymbolName?/preFilledExchange?/preFilledCurrency?/preFilledPortfolio?/preFilledPrice?/lockSymbol?; gradient header + white body + emerald-50 section cards; debounced /api/search autocomplete; price pre-fill from holdings or /api/quickstats; uses useAddTransaction hook) (accepts reportTab/useLite/useKey props from TransactionsPage; Deep Research tab: 8 Gemini cards accordion+auto-expand, elapsed timer, react-markdown+remark-gfm; Quick Stats tab: 4×4 grid + 52W bar + analyst + PE History; sub-tab bar + model toggle + gear + sync in TransactionsPage violet strip; per-card 💬 Ask button + global Ask button → DeepResearchChat); DeepResearchChat (bottom-sheet chat modal: context selector pills, thread with markdown rendering, source links, 🌐 Live badge, 7d cache per yf_symbol via `utils/idbStore.ts`, migrated from localStorage); FxGainsTab (5th tab in HoldingsPage when FX toggle ON: summary strip, rate bucket bars, year/month collapsible timeline, per-holding table — derives all sections from filteredFxLots + usdInr; all teal color scheme)
    components/PriceChart.tsx  Price line chart (Recharts); props: transactions, yf_symbol, currency, usdInr, hideLegend? (hides BUY/SELL lines+Legend — used on Explore page), showZoom? (shows ⤢ button + ZoomChartOverlay); self-fetches via useHistory; range selector (`rangeBar`) always renders, including during the 1D loading/empty-data early-return states — previously those states returned before the range bar, leaving the user stuck unable to switch ranges if 1D had no cached data
    components/ZoomChartOverlay.tsx  Landscape zoom overlay using lightweight-charts v5; pinch zoom+pan+crosshair built-in; Crosshair mode (default) shows dashed H+V lines with axis labels; Range mode: tap 2 points → % gain + abs move displayed; takes allChartData (full unfiltered history)
    demo/                   (removed — superseded by CSV upload approach)
    pages/                  PortfoliosPage (FX toggle bg-teal-500; XIRR uses buy_fx_rate only when >10 guard — prevents 1.0 default contaminating Newton solver; handleImport: tracks csvWriteOk after localStorage.setItem('portfolio:csv', text) — only writes portfolio:csv:meta on confirmed success, else surfaces import-fail banner immediately, preventing the meta/content split that caused the mobile demo-data-revert bug; quota-fallback eviction prefix fixed 'history:'→'hist:' to match useHistory.ts's actual key prefix, plus evicts orphaned stock-analyzer-chart-cache key), HoldingsPage (filteredFxLots useMemo filters data.fx_lots by portfolio/segment; fxGainBySymbol guards USD_PORTS membership; FX tab visible only when filteredFxLots.length>0 — hides for Zerodha/Groww/AngelOne; XIRR uses buy_fx_rate>10 guard in xirrMap+filteredSummaryXirr), TransactionsPage, ResearchPage (/research/:symbol — officially called "Explore page"; explore any stock; 3 tabs: Research (Quick Stats+Deep Research) | Charts | Notes; overview card: company_name/sector (top-right)/CAGR 1Y text-[14px] right of price/CAGR 5Y + 52W range bottom row; max-w-xl mx-auto; no portfolio data dependency)
    App.tsx                 React Router routes
    main.tsx                 Awaits `idbStore.ts`'s `idbReady` before the first render (hydrates the IndexedDB cache into memory — fast, one cursor pass — so React Query's synchronous `initialData`/`placeholderData` reads against it are correct from the first render)
    vite-env.d.ts           declare const __BUILD_TIME__: string; declare const __APP_VERSION__: string (both injected by vite.config.ts define)
  public/
    manifest.json           PWA manifest (standalone display mode)
    icon.svg                App icon — dark bg + green chart line
  package.json              react 18, react-router-dom 6, @tanstack/react-query 5, recharts 2, @nivo/sunburst, @nivo/core, @tanstack/react-query-persist-client, @tanstack/query-sync-storage-persister, vite-plugin-pwa, react-markdown, remark-gfm
  vite.config.ts            /api proxy → localhost:8000 in dev; VitePWA plugin (autoUpdate, Workbox precache); define: {__BUILD_TIME__, __APP_VERSION__} both injected at build time; __APP_VERSION__ read from package.json via readFileSync at build time
  .env.production           VITE_API_URL=https://stock-analyzer-2nqw.onrender.com
  index.html                PWA meta tags + manifest link

data/
  msp_v2.csv                Transaction source file (source of truth)
  .cache.pkl                Persistent price/FIFO cache (do not delete)
  names.json                Static company name lookup (committed to git — used by Render where yfinance info calls fail)
```

---

## Navigation Flow (React Router)

```
/                            PortfoliosPage — hero + per-portfolio cards, By Type (default) / By Broker toggle + Explore New Holdings search section
/holdings/portfolio/:name    HoldingsPage — holdings list + Charts tab + sort control
/holdings/segment/total      HoldingsPage — all holdings across every portfolio
/holdings/bucket/:bucket/:label  HoldingsPage — holdings carrying that Bucket/Label (see Buckets & Labels below)
/research/:symbol            ResearchPage — research any stock (not just held); Quick Stats + Deep Research + Notes tabs
/transactions/:port/:sym     TransactionsPage — tx list + 8-metric Charts tab (Price + 7 historical)
```

---

## Data Flow

```
msp_v2.csv
  → data_loader.py   (parse, validate schema, normalise columns)
  → portfolio.py     (FIFO per portfolio → holdings, realized P&L)
  → price_fetcher.py (yfinance live prices + FX)
  → engine.py        (enrich with disp_* columns, return PortfolioBundle)
  → cache.py         (persist to data/.cache.pkl)
  → serializers.py   (PortfolioBundle → JSON)
  → FastAPI          (serves /api/portfolio, /api/history)
  → React            (TanStack Query, client-side filtering + display)
```

---

## API Endpoints

| Method | Path | Params | Notes |
|--------|------|--------|-------|
| GET | `/api/portfolio` | `currency=INR\|USD`, `force_refresh=false` | Returns demo bundle from `data/demo_msp_v2.csv`; 60s in-memory cache keyed `{currency}:demo` |
| POST | `/api/portfolio` | `currency=INR\|USD`, `force_refresh=false`; body: raw CSV text | Processes uploaded CSV (max 5MB); cache key `{currency}:{md5[:12]}`; passes csv_content to engine.build(); `ValueError` from schema validation (missing required columns etc.) now returns `400 {"error": msg}` instead of an unhandled 500 (2026-06-21) |
| GET | `/api/demo-csv` | — | Serves `data/demo_msp_v2.csv` as downloadable file; used by settings popover |
| GET | `/api/history` | `yf_symbol`, `start=YYYY-MM-DD` OR `period=1d`, `since=YYYY-MM-DD` (optional) | Daily price history — one contiguous per-symbol cache, incrementally fetched (only new bars pulled and merged in, not the full range every call), persisted to disk so a process restart doesn't force a full re-fetch; staleness gated by `market_hours.is_stale()` (open market: 30min; closed market: until next close) instead of a flat TTL. `since` is an optional client hint (caller's own last-cached date) used only when the server-side cache is cold, returning a delta tagged `partial_since` for the client to merge rather than a full range. Intraday 5-min bars use a separate 1hr cache; response includes `prev_close` (yesterday's daily close) and timestamps in IST |
| GET | `/api/quickstats` | `yf_symbol`, `force_refresh=false` | P/E, MCap, 52W range, analyst target from ticker.info; 60s in-memory + 24h per-symbol disk cache |
| GET | `/api/filing/{symbol}` | — | Latest quarterly investor presentation PDF from BSE; 2h in-memory cache |
| GET | `/api/filing/{symbol}/text` | — | Same filing as plain text (pdfplumber); prefers Financial Results PDF; 15MB cap; 30 pages max |
| POST | `/api/portfolio/add-txn` | `csv_hash` query param; body: `{date, symbol, exchange, type, quantity, price, portfolios[], currency, charges, name, tags?}` | Appends new txn row(s) to existing CSV (one per portfolio); rebuilds FIFO + bundle; returns `{portfolio, csv, csv_hash}`; client saves new CSV to localStorage and updates ['portfolio'] query cache |
| POST | `/api/portfolio/set-tags` | `csv_hash` query param; body: `{assignments: [{portfolio, symbol?, bucket, label}]}` | Merges `bucket=label` into the `tags` column for matching rows — `symbol` omitted = bulk push (whole portfolio), present = override one holding; merges into existing tags (other Buckets on that row survive); empty `label` clears that Bucket's tag (used for unassign/delete flows); rebuilds FIFO + bundle, same return shape as add-txn |
| POST | `/api/portfolio/delete-holding` | `csv_hash` query param; body: `{deletions: [{portfolio, symbol?, date?, type?, quantity?, price?}]}` | Drops every transaction row matching portfolio(+symbol); if date/type/quantity/price also given, narrows to one exact row (no stable row ID in the CSV schema). Rebuilds FIFO + bundle, same return shape as add-txn |
| POST | `/api/portfolio/import-merge-tags` | body: `{old_csv, new_csv}` | Re-importing a fresh broker export (`PortfoliosPage.tsx` Settings CSV upload) usually has no `tags` column, which would wipe Bucket/Label assignments. Carries `tags` forward from `old_csv` into `new_csv` by portfolio+symbol wherever the new row has none; returns `{csv}` only (no bundle) — client uses this merged CSV as the one it persists/sends to `POST /api/portfolio` |
| POST | `/api/gemini` | body: `{symbol, section_id, prompt, force_refresh?, force_lite?, key_index?}` | Attempt 1: gemini-2.5-flash + Google Search grounding; attempt 2 fallback: gemini-3.1-flash-lite plain; returns {text, sources[], grounded, model}; 1h cache per (symbol, section_id, force_lite); key_index selects Main(0), Backup(1), or Key3(2) API key |
| POST | `/api/gemini/chat` | body: `{symbol, question, context_text, force_lite?, key_index?}` | Free-form Q&A; same grounding cascade as /api/gemini; prompt forces web search beyond context; no caching; returns {text, sources[], grounded, model} |
| POST | `/api/gemini/stream` | body: `{symbol, section_id, prompt, force_refresh?, force_lite?, force_31?, key_index?}` | SSE; what ReportTab's Deep Research cards actually call. Default path now AUTO-cascades gemini-2.5-flash → gemini-2.5-flash-lite on failure (`data: {progress}` chunk announces it); if both fail → `data: {error: "gemini_both_failed", detail}` and stops — gemini-3.1-flash-lite is reachable only via explicit `force_31=true` (manual). Reworked 2026-06-23 — see Active File Map `gemini.py` entry for full detail |
| GET | `/api/search` | `q` | Yahoo Finance symbol search; returns [{symbol, name, exchange}] for EQUITY+ETF; used by Explore New Holdings autocomplete |
| GET | `/api/dividends` | `force_refresh=false`, `portfolio=` (optional), `csv_hash=demo` | Auto-fetched dividend history for all held stocks; scoped to single portfolio when `portfolio` param provided; 24h in-memory cache keyed by portfolio (`dividends:{csv_hash}:{portfolio or ''}`); reads from FIFO cache (user's uploaded CSV); `force_refresh=true` now also bypasses the per-symbol 30-day disk cache; **portfolio filter fallback (2026-06-28)**: when `portfolio` matches no rows in the `portfolio` column (e.g. a Label from "Copy Holdings"), falls back to tag-based filter — checks if any tag VALUE in the `tags` column matches the portfolio name (format: `"Bucket=Label;..."`) |
| GET | `/api/dividends/debug` | `symbol` | Debug: all transactions matching symbol + computed share count; used to diagnose share-count mismatches |
| GET, HEAD | `/health` | — | Returns `{"status":"ok"}`; used by keep-alive cron + UptimeRobot. Must accept HEAD — UptimeRobot's free plan always sends HEAD requests (HTTP method selection is Pro-only), and the route previously only registered GET (`@app.get`), causing a 100%-reproducible `405 Method Not Allowed` on every UptimeRobot check regardless of cold/warm state. Fixed via `@app.api_route("/health", methods=["GET", "HEAD"])` |

---

## PortfolioBundle Fields (JSON)

| Field | Type | Description |
|-------|------|-------------|
| holdings | array | One object per (portfolio, symbol) |
| transactions | array | All raw transactions post-FIFO |
| realized | array | Closed positions + dividends |
| usd_inr | float | Live FX rate (fallback ~95.5) |
| as_of | string | ISO timestamp of price fetch |
| cache_status | string | Human-readable cache summary |
| total_invested | float | Sum of disp_invested, SKIP_PORTS excluded |
| total_current | float | Sum of disp_current, SKIP_PORTS excluded |
| total_gain | float | total_current − total_invested |
| return_pct | float | total_gain / total_invested × 100 |
| xirr_total | float\|null | Annualised XIRR % across all non-SKIP portfolios. Convention (both `src/xirr.py` and frontend `utils/xirr.ts`): `0` means "no return signal yet" (too few cashflows, no sign mix, or cashflows spanning under 1 day — e.g. a holding bought today, or bought+sold same day; annualizing near-zero elapsed time is numerically unstable, checked by span not exact-day-equality since a midnight rollover mid-session can put same-day flows on different calendar days). `null` is reserved for a genuine solver failure and should be rare; UI renders it as `—`, never silently as `0.0%` |
| xirr_stk | float\|null | XIRR % for non-MF_ portfolios (stocks + US) |
| xirr_mf | float\|null | XIRR % for MF_ portfolios |
| xirr_by_portfolio | object | portfolio → XIRR % (non-SKIP only) |
| fx_lots | array | Open USD lots: `{symbol, yf_symbol, portfolio, date, qty, cost_usd, buy_fx_rate}` — for USD portfolios only; used by FxGainsTab |

---

## Holdings Object Fields

| Field | Type | Notes |
|-------|------|-------|
| portfolio | str | Portfolio name |
| symbol | str | Clean ticker (e.g. `INFY`) |
| exchange | str | `NSE`, `BSE`, or US exchange |
| yf_symbol | str | `INFY.NS`, `META` etc |
| currency | str | `INR` or `USD` (native) |
| quantity | float | Current open qty |
| avg_cost | float | Cost per share incl. charges |
| total_invested | float | qty × avg_cost |
| current_price | float | Live price |
| current_value | float | qty × current_price |
| unrealized_pnl | float | current_value − total_invested |
| pnl_pct | float | unrealized_pnl / total_invested × 100 |
| disp_invested | float | total_invested in display currency |
| disp_current | float | current_value in display currency |
| disp_gain | float | disp_current − disp_invested |
| disp_pnl_pct | float | disp_gain / disp_invested × 100 |
| today_gain | float\|null | Blended: shares held before today use (current_price − prev_close) × qty; shares bought today (`qty_bought_today`/`avg_cost_today` from `_run_fifo`) use (current_price − today's buy price) instead, since prev_close isn't a gain you actually held through |
| today_pct | float\|null | today_gain / blended baseline value × 100 (baseline uses prev_close for old qty, buy price for today's qty) |
| disp_today_gain | float\|null | today_gain in display currency |
| avg_buy_fx_rate | float\|null | FIFO-weighted INR/USD rate at purchase; null/1.0 for INR portfolios |
| fx_gain | float\|null | Extra INR return from USD/INR appreciation: `total_invested_usd × (usd_inr − avg_buy_fx_rate)` |
| disp_fx_gain | float\|null | fx_gain in display currency |
| quote_type | str | yfinance instrument type — `EQUITY`/`MUTUALFUND`/`ETF`; drives the auto-seeded "Asset Class" Bucket |
| tags | str | Bucket=Label;Bucket=Label assignments, e.g. `Asset Class=Stocks;Type=Indian Stocks` (see Buckets & Labels) |

---

## Cache Layers

### Disk cache (data/.cache.pkl)

| Layer | TTL | Invalidated by |
|-------|-----|----------------|
| fifo | permanent | source file mtime change |
| prices | 30 min | TTL expiry or force_refresh=true |
| prev_closes | 30 min | same as prices |
| fx | 30 min | same as prices |
| info | 7 days | TTL expiry |
| quickstats | permanent layer (24h per-symbol TTL managed in router) | force_refresh=true |
| hist:{symbol} | permanent layer (7-day `_PREFIX_TTL` ages out unused symbols via `prune()`; actual re-fetch necessity governed by `market_hours.is_stale()`, not this TTL) | `history.py`'s `_series_cache` write-through; survives OOM-restarts/redeploys within the same container |

Disk writes are debounced (`_SAVE_DEBOUNCE=5s` in `cache.py`) — a burst of `set()` calls (e.g. a multi-symbol chart fetch) coalesces into far fewer actual `pickle.dump`s instead of one full re-serialization of the whole cache dict per call. All mutation is guarded by a module-level `threading.Lock` (see Active File Map entry above).

### In-memory cache (backend routers)

| What | TTL |
|------|-----|
| portfolio bundle | 60s |
| price history (daily) | market-aware via `market_hours.is_stale()` — open market: 30min; closed market: until next exchange close (not a flat TTL); capped to 300 symbols (LRU by fetched_at) |
| price history (intraday 1d) | 1hr; capped to 300 symbols (LRU) |

### Browser localStorage (TanStack Query persister)

| What | TTL | Scope |
|------|-----|-------|
| benchmark histories (`['benchmark-hist', sym]`) | 3 days | persisted via `shouldDehydrateQuery`; eliminates blank Benchmarking tab on restart; key is portfolio/segment-agnostic (fixed BENCH_START anchor) so it's shared across all views; `benchmark:autoRefreshDay` localStorage gate drives a once-per-calendar-day auto-refresh of all SECTOR_BENCHMARK indices on app launch (`App.tsx`) |
| portfolio bundle (`['portfolio', currency]`) | 3 days | restores on reopen; staleTime=30min + refetchInterval=30min drives auto-refresh; ↻ button forces fresh yfinance hit |
| chart history (`hist:*`, `useHistory.ts`) | 7 days (open/default), 30 days (closed/fully-exited holdings via `CLOSED_LS_TTL`) | shared pool across Price chart, Holdings 7-charts, Portfolio 7-charts; open symbols also auto-refresh every 30min (`REFRESH_MS`) matching the portfolio bundle's own cadence; closed symbols skip the 30min auto-tick entirely and use a separate `['history-closed', sym]` query key so the chart Refresh button doesn't touch them; open-symbol queries seed `initialData`/`initialDataUpdatedAt` from the cache's real stored timestamp (`lsGetTimestamp()`) rather than `placeholderData` — so on app reopen within 30min, `staleTime` correctly judges the cache as still fresh and skips the background fetch entirely (previously `placeholderData` always re-fetched on every fresh mount regardless of cache age, causing a needless loader on every reopen); closed symbols still use `placeholderData` (unchanged, gated off via `enabled` instead) |

`history` and `quickstats` queries were removed from the global persister's `shouldDehydrateQuery` allowlist (2026-06-17) — they already have their own dedicated per-symbol localStorage caches (`hist:*` in `useHistory.ts`, `qs:*` in `useQuickStats.ts`), so persisting them again here was duplicating potentially MBs of data into the single `stock-analyzer-cache` blob, increasing the odds of hitting the device's storage quota on every fetch.

---

## Key Invariants

1. **FIFO isolation per portfolio** — `_run_fifo()` called once per portfolio group.
2. **`Equity`/`MF_Portfolio` pseudo-portfolios removed** (this session) — they were manually-duplicated aggregate rows that silently fell out of sync whenever a new transaction was added without hand-duplicating it. `SKIP_PORTS` in `frontend/src/utils/segments.ts` kept as a defensive no-op only.
3. **USD portfolios** — `Vested`, `IndMoney US`, `IndMoney Mummy` (`USD_PORTS`, still in `segments.ts` — currency concern, unrelated to classification). FX fallback ~95.5.
4. **Buckets & Labels are the classification system, fully manual (no auto-classification)** — replaced the old hardcoded `MF_`-prefix / `USD_PORTS` rules, and (session 143) also removed the `quote_type`-derived Stocks/Mutual Funds auto-fallback that originally seeded `Asset Class` — every Bucket including `Asset Class` now requires an explicit `tags` entry or resolves to `Unassigned`. See dedicated section below. `frontend/src/utils/buckets.ts` is the single source of truth; there is no backend equivalent for resolution (only for storage/mutation).
5. **yf_symbol format** — NSE → `SYMBOL.NS`, BSE → `SYMBOL.BO`, US → uppercase.
6. **Single API fetch** — entire bundle loaded once; all page transitions are client-side.
7. **Chart auto-refresh cadence** — Price chart, Holdings 7-charts, and Portfolio 7-charts all auto-refresh every 30 min, matching `usePortfolio.ts`'s own cadence, but remain a *separate* trigger (manual price sync and manual chart Refresh are two distinct buttons by design — chart refresh is N-symbol-heavy and shouldn't fire just because prices synced). Closed/fully-exited holdings are excluded from the 30-min tick in the 7-charts (still refresh on every Price-chart visit).

---

## Buckets & Labels (user-defined classification)

Replaced the hardcoded `MF_`-prefix / `USD_PORTS` Stock-vs-MF/Indian-vs-US rules. A **Bucket** is a
named classification dimension (e.g. `Asset Class`, `Type`, `Risk`); a **Label** is a value within it
(e.g. `Stocks`/`Mutual Funds` under `Asset Class`). A holding can carry one Label per Bucket, across
as many Buckets as the user creates.

- **Storage**: a single `tags` CSV column, e.g. `Asset Class=Stocks;Type=Indian Stocks` — portable
  through export/re-import, no schema change as Buckets are added/removed (`frontend/src/utils/buckets.ts`'s
  `parseTags`/`encodeTags`; backend mirror in `backend/routers/add_txn.py`'s `parse_tags`/`encode_tags`).
- **No auto-classification (session 143)**: `Asset Class` is still auto-seeded with Labels `Stocks`/
  `Mutual Funds` in the catalog, but resolving a holding's Label is explicit-tag-only now — the old
  `quote_type`-derived fallback (`quoteTypeToAssetClass`) was removed, so a fresh/recreated Label always
  starts at 0 holdings until tagged. This was a deliberate behavior change — all pre-existing holdings
  that relied on the implicit fallback now read `Unassigned` until bulk-tagged via Copy Holdings.
- **Catalog vs. assignments**: the *list* of Buckets/Labels (so pickers have something to show pre-assignment)
  is a small client-side catalog in `localStorage['buckets:catalog']` — not portable, trivial to recreate.
  The actual assignments live in `tags` (the portable source of truth). Label *order* within a Bucket is
  also stored here (`setLabelOrder()`), user-reorderable via a drag handle (Pointer Events, see
  Key Bug Fixes) in ManageBucketsModal, and drives card order everywhere (`getAllLabelsInBucket()`
  no longer alphabetizes — catalog order first, then any live-only labels appended sorted).
- **Manage Portfolio menu** (HoldingsPage Settings → "Manage Portfolio"): a landing menu
  (`ManagePortfolioModal.tsx`) offering 3 actions — **Add Holding** (`AddTransactionModal.tsx`),
  **Delete Holding** (`DeleteHoldingModal.tsx`, supports per-transaction granularity in both
  Portfolio and Label/Bucket scope, see Active File Map),
  **Copy Holdings** (`PullHoldingsModal.tsx`, bulk-push one or more brokers — each with its own
  All-Holdings-or-pick-holdings toggle — into a Bucket/Label; calls `POST /api/portfolio/set-tags`). Add is
  disabled on bucket/label/Total pages (no real portfolio to add into); Copy is disabled on a real broker
  page. `AddTransactionModal.tsx` also offers a per-Bucket selector when adding a new txn.
- **Delete Bucket/Label**: `ManageBucketsModal.tsx` can delete a whole Bucket or a single Label —
  confirms if holdings are affected, clears their `tags` entry via `set-tags` (sourced from
  `data.transactions`, not `data.holdings`, since a closed-out symbol's tag still needs clearing even
  with no current holding), then removes it from the catalog.

---

## Deployment

| Service | Platform | Auto-deploy trigger |
|---------|----------|---------------------|
| Frontend | Vercel | push to `master` |
| Backend | Render free tier | push to `master` |

Render cold start: 60–90s after inactivity (free tier spins down).
Keep-alive: GitHub Actions cron pings `/health` every 14 min to reduce cold starts (occasional jitter may miss the window).

---

## Key Bug Fixes

- `src/engine.py` `_xirr()`: removed `or hd.empty` from early-return guard — fully-closed portfolios (e.g. Upstox, all positions sold) now compute XIRR from BUY/SELL cashflows; previously returned None and showed "inv" instead of XIRR on broker tile
- `backend/routers/quickstats.py` `_compute_1y_data()` / `_compute_5y_cagr()`: added `math.isnan()` guards before returning computed floats — yfinance history sometimes appends a NaN Close bar; without the guard, `one_year_return = float('nan')` slipped into the result dict and caused `JSONResponse` to throw `ValueError: Out of range float values are not JSON compliant: nan`, triggering the outer except and returning `{partial: True}`. Also wrapped `one_year_return`, `price_1y_ago`, `five_year_cagr` in `_clean()` in the result dict as a final safety net.
- `frontend/src/pages/HoldingsPage.tsx` `filteredDivSymbols()`: only handled `segment === 'stk'`/`'mf'`; any other segment value (`indian_stock`, `us_stock`, `indian_mf`, `us_mf` — the Breakdown tiles) fell through to `allowed = null` → returned `undefined` → no filtering applied → every segment/portfolio's Dividends tab showed the same unfiltered global total. Fixed: fallback changed to `new Set([segment])`.
- `frontend/src/components/DividendsTab.tsx`: `activeSummary`/`activeSymbols`/`activeByYear` used `filterSymbols && filterSymbols.size > 0` to decide whether to apply the filter — when a segment legitimately has zero dividend-paying symbols (e.g. Mutual Funds), the empty-but-defined Set was treated as "no filter," falling back to the global summary instead of showing zero. Fixed: condition changed to `filterSymbols !== undefined`.
- Demo-data cache contamination recurred this session — a plain `curl GET /api/portfolio` (no CSV body, used to check the backend was up) rebuilt the FIFO cache from `data/demo_msp_v2.csv` and overwrote the user's real portfolio in `.cache.pkl`. Same root cause as the session 115 incident (see `feedback_engine_local_data` memory). Fix is always the same: refresh the frontend so it auto-POSTs the real CSV from `localStorage` and rebuilds the cache correctly — never hit `GET /api/portfolio` directly against a shared local backend without a CSV body.
- Live sync taking 50-90s and occasionally a 500 — root cause was yfinance's `_get_crumb_basic()` calling `_get_cookie_basic()` internally with no `timeout` forwarded at all (always its own unbounded ~30s default), so passing `timeout=` to the outer `_get_cookie_and_crumb()` never reached the slowest internal step. A first attempt at fixing this (passing an explicit timeout directly) didn't actually bound the worst case — confirmed via live testing (still 51-62s / crashes). Real fix: wrap the whole quote-fetch call in a hard wall-clock timeout via `ThreadPoolExecutor.result(timeout=10)` in `price_fetcher._with_hard_timeout()`, so a hang is abandoned regardless of what's happening inside yfinance. Verified live on Render: cold instance 17s, warm sync 4-5s (was 50-90s/crashing).
- Render "exceeded its memory limit" email — traced to `backend/routers/history.py`'s `_series_cache`/`_intraday_cache`, two unbounded in-memory dicts with no eviction (see Active File Map entry above for the fix).
- Charts tab progress counter visibly counting backward (e.g. 47/147 → 37/147) after the app was backgrounded and resumed — `HoldingsPage.tsx`'s `done = totalCount - histFetchingCount` formula (used once everything has loaded at least once) tracks *currently in-flight* requests, which rises and falls non-monotonically as a burst of refetches (every symbol going stale at once) churns through the backend's concurrency cap. Reproduced the exact mechanism with a standalone script (fixed totalCount, varying histFetchingCount → displayed count swings 147→127→102→117→87→...→147 even though real progress never reverses). Fixed with a monotonic clamp (`histMaxDoneRef`, resets only when a new fetch cycle starts).
- Render OOM-killed repeatedly (confirmed via Render API: events showed `oomKilled: memoryLimit:512Mi` roughly every 10-20 min) — root-caused to `history.py`'s `_sem` concurrency cap being raised 4→8 the prior session: each concurrent `yf.download()` holds a full OHLCV DataFrame, and 8 at once (~15.4MB/call, measured against real Render memory metrics: 413MB baseline → 536MB at concurrency 8) pinned the instance at its 512MB ceiling during any multi-symbol Charts-tab burst. Fixed by reverting to 4 and having `_download()`/`_fetch_intraday_bars()` `del df` immediately after extracting `Close`.
- `frontend/src/pages/HoldingsPage.tsx` `buildRows()`: the Mutual Funds aggregate card merged `portfolios`/realized-gain only from currently-*open* holdings — once one portfolio fully sold a symbol (qty hits 0, excluded from `data.holdings`), that portfolio silently dropped out of the merged card's nav target and realized-gain total, even though it still had a real, correctly-computed sell transaction. Root cause traced through several false leads (suspected stale aggregate-portfolio CSV duplication, suspected FIFO oversell, suspected stale cache) before finding the actual closed-position gap. Fixed by backfilling any portfolio with a `realizedMap` entry for that symbol into the merged row, not just open-holding portfolios.
- Disk-cache crash + fresh OOM introduced *while fixing the above* — persisting `_series_cache` to disk on every chart fetch (new this session) called `Cache.set()` → `pickle.dump()` of the *entire* cache dict (which also holds `fifo:*`/`qs:*`/`divs:*` data) once per symbol, with no thread lock. A multi-symbol burst running 4 concurrent `asyncio.to_thread()` calls raced on the shared dict — `RuntimeError: dictionary changed size during iteration` (confirmed live in Render logs) — and the repeated full-dict re-serialization itself triggered another OOM kill within 2 minutes of deploying. Fixed in `src/cache.py`: a module-level `threading.Lock` around all `_data` mutation/`pickle.dump`, plus debouncing the actual disk write to once per 5s regardless of `set()` call frequency (in-memory reads stay immediately consistent either way).
- `frontend/src/components/DeleteHoldingModal.tsx`: a symbol tagged into the same Label from two brokers showed as two separate (portfolio, symbol) rows; checking only one row left the other broker's tag intact, so the symbol kept reappearing on the Label page after "deleting." Fixed by merging same-symbol rows into one checkbox (`displayRows`/`rowKey`) for Label scope, untagging every backing portfolio at once.
- `frontend/src/pages/HoldingsPage.tsx` `buildRows()`: the "Grouped" viewMode toggle was supposed to merge a symbol across brokers into one card, but the merge branch only ran when `hasSegment` was also true — on the plain Holdings tab (no segment selected, the default state) it silently fell back to one row per portfolio regardless of the toggle. Fixed condition to only split per-portfolio when `mode === 'standalone'`.
- `frontend/src/components/DeleteHoldingModal.tsx`: per-transaction delete checkboxes were hidden in Label/Bucket scope entirely (only whole-holding untag was possible there) — now shown in both scopes; selecting individual transactions in Label scope permanently deletes them from their real broker portfolio (same mechanism as Portfolio-scope delete), while the whole-row checkbox still only untags.
- `DeleteHoldingModal.tsx`/`PullHoldingsModal.tsx`: native `window.confirm()` and a native `<select>` for "Add a broker" looked like OS popups rather than part of the app — replaced with in-app dialogs (rose confirm overlay, custom dropdown list) matching each modal's styling.
- `ManageBucketsModal.tsx`: ▲▼ label-reorder buttons (9px text, tiny tap target) weren't usable on mobile — replaced with a 44px drag handle using native Pointer Events (no new dependency); list reorders live as the dragged row crosses another row's midpoint.
- `ManageBucketsModal.tsx`: dragging a label still moved the page underneath — root cause was `PortfoliosPage.tsx`'s own pull-to-refresh, driven by native `touchmove` events on an ancestor div this modal renders inside (a separate event stream from Pointer Events, untouched by `preventDefault()`/body-overflow locking). Fixed by blocking `touchstart`/`touchmove` at the `window` in the capture phase for the drag's duration.
- `PullHoldingsModal.tsx`: broker-picker dropdown used an absolute-positioned overlay that flipped up/down based on space — but a short modal (few brokers) has no room in *either* direction, so it still spilled out. Switched to inline content in the modal's own scrollable body, which can never fail to contain it.
- `frontend/src/components/PortfoliosPage.tsx`: CSV import `<input accept=".csv">` greyed out a downloaded backup file on Android — file pickers filter by detected MIME type, not just extension. Broadened to `.csv,text/csv,text/comma-separated-values,application/vnd.ms-excel,text/plain`.
- `usePortfolioHistory.ts`/`useDividends.ts`: both used `placeholderData` instead of `initialData`, so `dataUpdatedAt` never got seeded from the real cache timestamp — every mount looked "instantly stale" and silently refetched, overwriting the displayed "last synced" time with "now". Fixed via `initialData`/`initialDataUpdatedAt` + `refetchOnMount:false`, plus a real-elapsed-time poll replacing the old mount-relative `refetchInterval` (which could drift up to ~2× the intended cadence).
- `backend/routers/dividends.py`: the 24h in-memory cache was caching incomplete results (some symbols timed out mid-fetch, cold disk cache after a deploy) for the full 24h — a bad first load stayed wrong until a manual force-refresh. Fixed: only cache when `skipped_symbols` is empty.
- `App.tsx`: dividends auto-refresh was gated by calendar-month string compare (could fire after 1 day across a month boundary, or sit 2 months if the boundary landed right after a fetch) — replaced with a real rolling-30-day check off the actual last-fetch timestamp.
- `src/engine.py` `build()`: any CSV mutation (tag edit, holding delete) minted a new content hash, which always looked FIFO-stale and unconditionally forced a full live yfinance price refetch for every symbol — measured 18-79s on an 82-symbol portfolio, the root cause of Copy Holdings "stuck at applying" reports. Now only forces the refetch when the symbol set itself changed.
- `src/cache.py`: `_MAX_FIFO_HASHES` raised 5→30 (session 148) — a single active editing session (tag edits, holding deletes, Copy Holdings) routinely mints more than 5 distinct content hashes, evicting the current one mid-session and turning the next `set-tags` call into a 404 "re-import your CSV" dead end. `useSetTags.ts` also made self-healing: on a 404, re-uploads the locally-stored CSV to re-seed the backend cache and retries once — covers both capacity eviction and a Render cold-start wiping the ephemeral disk cache entirely.
- **Reverted 30→5 (session 149)**: each FIFO entry pins full `txns`/`holdings_raw`/`realized`/`fx_lots` DataFrames in process memory forever — 30 of them from one long Copy Holdings/tag-edit session OOM-killed the 512Mi Render instance mid-`engine.build()`. Safe to lower again because the self-healing retry above (plus the same fix now applied to `dividends.py`'s `_load_txns`) means a cache-miss costs one extra round-trip instead of a dead end, so a large cap is no longer needed to avoid hard failures.

## Pending

- Dividends XIRR injection — `src/xirr.py` extra_cashflows param not yet implemented; dividends only shown as display overlay, not injected into XIRR calculation
- See ROADMAP.md for other backlog items

---

## Key Functions — Edit Anchors

| File | Function | Edit here when… |
|------|----------|-----------------|
| `backend/routers/portfolio.py` | `get_portfolio()` | Change API response shape |
| `backend/serializers.py` | `serialize_bundle()` | Change JSON serialisation |
| `src/engine.py` | `build()` | Add new bundle fields |
| `src/portfolio.py` | `_run_fifo()` | FIFO logic, realized_pnl |
| `src/cache.py` | `Cache` | Change cache TTLs |
| `frontend/src/pages/PortfoliosPage.tsx` | `PortfoliosPage`, `bucketCards()`, `buildTagLookup()` | Overview / hero card; bucketCards = one card per Label in the active Bucket; buildTagLookup = (portfolio:symbol)→{tags,quote_type} for classifying realized entries |
| `frontend/src/pages/HoldingsPage.tsx` | `HoldingsPage`, `buildRows()` | Holdings list + sort + XIRR; `benchTxns` (extends filtPorts with closedRows portfolios); `benchTxnsDate` (BUY-date-filtered benchTxns); `txnYears` (available years from transactions); `buildRows()` merges open holdings by symbol whenever viewMode is "Grouped" (was incorrectly gated on a segment being selected too — see Key Bug Fixes), "Standalone" keeps one row per portfolio — also backfills closed-but-realized portfolios |
| `frontend/src/pages/TransactionsPage.tsx` | `TransactionsPage` | Tx list + 8-metric charts |
| `frontend/src/utils/buckets.ts` | `getLabel()`, `resolveLabel()`, `filterByLabel()` | Bucket/Label classification — replaces old `segments.ts` `getSegmentType`/`filterBySegment` (removed) |
| `frontend/src/utils/sectors.ts` | `getSectorForHolding()` | Sector classification for Analysis tab |
| `frontend/src/hooks/useBenchmarkXirr.ts` | `useBenchmarkXirr()` | Sector + per-holding benchmark XIRR computation. Invariant (fixed 2026-06-22): takes an `isCumulative` flag and must key `holdingBench` by `portfolio:yf_symbol` (not bare `yf_symbol`) whenever it's false, to match `HoldingsPage.tsx`'s `xirrMap` aggregation level — otherwise a symbol held in >1 portfolio gets a per-portfolio actual XIRR compared against an all-portfolios-blended benchmark XIRR (wrong alpha). `isCumulative` is only ever true on the `/holdings/segment/:segment` route with Grouped view; bucket/label and single-portfolio routes are always per-portfolio. |
| `frontend/src/utils/fmt.ts` | `fmtINR/fmtUSD` | Number formatting |

---

## Commands

| Slash command | File | Does |
|---------------|------|------|
| `/save_state` | .claude/commands/save_state.md | Update doc files + memory files → git commit (no push) |
| `/ship` | .claude/commands/ship.md | git commit → git push → Vercel + Render auto-deploy |
