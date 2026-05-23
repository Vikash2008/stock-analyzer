# ROADMAP.md — Stock Analyzer

> Prioritized backlog. Update this at the end of every session that adds, fixes, or drops an item.
> Status: `pending` | `in-progress` | `done`

---

## Phase 4 — Data Accuracy & Charts (Next Up)

| # | Item | What's needed | Status |
|---|------|---------------|--------|
| 1 | Fix P&L and realized values showing wrong numbers | Audit `serializers.py` + `frontend/utils/realized.ts` against Python source | pending |
| 2 | XIRR per holding card (shows "—") | Add `/api/xirr` endpoint or enrich bundle in `engine.py` | pending |
| 3 | HoldingsPage — Charts tab (shows placeholder) | Add `/api/history/portfolio` endpoint for historical portfolio value series | pending |
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
| 8 | Segment view (Stocks / MF / US) on PortfoliosPage | Use `getSegmentType()` from `segments.ts` — aggregate client-side | pending |
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
