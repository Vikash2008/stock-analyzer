# Architecture — Multi-Portfolio Stock Analyzer

> Single source of truth for active components and finalized design.
> Everything not listed here is either dead code or not yet built.

---

## Active File Map

```
.github/
  workflows/
    keepalive.yml           GitHub Actions cron (*/14 * * * *) — pings /health to prevent Render cold start

CLAUDE.md                   Session rules, trigger table, prompt contract, boot protocol (65 lines)
QUICK_REF.md                Always-loaded compact reference — URLs, portfolio config, invariants, validated numbers, dev commands
FEATURE_MAP.md              Feature-to-file lookup — 28 features mapped to exact frontend + backend files; use instead of exploration

validate.py                 Terminal CLI (independent of backend)
testcases.md                Manual test cases — Charts tab + Portfolios page invariants
meta_filings_agent.py       Standalone research tool — fetches SEC EDGAR 10-Q/10-K for any US ticker, downloads HTML→text, uploads to Claude Files API, generates per-filing analysis + cross-quarter trend report; outputs meta_filings/META_Filing_Analysis.md

src/
  engine.py                 build(currency, force_refresh) → PortfolioBundle
  cache.py                  Disk cache (data/.cache.pkl) — prices/fx/prev_closes TTL 30min, info 7d
  data_loader.py            CSV ingestion, MSP auto-detect
  portfolio.py              FIFO engine, enrich_holdings()
  price_fetcher.py          yfinance wrappers; loads names from data/names.json first (Render-safe fallback)
  schema.py                 Frozen schema + validation
  xirr.py                   XIRR calculation

backend/
  main.py                   FastAPI app; CORS hardcodes https://stock-analyzer-blush.vercel.app + reads ALLOWED_ORIGIN env var (additional origin); load_dotenv() reads .env for local dev (python-dotenv)
  serializers.py            PortfolioBundle → JSON-safe dict (NaN/Timestamp/numpy handling)
  routers/
    portfolio.py            GET /api/portfolio?currency=INR&force_refresh=false
    history.py              GET /api/history?yf_symbol=INFY.NS&start=YYYY-MM-DD OR ?period=1d (intraday; timestamps in IST; includes prev_close)
    quickstats.py           GET /api/quickstats?yf_symbol=...&force_refresh=false (fundamentals + analyst; 30min mem _MEM_TTL=1800s + 30-day disk per-symbol key "qs:{key}"); rec_label normalizes yfinance "none" → "Neutral"; Indian stocks: Screener.in scrape overrides PE/PB/ROCE/ROE/DivYield/MCap/52W + Compounded Sales/Profit Growth 3Y+TTM; trailing_pe NOT from yfinance for Indian stocks (unreliable — returns wrong values); Screener is primary PE source, price/EPS is computed fallback; if Screener succeeds, partial=False even when yfinance info empty; debt_to_equity: yfinance returns as percentage → backend divides by 100; _with_timeout(fn, timeout=12.0) wraps all blocking yfinance calls via ThreadPoolExecutor to prevent hangs; US stocks: yfinance + _compute_roce() + _compute_growth_3y() from income_stmt + _fetch_macrotrends_pe() for PE history; PEG fallback = PE/(earningsGrowth×100) when yfinance null; _yf_ticker() returns plain yf.Ticker(symbol) — requires curl_cffi installed; top-level try/except returns {"partial":True} instead of 503; partial results NOT cached to disk or memory (so retries always hit yfinance fresh); _compute_1y_data() returns (one_year_return, price_1y_ago, current_from_history) from 1Y DAILY history; current_price uses history end-bar as fallback when yfinance info empty; partial=True only when current_price is None AND info empty; _compute_5y_cagr() returns annualised 5Y price CAGR from monthly history; fields: trailing_pe, forward_pe, price_to_book, peg_ratio, debt_to_equity, return_on_equity, return_on_assets, roce, profit_margins, trailing_eps, revenue_growth, revenue_growth_3y, earnings_growth, earnings_growth_3y, dividend_yield, beta, market_cap, week_52_*, recommendation, target_mean_price, upside_pct, pe_history, company_name, sector, industry, one_year_return, price_1y_ago, five_year_cagr
    search.py               GET /api/search?q=... — proxies Yahoo Finance v1/finance/search; returns EQUITY+ETF results [{symbol, name, exchange}]; max 6 results; 8s timeout; used by PortfoliosPage Explore section autocomplete
    filing.py               GET /api/filing/{symbol} — serves latest quarterly investor presentation PDF from BSE (downloads with proper headers, caches 2h in-memory); GET /api/filing/{symbol}/text — same but returns plain text extracted by pdfplumber (prefers Financial Results PDF over large PPT; first 30 pages; 15MB cap); scrip code from hardcoded map (50+ stocks) or BSE dynamic lookup; BSE rows sorted newest-first (by DT_TM desc) before _pick_target selection so latest filing is always returned, not oldest in window
    gemini.py               POST /api/gemini — async; attempt 1a: gemini-2.5-flash + grounding + thinking_budget=8192 (bounded, ~15-20s), 45s timeout; attempt 1b on timeout: same model + grounding, thinking_budget=0, 55s timeout; attempt 2 fallback: gemini-3.1-flash-lite plain (500 RPD), retries once; any non-auth error on attempt 1 falls through to attempt 2; body: {symbol, section_id, prompt, force_refresh?, force_lite?, key_index?}; returns {text, sources[], grounded, model}; 1h in-memory cache per (symbol, section_id, force_lite, key_index); keys read from env vars GEMINI_KEY_MAIN / GEMINI_KEY_BACKUP / GEMINI_KEY_3 via _load_keys() at request time; local .env loaded at module start for dev; _heavy flag (peers section) extends timeouts to 70s+85s vs default 45s+55s. POST /api/gemini/chat — free-form Q&A; body: {symbol, question, context_text, force_lite?, key_index?}; same grounding cascade as /api/gemini; prompt instructs model to search beyond context for historical/trend data; no caching; returns {text, sources[], grounded, model}. POST /api/gemini/stream — SSE streaming version of /api/gemini; same request body; yields data: {text} chunks as tokens arrive (thought parts filtered out), then data: {done, sources[], model, grounded}; on error yields data: {error, detail}; cache hit replays full text as single chunk then done; X-Accel-Buffering:no header disables Render nginx buffering; STREAMING PATTERN: generate_content_stream() is a coroutine — must `stream = await c.aio.models.generate_content_stream(...)` then `async for chunk in stream` (NOT `async for chunk in c.aio.models.generate_content_stream(...)` — that fails with __aiter__ error); retry: thinking=8192 first, if empty retry thinking=0. POST /api/gemini/chat/stream — SSE streaming version of /api/gemini/chat; same cascade (2.5-flash → 2.5-flash-lite → 3.1-flash-lite); no caching. SSE helpers: _sse(dict)→str, _chunk_text(chunk)→str (filters thought=True parts), _chunk_sources(chunk)→list[str]
    dividends.py            GET /api/dividends?force_refresh=false — auto-fetches yfinance dividend history for all held stocks; cross-references with holding periods (_shares_on_date: net BUY−SELL up to each ex-date, date-only comparison); stocks only (MF IDCW excluded); caching: per-symbol 30-day disk cache "divs:{YF_SYMBOL}" (_SYM_DIV_TTL=30×86400s) + 24h in-memory per portfolio ("dividends:{portfolio}"); parallel fetch: ThreadPoolExecutor(max_workers=10) runs _fetch_symbol_divs() for all symbols simultaneously; _load_txns() reads from shared FIFO cache (user's uploaded CSV) first, falls back to demo_msp_v2.csv; GET /api/dividends/debug?symbol=X — returns all matching transactions for diagnosis; IST fix: tz_localize(None) strips timezone without converting (tz_convert("UTC") shifts calendar date); USD→INR per event; response: {summary, by_symbol, by_year, by_month, timeline}
  requirements_backend.txt  Backend-only deps

frontend/
  src/
    api/types.ts            TypeScript interfaces matching backend JSON
    api/portfolio.ts        fetch wrapper (uses VITE_API_URL env var)
    hooks/usePortfolio.ts        TanStack Query, staleTime=30min, gcTime=Infinity, refetchInterval=30min, refetchIntervalInBackground=false, refetchOnWindowFocus=false, retry 3 retryDelay 20s; auto-refresh persists across page navigation and tab minimise (all 3 pages subscribe → query always has active observer); useForceRefresh() uses qc.fetchQuery({staleTime:0,force_refresh:true}) for on-demand fresh prices; CSV upload mode: reads portfolio:csv from localStorage and POSTs to /api/portfolio if present, else GET returns demo data from demo_msp_v2.csv; ALWAYS fetches currency=INR from backend regardless of USD toggle — all disp_* values are INR; per-portfolio USD conversion done on frontend (HoldingsPage/TransactionsPage/DividendsTab) using USD_PORTS membership check; queryKey is ['portfolio'] (no currency in key)
    hooks/useHistory.ts          TanStack Query for price history, staleTime+gcTime=Infinity; daily queryKey=['history',yf_symbol] (no start in key — shares React Query cache with usePortfolioHistory); intraday queryKey=['history',yf_symbol,'1d']; lsKey=${yf_symbol}:${period??start} for localStorage; placeholderData from localStorage (7d TTL) for instant chart render
    hooks/usePortfolioHistory.ts useQueries per-symbol history → value/invested/P&L/return/xirr series; exposes loadedCount+totalCount+fetchingCount+symbolPriceMap (Map<yf_symbol,Map<dateStr,price>>); extraSymbols? param fetches closed-symbol prices into symbolPriceMap
    hooks/useBenchmarkXirr.ts    useQueries benchmark histories in parallel; Option B period XIRR (opening balance at T1, terminal at T2); sector + per-holding XIRR vs benchmark; exports holdingBenchXirr Map + loadedCount+totalCount+fetchingCount; params: periodStart/periodEnd/symbolPriceMap; Other sector excluded from overallActual/overallBench cashflows
    hooks/useQuickStats.ts       TanStack Query ['quickstats', yf_symbol]; staleTime=Infinity; enabled when Report tab active; throws on partial:true response so TanStack Query auto-retries; retry 2×15s delay; partial results never cached
    utils/fmt.ts                 fmtINR/fmtUSD/fmtPct/fmtGainLine
    utils/segments.ts            classify.py TypeScript port
    utils/realized.ts            _agg_realized() TypeScript port
    utils/xirr.ts                Client-side XIRR (bisection + Newton fallback)
    utils/sectors.ts             SYMBOL_SECTOR (170+ symbols → SectorKey incl. all MF funds + closed positions), SECTOR_COLOR, SECTOR_BENCHMARK, BENCHMARK_LABEL, getSectorForHolding(); 11 sectors: Banking/Finance/Healthcare/IT/Growth/Tech/Smallcap/Equity/Consumer/Global/Other; Global=#6366f1 ^GSPC (S&P 500-themed MFs); Consumer=#ec4899 ^CNXFMCG; Smallcap=NIFTY_MIDCAP_100.NS; all 70 MF symbols classified; MarketCapKey, MARKET_CAP_COLOR, SYMBOL_MARKET_CAP, getMarketCapForHolding()
    api/gemini.ts                fetchGeminiSection / fetchGeminiChat — legacy non-streaming helpers (kept); streamGeminiSection(symbol, sectionId, prompt, forceRefresh?, forceLite?, keyIndex?, force31?) → AsyncGenerator<StreamChunk>; streamGeminiChat(symbol, question, contextText, forceLite?, keyIndex?, force31?) → AsyncGenerator<StreamChunk>; StreamChunk: {text?, done?, sources?, model?, grounded?, error?, detail?}; _readSSE(response) shared SSE parser (buffer-based, handles split chunks)
    api/dividends.ts             DividendEvent / DividendSymbol / DividendsData interfaces; fetchDividends(forceRefresh?, portfolio?) → DividendsData; appends ?portfolio=X to URL when provided
    hooks/useDividends.ts        useDividends(portfolio?) — TanStack Query ['dividends', portfolio ?? ''], staleTime=30d, gcTime=Infinity, refetchOnWindowFocus=false, retry 2×5s; localStorage 30-day TTL cache (key: dividends:cache:{portfolio}); placeholderData (NOT initialData) — shows localStorage data while fetching fresh; initialData would mark query as succeeded and block real fetch; queryFn saves to localStorage after fetch; useForceRefreshDividends(portfolio?); useDividendForSymbol(symbol) — reads from ['dividends', ''] global cache (no portfolio filter); getIncludeDividends()/setIncludeDividends() — localStorage 'settings.includeDividends'
    utils/reportLinks.ts         SECTIONS (8 configs: business/industry/results/valuation/peers/financial/news/technical), SectionConfig interface includes color{bg,border,accentHex,btnSolid,btnOutline}; buildGeminiPrompt(name, sectionId, isIndian, yf_symbol?, apiUrl?) — injects today's date prefix + returns prompt string with FORMAT_SUFFIX; all 8 sections have per-section "Data requirement" line (Indian + US) instructing Gemini to use latest available filing/data; results section on Indian stocks embeds filing text URL; accentHex used for inline border styling (borderLeftWidth:4 borderTopWidth:2)
    components/             LoadingSkeleton, SummaryCard, HoldingCard, TxRow, AnalysisTab, ReportTab, DividendsTab (accepts reportTab/useLite/useKey props from TransactionsPage; Deep Research tab: 8 Gemini cards accordion+auto-expand, elapsed timer, react-markdown+remark-gfm; Quick Stats tab: 4×4 grid + 52W bar + analyst + PE History; sub-tab bar + model toggle + gear + sync in TransactionsPage violet strip; per-card 💬 Ask button + global Ask button → DeepResearchChat); DeepResearchChat (bottom-sheet chat modal: context selector pills, thread with markdown rendering, source links, 🌐 Live badge, localStorage 7d per yf_symbol)
    components/PriceChart.tsx  Price line chart (Recharts); props: transactions, yf_symbol, currency, usdInr, hideLegend? (hides BUY/SELL lines+Legend — used on Explore page), showZoom? (shows ⤢ button + ZoomChartOverlay); self-fetches via useHistory; range selector built-in
    components/ZoomChartOverlay.tsx  Landscape zoom overlay using lightweight-charts v5; pinch zoom+pan+crosshair built-in; Crosshair mode (default) shows dashed H+V lines with axis labels; Range mode: tap 2 points → % gain + abs move displayed; takes allChartData (full unfiltered history)
    demo/                   (removed — superseded by CSV upload approach)
    pages/                  PortfoliosPage, HoldingsPage, TransactionsPage, ResearchPage (/research/:symbol — officially called "Explore page"; explore any stock; 3 tabs: Research (Quick Stats+Deep Research) | Charts | Notes; overview card: company_name/sector (top-right)/CAGR 1Y text-[14px] right of price/CAGR 5Y + 52W range bottom row; max-w-xl mx-auto; no portfolio data dependency)
    App.tsx                 React Router routes
    vite-env.d.ts           declare const __BUILD_TIME__: string (injected by vite.config.ts define)
  public/
    manifest.json           PWA manifest (standalone display mode)
    icon.svg                App icon — dark bg + green chart line
  package.json              react 18, react-router-dom 6, @tanstack/react-query 5, recharts 2, @nivo/sunburst, @nivo/core, @tanstack/react-query-persist-client, @tanstack/query-sync-storage-persister, vite-plugin-pwa, react-markdown, remark-gfm
  vite.config.ts            /api proxy → localhost:8000 in dev; VitePWA plugin (autoUpdate, Workbox precache); define: {__BUILD_TIME__} injected at build time for update toast
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
/holdings/segment/:key       HoldingsPage — holdings for a segment (Stocks/MF/US)
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
| POST | `/api/portfolio` | `currency=INR\|USD`, `force_refresh=false`; body: raw CSV text | Processes uploaded CSV (max 5MB); cache key `{currency}:{md5[:12]}`; passes csv_content to engine.build() |
| GET | `/api/demo-csv` | — | Serves `data/demo_msp_v2.csv` as downloadable file; used by settings popover |
| GET | `/api/history` | `yf_symbol`, `start=YYYY-MM-DD` OR `period=1d` | Daily price history (1hr cache) or intraday 5-min bars (5min cache); intraday response includes `prev_close` (yesterday's daily close) and timestamps in IST |
| GET | `/api/quickstats` | `yf_symbol`, `force_refresh=false` | P/E, MCap, 52W range, analyst target from ticker.info; 60s in-memory + 24h per-symbol disk cache |
| GET | `/api/filing/{symbol}` | — | Latest quarterly investor presentation PDF from BSE; 2h in-memory cache |
| GET | `/api/filing/{symbol}/text` | — | Same filing as plain text (pdfplumber); prefers Financial Results PDF; 15MB cap; 30 pages max |
| POST | `/api/gemini` | body: `{symbol, section_id, prompt, force_refresh?, force_lite?, key_index?}` | Attempt 1: gemini-2.5-flash + Google Search grounding; attempt 2 fallback: gemini-3.1-flash-lite plain; returns {text, sources[], grounded, model}; 1h cache per (symbol, section_id, force_lite); key_index selects Main(0), Backup(1), or Key3(2) API key |
| POST | `/api/gemini/chat` | body: `{symbol, question, context_text, force_lite?, key_index?}` | Free-form Q&A; same grounding cascade as /api/gemini; prompt forces web search beyond context; no caching; returns {text, sources[], grounded, model} |
| GET | `/api/search` | `q` | Yahoo Finance symbol search; returns [{symbol, name, exchange}] for EQUITY+ETF; used by Explore New Holdings autocomplete |
| GET | `/api/dividends` | `force_refresh=false`, `portfolio=` (optional) | Auto-fetched dividend history for all held stocks; scoped to single portfolio when `portfolio` param provided; 24h in-memory cache keyed by portfolio (`dividends:{portfolio or ''}`); reads from FIFO cache (user's uploaded CSV) |
| GET | `/api/dividends/debug` | `symbol` | Debug: all transactions matching symbol + computed share count; used to diagnose share-count mismatches |
| GET | `/health` | — | Returns `{"status":"ok"}`; used by keep-alive cron |

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
| xirr_total | float\|null | Annualised XIRR % across all non-SKIP portfolios |
| xirr_stk | float\|null | XIRR % for non-MF_ portfolios (stocks + US) |
| xirr_mf | float\|null | XIRR % for MF_ portfolios |
| xirr_by_portfolio | object | portfolio → XIRR % (non-SKIP only) |

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
| today_gain | float\|null | (current_price − prev_close) × qty |
| today_pct | float\|null | (current_price − prev_close) / prev_close × 100 |
| disp_today_gain | float\|null | today_gain in display currency |

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

### In-memory cache (backend routers)

| What | TTL |
|------|-----|
| portfolio bundle | 60s |
| price history | 1hr |

### Browser localStorage (TanStack Query persister)

| What | TTL | Scope |
|------|-----|-------|
| price history queries (`['history', ...]`) | 3 days | scoped via `shouldDehydrateQuery` |
| benchmark histories (`['benchmark-hist', ...]`) | 3 days | persisted via `shouldDehydrateQuery`; eliminates blank Benchmarking tab on restart |
| portfolio bundle (`['portfolio', currency]`) | 3 days | restores on reopen; staleTime=30min + refetchInterval=30min drives auto-refresh; ↻ button forces fresh yfinance hit |
| quickstats (`['quickstats', yf_symbol]`) | 3 days | persisted via `shouldDehydrateQuery` |

---

## Key Invariants

1. **FIFO isolation per portfolio** — `_run_fifo()` called once per portfolio group.
2. **Equity is a duplicate** — processed in isolation; XIRR excludes `SKIP_PORTS`.
3. **USD portfolios** — `Vested`, `IndMoney US`, `IndMoney Mummy`. FX fallback ~95.5.
4. **classify.py** is single source of truth for `USD_PORTS`, `SKIP_PORTS`, `segment()`. Mirrored in `frontend/src/utils/segments.ts`.
5. **yf_symbol format** — NSE → `SYMBOL.NS`, BSE → `SYMBOL.BO`, US → uppercase.
6. **Single API fetch** — entire bundle loaded once; all page transitions are client-side.

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
| `frontend/src/pages/PortfoliosPage.tsx` | `PortfoliosPage`, `classifyClean()`, `typeCards()` | Overview / hero card; classifyClean = per-entry realized classifier by (portfolio, cleanSymbol) |
| `frontend/src/pages/HoldingsPage.tsx` | `HoldingsPage` | Holdings list + sort + XIRR; `benchTxns` (extends filtPorts with closedRows portfolios); `benchTxnsDate` (BUY-date-filtered benchTxns); `txnYears` (available years from transactions) |
| `frontend/src/pages/TransactionsPage.tsx` | `TransactionsPage` | Tx list + 8-metric charts |
| `frontend/src/utils/segments.ts` | `getSegmentType()` | Segment classification |
| `frontend/src/utils/sectors.ts` | `getSectorForHolding()` | Sector classification for Analysis tab |
| `frontend/src/hooks/useBenchmarkXirr.ts` | `useBenchmarkXirr()` | Sector + per-holding benchmark XIRR computation |
| `frontend/src/utils/fmt.ts` | `fmtINR/fmtUSD` | Number formatting |

---

## Commands

| Slash command | File | Does |
|---------------|------|------|
| `/save_state` | .claude/commands/save_state.md | Update doc files + memory files → git commit (no push) |
| `/ship` | .claude/commands/ship.md | git commit → git push → Vercel + Render auto-deploy |
