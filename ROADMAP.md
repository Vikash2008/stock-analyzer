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
| 3 | Report tab — Revenue Segments US stocks (SEC EDGAR) | Abandoned — FilingSummary.xml keyword match worked but parsed garbage numbers; removed from UI and backend | dropped |
| 4 | Report tab — Revenue Segments Indian stocks (Screener.in) | Screener consolidated page has segment HTML tables; backend scrape similar to existing `_fetch_screener()`; PDF parsing avoided | pending |
| 7 | Report tab — Gemini 2.5 Flash inline answers | Perplexity replaced; POST /api/gemini with Google Search grounding; react-markdown rendering; elapsed timer; force-refresh on ↻; localStorage cache per section | done |
| 5 | Report tab — Section 2 Research Links | Screener/Trendlyne/NSE pills for Indian; Finviz/Macrotrends/EDGAR for US | pending |
| 6 | Report tab — Phase 2 Claude API | AI-generated qualitative sections | pending |
| 5 | Report tab — Phase 2 Claude API | AI-generated qualitative sections | pending |

---

## Done

| Item | Completed |
|------|-----------|
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
