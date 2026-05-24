# Architecture — Multi-Portfolio Stock Analyzer

> Single source of truth for active components and finalized design.
> Everything not listed here is either dead code or not yet built.

---

## Active File Map

```
validate.py                 Terminal CLI (independent of backend)

src/
  engine.py                 build(currency, force_refresh) → PortfolioBundle
  cache.py                  Disk cache (data/.cache.pkl) — prices/fx/prev_closes TTL 30min, info 7d
  data_loader.py            CSV ingestion, MSP auto-detect
  portfolio.py              FIFO engine, enrich_holdings()
  price_fetcher.py          yfinance wrappers
  schema.py                 Frozen schema + validation
  xirr.py                   XIRR calculation

backend/
  main.py                   FastAPI app; CORS reads ALLOWED_ORIGIN env var
  serializers.py            PortfolioBundle → JSON-safe dict (NaN/Timestamp/numpy handling)
  routers/
    portfolio.py            GET /api/portfolio?currency=INR&force_refresh=false
    history.py              GET /api/history?yf_symbol=INFY.NS&start=YYYY-MM-DD
  requirements_backend.txt  Backend-only deps

frontend/
  src/
    api/types.ts            TypeScript interfaces matching backend JSON
    api/portfolio.ts        fetch wrapper (uses VITE_API_URL env var)
    hooks/usePortfolio.ts        TanStack Query, 30min staleTime, useForceRefresh()
    hooks/useHistory.ts          TanStack Query for price history, 1hr staleTime
    hooks/usePortfolioHistory.ts useQueries per-symbol history → value/invested/P&L/return/xirr series
    utils/fmt.ts                 fmtINR/fmtUSD/fmtPct/fmtGainLine
    utils/segments.ts            classify.py TypeScript port
    utils/realized.ts            _agg_realized() TypeScript port
    utils/xirr.ts                Client-side XIRR (bisection + Newton fallback)
    components/             LoadingSkeleton, SummaryCard, HoldingCard, TxRow, PriceChart, AnalysisTab
    pages/                  PortfoliosPage, HoldingsPage, TransactionsPage
    App.tsx                 React Router routes
  public/
    manifest.json           PWA manifest (standalone display mode)
    icon.svg                App icon — dark bg + green chart line
  package.json              react 18, react-router-dom 6, @tanstack/react-query 5, recharts 2
  vite.config.ts            /api proxy → localhost:8000 in dev
  .env.production           VITE_API_URL=https://stock-analyzer-2nqw.onrender.com
  index.html                PWA meta tags + manifest link

data/
  msp_v2.csv                Transaction source file (source of truth)
  .cache.pkl                Persistent price/FIFO cache (do not delete)
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
| GET | `/api/history` | `yf_symbol`, `start=YYYY-MM-DD` | Price history; 1hr in-memory cache |

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

### In-memory cache (backend routers)

| What | TTL |
|------|-----|
| portfolio bundle | 60s |
| price history | 1hr |

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
| `frontend/src/pages/PortfoliosPage.tsx` | `PortfoliosPage` | Overview / hero card |
| `frontend/src/pages/HoldingsPage.tsx` | `HoldingsPage` | Holdings list + sort + XIRR |
| `frontend/src/pages/TransactionsPage.tsx` | `TransactionsPage` | Tx list + 8-metric charts |
| `frontend/src/utils/segments.ts` | `getSegmentType()` | Segment classification |
| `frontend/src/utils/fmt.ts` | `fmtINR/fmtUSD` | Number formatting |

---

## Commands

| Slash command | File | Does |
|---------------|------|------|
| `/save_state` | prompts/save_state.md | Update DESIGN.md → ARCHITECTURE.md → CLAUDE.md |
| `/ship` | .claude/commands/ship.md | git commit → git push → Vercel + Render auto-deploy |
