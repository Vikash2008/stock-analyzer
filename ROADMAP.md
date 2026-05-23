# ROADMAP.md — Stock Analyzer

> Prioritized backlog. Update this at the end of every session that adds, fixes, or drops an item.
> Status: `pending` | `in-progress` | `done`

---

## Phase 4 — Data Accuracy & Charts

| # | Item | What's needed | Status |
|---|------|---------------|--------|
| 1 | Fix P&L and realized values showing wrong numbers | SKIP_PORTS excluded from totals; realized included in portfolio/segment cards | done |
| 2 | XIRR at portfolio + segment level | Bundle now carries xirr_total, xirr_stk, xirr_mf, xirr_by_portfolio | done |
| 2b | XIRR per individual holding card (shows "—") | Need per-symbol XIRR computation | pending |
| 3 | HoldingsPage — Charts tab | 7 line charts (Value, Invested, Unrealized, Realized, Total, Return%, XIRR Trend); client-side computation via usePortfolioHistory | done |
| 4 | SummaryPage — historical line chart (shows bar snapshot only) | Port `_build_value_series()` + `_build_invested_series()` as API endpoints | pending |

---

## Phase 5 — UX Polish

| # | Item | What's needed | Status |
|---|------|---------------|--------|
| 5 | Render cold start UX — show loading state clearly (60–90s first hit) | Loading skeleton already exists; verify it shows immediately on cold start | pending |
| 6 | Pull-to-refresh gesture on mobile | Wire `useForceRefresh()` to a swipe or visible refresh button | pending |
| 7 | Today's gain on portfolio cards | `disp_today_gain` already in bundle — just needs rendering | pending |

---

## Phase 6 — New Features

| # | Item | What's needed | Status |
|---|------|---------------|--------|
| 8 | Segment view (Stocks / MF / US) on PortfoliosPage | Stocks + MF tiles added; By Broker / By Type toggle added | done |
| 9 | Search / filter on HoldingsPage | Client-side filter on holdings array — no API change | pending |
| 10 | Dividend history view | `realized` array already in bundle — filter by `type === "DIVIDEND"` | pending |

---

## Done

| Item | Completed |
|------|-----------|
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
