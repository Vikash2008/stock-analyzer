# Architecture — Multi-Portfolio Stock Analyzer

> Single source of truth for active components and finalized design.
> Everything not listed here is either dead code or not yet built.

---

## Active File Map

```
.github/
  workflows/
    keepalive.yml           GitHub Actions cron (*/14 * * * *) — pings /health to prevent Render cold start

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
  main.py                   FastAPI app; CORS reads ALLOWED_ORIGIN env var; load_dotenv() reads .env for local dev (python-dotenv)
  serializers.py            PortfolioBundle → JSON-safe dict (NaN/Timestamp/numpy handling)
  routers/
    portfolio.py            GET /api/portfolio?currency=INR&force_refresh=false
    history.py              GET /api/history?yf_symbol=INFY.NS&start=YYYY-MM-DD OR ?period=1d (intraday; timestamps in IST; includes prev_close)
    quickstats.py           GET /api/quickstats?yf_symbol=...&force_refresh=false (fundamentals + analyst; 60s mem + 24h disk per-symbol); rec_label normalizes yfinance "none" → "Neutral"; Indian stocks: Screener.in scrape overrides PE/PB/ROCE/ROE/DivYield/MCap/52W + Compounded Sales/Profit Growth 3Y+TTM; US stocks: yfinance + _compute_roce() + _compute_growth_3y() from income_stmt + _fetch_macrotrends_pe() for PE history; PEG fallback = PE/(earningsGrowth×100) when yfinance null; fields: trailing_pe, forward_pe, price_to_book, peg_ratio, debt_to_equity, return_on_equity, return_on_assets, roce, profit_margins, trailing_eps, revenue_growth, revenue_growth_3y, earnings_growth, earnings_growth_3y, dividend_yield, beta, market_cap, week_52_*, recommendation, target_mean_price, upside_pct, pe_history
    filing.py               GET /api/filing/{symbol} — serves latest quarterly investor presentation PDF from BSE (downloads with proper headers, caches 2h in-memory); GET /api/filing/{symbol}/text — same but returns plain text extracted by pdfplumber (prefers Financial Results PDF over large PPT; first 30 pages; 15MB cap); scrip code from hardcoded map (50+ stocks) or BSE dynamic lookup
    gemini.py               POST /api/gemini — async; attempt 1: gemini-2.5-flash with Google Search grounding (~20 RPD free); attempt 2 fallback: gemini-3.1-flash-lite plain (500 RPD); any non-auth error on attempt 1 falls through to attempt 2; attempt 2 retries once on transient error; body: {symbol, section_id, prompt, force_refresh?, force_lite?, key_index?}; returns {text, sources[], grounded, model}; 1h in-memory cache per (symbol, section_id, force_lite, key_index); _KEYS[Main, Backup] hardcoded; _read_api_key(index) returns _KEYS[index] directly (no env var override)
  requirements_backend.txt  Backend-only deps

frontend/
  src/
    api/types.ts            TypeScript interfaces matching backend JSON
    api/portfolio.ts        fetch wrapper (uses VITE_API_URL env var)
    hooks/usePortfolio.ts        TanStack Query, staleTime+gcTime=Infinity, refetchInterval=30min (foreground only), useForceRefresh() (clears ['history'] cache)
    hooks/useHistory.ts          TanStack Query for price history, staleTime+gcTime=Infinity
    hooks/usePortfolioHistory.ts useQueries per-symbol history → value/invested/P&L/return/xirr series; exposes loadedCount+totalCount+fetchingCount+symbolPriceMap (Map<yf_symbol,Map<dateStr,price>>); extraSymbols? param fetches closed-symbol prices into symbolPriceMap
    hooks/useBenchmarkXirr.ts    useQueries benchmark histories in parallel; Option B period XIRR (opening balance at T1, terminal at T2); sector + per-holding XIRR vs benchmark; exports holdingBenchXirr Map + loadedCount+totalCount+fetchingCount; params: periodStart/periodEnd/symbolPriceMap; Other sector excluded from overallActual/overallBench cashflows
    hooks/useQuickStats.ts       TanStack Query ['quickstats', yf_symbol]; staleTime=Infinity; enabled when Report tab active AND portfolio data loaded (!!data); retry 1×10s delay
    utils/fmt.ts                 fmtINR/fmtUSD/fmtPct/fmtGainLine
    utils/segments.ts            classify.py TypeScript port
    utils/realized.ts            _agg_realized() TypeScript port
    utils/xirr.ts                Client-side XIRR (bisection + Newton fallback)
    utils/sectors.ts             SYMBOL_SECTOR (170+ symbols → SectorKey incl. all MF funds + closed positions), SECTOR_COLOR, SECTOR_BENCHMARK, BENCHMARK_LABEL, getSectorForHolding(); 11 sectors: Banking/Finance/Healthcare/IT/Growth/Tech/Smallcap/Equity/Consumer/Global/Other; Global=#6366f1 ^GSPC (S&P 500-themed MFs); Consumer=#ec4899 ^CNXFMCG; Smallcap=NIFTY_MIDCAP_100.NS; all 70 MF symbols classified; MarketCapKey, MARKET_CAP_COLOR, SYMBOL_MARKET_CAP, getMarketCapForHolding()
    api/gemini.ts                fetchGeminiSection(symbol, sectionId, prompt, forceRefresh?, forceLite?, keyIndex?) → GeminiResponse {text, sources[], grounded, model}
    utils/reportLinks.ts         SECTIONS (7 configs), buildGeminiPrompt(name, sectionId, isIndian, yf_symbol?, apiUrl?) — returns raw prompt string with FORMAT_SUFFIX appended; results section on Indian stocks embeds filing text URL
    components/             LoadingSkeleton, SummaryCard, HoldingCard, TxRow, PriceChart, AnalysisTab, ReportTab (accepts reportTab/useLite/useKey props from TransactionsPage; Deep Research tab: 7 Gemini cards accordion+auto-expand, elapsed timer, react-markdown+remark-gfm; Quick Stats tab: 4×4 grid + 52W bar + analyst + PE History; sub-tab bar + model toggle + gear + sync in TransactionsPage violet strip)
    pages/                  PortfoliosPage, HoldingsPage, TransactionsPage
    App.tsx                 React Router routes
  public/
    manifest.json           PWA manifest (standalone display mode)
    icon.svg                App icon — dark bg + green chart line
  package.json              react 18, react-router-dom 6, @tanstack/react-query 5, recharts 2, @nivo/sunburst, @nivo/core, @tanstack/react-query-persist-client, @tanstack/query-sync-storage-persister, vite-plugin-pwa, react-markdown, remark-gfm
  vite.config.ts            /api proxy → localhost:8000 in dev; VitePWA plugin (autoUpdate, Workbox precache)
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
/                            PortfoliosPage — hero + per-portfolio cards, By Type (default) / By Broker toggle
/holdings/portfolio/:name    HoldingsPage — holdings list + Charts tab + sort control
/holdings/segment/:key       HoldingsPage — holdings for a segment (Stocks/MF/US)
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
| GET | `/api/portfolio` | `currency=INR\|USD`, `force_refresh=false` | Full bundle; 60s in-memory cache on top of disk cache |
| GET | `/api/history` | `yf_symbol`, `start=YYYY-MM-DD` OR `period=1d` | Daily price history (1hr cache) or intraday 5-min bars (5min cache); intraday response includes `prev_close` (yesterday's daily close) and timestamps in IST |
| GET | `/api/quickstats` | `yf_symbol`, `force_refresh=false` | P/E, MCap, 52W range, analyst target from ticker.info; 60s in-memory + 24h per-symbol disk cache |
| GET | `/api/filing/{symbol}` | — | Latest quarterly investor presentation PDF from BSE; 2h in-memory cache |
| GET | `/api/filing/{symbol}/text` | — | Same filing as plain text (pdfplumber); prefers Financial Results PDF; 15MB cap; 30 pages max |
| POST | `/api/gemini` | body: `{symbol, section_id, prompt, force_refresh?, force_lite?, key_index?}` | Attempt 1: gemini-2.5-flash + Google Search grounding; attempt 2 fallback: gemini-3.1-flash-lite plain; returns {text, sources[], grounded, model}; 1h cache per (symbol, section_id, force_lite); key_index selects Main(0) or Backup(1) API key |
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
| portfolio bundle (`['portfolio', currency]`) | 3 days | restores on reopen; staleTime=Infinity so no auto background-refetch; ↻ only trigger |
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

## Pending

- Nothing critical; see ROADMAP.md for Phase 5/6 backlog

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
