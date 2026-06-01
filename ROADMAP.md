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

## Done

| Item | Completed |
|------|-----------|
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
