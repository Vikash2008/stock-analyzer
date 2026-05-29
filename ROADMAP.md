# ROADMAP.md — Stock Analyzer

> Prioritized backlog. Update this at the end of every session that adds, fixes, or drops an item.
> Status: `pending` | `in-progress` | `done`

---

## Phase 4 — Data Accuracy & Charts

| # | Item | What's needed | Status |
|---|------|---------------|--------|
| 1 | Fix P&L and realized values showing wrong numbers | SKIP_PORTS excluded from totals; realized included in portfolio/segment cards | done |
| 2 | XIRR at portfolio + segment level | Bundle now carries xirr_total, xirr_stk, xirr_mf, xirr_by_portfolio | done |
| 2b | XIRR per individual holding card | Client-side per-symbol computation; also on Overview BreakCards | done |
| 3 | HoldingsPage — Charts tab | 7 line charts (Value, Invested, Unrealized, Realized, Total, Return%, XIRR Trend); client-side computation via usePortfolioHistory | done |
| 4 | SummaryPage removed | Unreachable dead page — deleted | done |

---

## Backlog — Cold Start UX

| # | Item | Notes | Status |
|---|------|-------|--------|
| 1 | Keep-alive ping (GitHub Actions cron) | Add `.github/workflows/keepalive.yml` — pings backend every 14 min so Render free tier never sleeps. Risk: against Render ToS spirit; GitHub private repo = 500 min/month free (est. ~150–200 min/month used). Cron jitter may cause occasional miss. | done |
| 2 | Returns tab per-period gains — use portSeries.total | sectorValueSeries only tracks open positions; closed positions create mismatch. Fix: for "All Sectors" use portSeries.total differences (same series Charts tab uses — already correct). For specific sectors: needs discussion — may require price history for sold positions or a different approach. | done |

> Note: Render free tier spin-down (15 min idle) is not configurable. Paid Starter plan ($7/month) gives always-on. For now, keep-alive + UI messaging is the free solution.

---

## Done

| Item | Completed |
|------|-----------|
| Chart last-point pinned to live prices — `usePortfolioHistory` appends/overrides last data point with `h.disp_current`/`h.disp_invested`; eliminates 1–2L Unrealized/Total Gains gap between chart and summary card | 2026-05-29 |
| testcases.md AN-BENCH-* — all 12 benchmarking test cases run via Playwright; 10/12 pass, 1 N/A, 1 pending (lazy-load DevTools check); AN-BENCH-3 expectation corrected for FX asymmetry on MON100/MAFANG | 2026-05-29 |
| Closed holdings TxRow BUY cards — removed null guard; fully-sold lots now show realized gain, ₹0(₹0) current value | 2026-05-29 |
| Closed holdings TransactionsPage summary card — XIRR from cashflows, anyHolding fallback for LTP, ₹0 current/invested, lastSellPrice LTP fallback | 2026-05-29 |
| Closed holdings HoldingCard LTP — priceMap (open portfolio) + lastSellMap (latest SELL tx) fallback chain | 2026-05-29 |
| Returns sub-tab XIRR metric removed — 2-option toggle (Return % / Gains) only | 2026-05-29 |
| Returns sub-tab ComposedChart — bars = period gain/return%, indigo line = cumulative return% (right Y-axis); YTD override from live displayStats matches summary tile | 2026-05-29 |
| Returns sub-tab summary line — Gains mode: total gains; Return % mode: live cumulative return % | 2026-05-29 |
| Returns summary line text + number fix — year mode shows "all sectors · by year" + total gains (sum of all bars); month mode shows "sector · YEAR" + that year's gains; was showing all-time allocGroupedRows total which excluded closed positions | 2026-05-29 |
| Returns default metric = Gains — initial state changed from returnPct to gains; Gains (INR) more useful as landing view | 2026-05-29 |
| testcases.md exhaustive rewrite — 60+ cases for Overview, Holdings tab, Charts tab, Analysis (Allocation/Benchmarking/Returns incl. SUMLINE-1–5), Transactions page, cross-page invariants | 2026-05-29 |
| Upstox broker card fix — portfolioCards seeds agg from rmap for fully-closed portfolios; By Broker stock cards sum now matches Stocks tile (was off by 0.47L) | 2026-05-29 |
| HoldingsPage filtRealized segment fix — Realized Gains chart endpoint matches Summary card for all segments; Upstox 0.47L realized now included | 2026-05-29 |
| Return % chart formula fix (A6) — usePortfolioHistory tracks cumRealCost; returnPct = totalGain/(invested+realizedCost); gap was up to −53pp for MF | 2026-05-29 |
| testcases.md — 10 manual test cases for Charts tab + Portfolios page broker/type invariants; includes expected values and known limitations | 2026-05-29 |
| Number correctness audit — 21 invariant rules (P1–P8, H1–H6, T1–T3, X1–X7, D1–D5) defined, audited, and documented in CLAUDE.md; all pass | 2026-05-29 |
| classifyClean fix — PortfoliosPage stk/mf tiles and typeCards now use per-entry (portfolio, cleanSymbol) classification instead of portfolio-level realizedForPorts; fixes 5L double-count in Stocks breakdown (MON100/MAFANG in Zerodha) | 2026-05-29 |
| Total segment realized = 0 fix — HoldingsPage segFilter for segment='total' now covers all 4 segment types; X1 cross-page invariant restored | 2026-05-29 |
| Returns histogram "all sectors" fix — periodData uses portSeries.total (unrealized + cumulative realized); gains = total[end]−total[start]; sum of all year bars ≈ total P&L ≈ 68L; sector-specific views unchanged | 2026-05-28 |
| Returns sub-tab on Analysis tab — Sector pills (All + per-sector colored), Year/Month toggle, Metric toggle (Return%/Gains/XIRR), year selector for month mode, per-period rows with colored value + bar; usePortfolioHistory now exposes symbolPriceMap for zero-cost sector series | 2026-05-28 |
| By Holdings Concentration section — pie chart, Top 5/10/20 toggle, right-side coverage stat, legend with XIRR; accordion with other sections | 2026-05-28 |
| Benchmarking UI redesign — overall card inline label+value; Sector+XIRR merged column; Benchmark(XIRR) renamed; flex-1 equal columns; coverage stat aligned | 2026-05-28 |
| Tab strips — sky-50 strip for Charts (metric pills + ↻), violet-50 strip for Analysis (sub-pills); outer border removed for all tabs | 2026-05-28 |
| Chart metric pills unique colors — METRIC_COLOR map per metric (blue/violet/teal/amber/emerald/sky/rose) | 2026-05-28 |
| Section headers colored in Analysis tab — By Sector=blue, By Market Cap=orange, By Holdings Concentration=emerald, Benchmarking By Sector=sky | 2026-05-28 |
| /get_ready slash command — reads 6 boot files in parallel, outputs session status | 2026-05-28 |
| Critical Rules section added to CLAUDE.md — 5 session-wide rules | 2026-05-28 |
| Allocation accordion — By Sector open default, By Market Cap collapsed; accordion (open one closes other) | 2026-05-28 |
| Solid tab colors — Holdings/Charts/Analysis solid fill; Allocation=amber, Benchmarking=sky pill buttons; chart pills=emerald | 2026-05-28 |
| Sector/MktCap XIRR fix — pooled cashflows (allocSectorXirrMap + allocMktCapXirrMap); was weighted avg giving inflated ~94% | 2026-05-28 |
| Tab content border — active tab content in subtle rounded border card | 2026-05-28 |
| Benchmarking sub-tab redesign — allocation-style layout; green overall card; bordered collapsible "By Sector" section; columns XIRR / Index (XIRR) / Alpha; centered alpha bar (green right / red left); per-holding alpha computed and displayed | 2026-05-28 |
| Allocation sub-tab — collapsible By Sector / By Market Cap sections with bordered wrappers; section labels aligned to card content; tappable ▲/▼ toggle headers | 2026-05-27 |
| Market cap bucket reclassification — ETF/MF bucket removed; 4 buckets (Large/Mid/Small/US); small cap funds + SBI Contra → Small Cap; US-tracking ETFs/MFs → US Stocks; ELSS/ITBEES/digital India → Large Cap | 2026-05-27 |
| Allocation sub-tab: removed stacked bar; deduplicated holdings via buildRows; 5-column expanded layout (Holding / # / Alloc % / Value / XIRR / Today) | 2026-05-27 |
| Benchmarking sub-tab: visual redesign to match allocation (name row + colored XIRR bar, vs X% inline, no alpha column in rows); useBenchmarkXirr USD_BENCH_SYMS fix for MON100 alpha; colored tab pills (Holdings/Charts/Analysis + Allocation/Benchmarking) | 2026-05-27 |
| Analysis tab on HoldingsPage — Allocation (stacked bar + sector rows) + Benchmarking (sector XIRR vs transaction-matched composite benchmark; collapsible sector rows; per-holding XIRR vs own-date-simulated benchmark; sectors.ts + useBenchmarkXirr.ts) | 2026-05-27 |
| Portfolio bundle persisted to localStorage — instant reopen after swipe-up, stale-while-revalidate | 2026-05-27 |
| All charts default range = 1y | 2026-05-27 |
| PortfoliosPage: Stocks/MF tiles side-by-side; By Type + By Broker grouped sections with section labels; BreakCard compact prop | 2026-05-27 |
| XIRR By Type fixed to include closed positions (iterates all transactions via yfMap) | 2026-05-27 |
| PriceChart 5d range added; X-axis weekday labels "Mon"/"Tue" | 2026-05-27 |
| All chart X-axis tickFormatter fixed (HoldingsPage + TransactionsPage + PriceChart): range-aware labels, ISO date stored in t field | 2026-05-27 |
| 1d intraday timestamps converted to IST (backend tz_convert); 1d chart % uses prev_close from intraday response (captures gap-up/down) | 2026-05-27 |
| PriceChart 1d intraday range (5-min bars, HH:MM X-axis); range-aware X-axis format ("12 Oct" for short, "Oct '23" for long) | 2026-05-27 |
| Charts pre-fetch on page load; no loading bar; history cache preserved on force refresh; ↻ sync on HoldingsPage Charts tab | 2026-05-27 |
| HoldingsPage default filter = All with closed rows hidden (showClosed=false) | 2026-05-27 |
| XIRR fix — closed US stocks in segment view (closedRows tracks all portfolios; xirrMap/filteredSummaryXirr use row.portfolios) | 2026-05-27 |
| XIRR fix — "All" filter mode computes client-side; was returning xirr_stk which mixed Indian+US stocks | 2026-05-27 |
| TxRow redesign — 2-row × 3-col; badge pill; date/unreal/curValue + invested/real/totalGain; green/red card tint | 2026-05-27 |
| Keep-alive ping — GitHub Actions cron every 14 min pings /health; /health endpoint added to backend | 2026-05-27 |
| Realized P&L bug fix — segment summary card now counts fully-exited positions (iterates data.realized directly) | 2026-05-27 |
| Open/Closed/All toggle on HoldingsPage — all views (By Broker, By Type, Stocks, MF, Total) | 2026-05-27 |
| Grouped/Each + Open/Closed/All as iOS slider controls on one line; Each mode shows company name | 2026-05-27 |
| Settings gear icon on HoldingsPage — popover with Open/Closed/All, Show Closed toggle, Grouped/Standalone | 2026-05-27 |
| Filter-aware summary card — XIRR + realized P&L update for Open/Closed/All; Open+Closed=All exact | 2026-05-27 |
| Sort fix for closed rows — sortFn extracted and applied to both open and closed row arrays | 2026-05-27 |
| Scroll save/restore — sessionStorage keyed by pathname; HoldingsPage restores on back; TransactionsPage always tops | 2026-05-27 |
| "Analysis" tab renamed "Notes" on TransactionsPage | 2026-05-27 |
| TxRow redesign — left: date + qty·price = invested; right: current value (invested) + 3-col GainGrid | 2026-05-27 |
| FIFO same-date BUY lot fix (dateQtyAttributed Map) — Axis Bank double-realized bug fixed | 2026-05-27 |
| PWA skipWaiting + clientsClaim — new SW activates immediately on mobile; deploys reflect without closing app | 2026-05-24 |
| Static data/names.json — company names committed to git; Render always shows correct names regardless of yfinance availability | 2026-05-24 |
| serializers.py inf fix — all scalar fields + xirr_by_portfolio sanitized; no more 500 on inf values | 2026-05-24 |
| Sync icon (↻) on TransactionsPage Charts tab — clears history cache for current symbol and re-fetches | 2026-05-24 |
| PWA auto-reload on SW update — controllerchange listener in App.tsx; Vercel deploys immediately visible without manual refresh | 2026-05-24 |
| PWA service worker (vite-plugin-pwa, Workbox autoUpdate) — no white screen on app reopen | 2026-05-24 |
| Persistent chart cache to localStorage via TanStack Query persister (7-day, ['history'] only) | 2026-05-24 |
| SummaryCard XIRR layout fix — XIRR left / Total right on row 3, matches HoldingCard | 2026-05-24 |
| TransactionsPage top card font fix — XIRR unstyled, Today/Total labels, fmtCompactGainLine | 2026-05-24 |
| Chart history cache: staleTime+gcTime=Infinity, force refresh clears cache | 2026-05-24 |
| Multi-portfolio txn fix: segment view passes portfolios[] in nav state; TransactionsPage aggregates across all | 2026-05-24 |
| HoldingCard shows TICKER · Name instead of name only | 2026-05-24 |
| Chart loading progress — HoldingsPage: real % bar (X/Y symbols); TransactionsPage: Step 1/2 bar | 2026-05-24 |
| Cold Start UX backlog documented — keep-alive ping + progressive UI options captured in ROADMAP | 2026-05-24 |
| Pull-to-refresh UX — custom swipe gesture, no white screen, animated sync button, blocked native reload | 2026-05-24 |
| Analysis tab on TransactionsPage — notes with add/edit/delete, IST timestamp, localStorage | 2026-05-24 |
| Today/Total gain labels on all cards (overview + holdings); compact number format (₹23.4K) | 2026-05-24 |
| FastAPI backend — `/api/portfolio` + `/api/history` | 2026-05-23 |
| React frontend — all 4 pages (Portfolios, Holdings, Transactions, Summary) | 2026-05-23 |
| Vercel deployment (frontend) | 2026-05-24 |
| Render deployment (backend) | 2026-05-24 |
| PWA manifest — standalone home screen install | 2026-05-24 |
| Drop Streamlit — React+FastAPI only | 2026-05-24 |
| Fix P&L double-count (SKIP_PORTS in engine totals + PortfoliosPage) | 2026-05-24 |
| Stocks + MF tiles with today % and XIRR on PortfoliosPage | 2026-05-24 |
| By Broker / By Type breakdown toggle on PortfoliosPage | 2026-05-24 |
| XIRR per portfolio + segment in bundle (xirr_total/stk/mf/by_portfolio) | 2026-05-24 |
| HoldingsPage Charts tab — 7 historical line charts, client-side XIRR trend, segmented range control | 2026-05-24 |
| PortfoliosPage UI cleanup — IST time, bigger labels, Stocks/MF tiles match hero layout | 2026-05-24 |
| SummaryPage removed (dead/unreachable) | 2026-05-24 |
| XIRR on HoldingCard + Overview BreakCards (client-side, ×100 fix) | 2026-05-24 |
| TransactionsPage Charts tab — 8 metrics (Price + 7 historical series scoped to holding) | 2026-05-24 |
| PriceChart range selector (1m–All) | 2026-05-24 |
| HoldingsPage sort control — 7 fields, asc/desc | 2026-05-24 |
| Overview By Type as default breakdown | 2026-05-24 |
| TransactionsPage back label via nav state; header shows company name only | 2026-05-24 |
