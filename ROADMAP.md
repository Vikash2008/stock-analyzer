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
| 1 | Keep-alive ping (GitHub Actions cron) | Add `.github/workflows/keepalive.yml` — pings backend every 14 min so Render free tier never sleeps. Risk: against Render ToS spirit; GitHub private repo = 500 min/month free (est. ~150–200 min/month used). Cron jitter may cause occasional miss. | pending |
| 2 | Progressive loading messages (frontend) | Track elapsed time since fetch start. After 8s show "Backend waking up…", after 30s show "Still starting up (~60s on first load)". Safety net for cold starts that slip through. Only touches `PortfoliosPage.tsx` / `LoadingSkeleton.tsx`. | pending |
| 3 | Combine both (recommended) | GitHub Actions keep-alive prevents most cold starts; progressive UI handles the rare miss gracefully. Zero cost, no backend changes. | pending |

> Note: Render free tier spin-down (15 min idle) is not configurable. Paid Starter plan ($7/month) gives always-on. For now, keep-alive + UI messaging is the free solution.

---

## Done

| Item | Completed |
|------|-----------|
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
