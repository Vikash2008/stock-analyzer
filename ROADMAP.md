# ROADMAP.md — Stock Analyzer

> Prioritized backlog. Update this at the end of every session that adds, fixes, or drops an item.
> Status: `pending` | `in-progress` | `done`
> Fully-done sections (Phase 4, Benchmarking Accuracy, Cold Start UX, Report Tab Redesign, Explore & Deep Research, App Launch & Chart Caching, Mobile CSV Persistence, the old Done log) archived to `ROADMAP_ARCHIVE.md` 2026-06-19 to keep this file boot-cheap — `/get_ready` reads it in full every session just to find the pending rows below.

---

## Backlog — Upcoming

| # | Item | Notes | Status |
|---|------|-------|--------|
| 3 | Yearly activity performance analysis | Analysis/visualisation of performance broken down by year — e.g. annual returns, P&L, invested vs realised per year | pending |
| 4 | Research Links | Indian: Screener / Trendlyne / NSE pills; US: Finviz / Macrotrends / EDGAR pills | pending |
| 6 | Per-transaction delete with stable row ID | Current delete (Delete Holding modal) matches transactions by exact field-equality (no stable ID in CSV schema) — fine for normal use, but two truly identical txns can't be told apart | pending |
| 7 | User login / account system | Shipped 2026-08-13 — Google Sign-In, email-based access control (Admin panel), Drive backup, all live. Remaining: build+ship the actual `.apk` via Bubblewrap (needs local Java/Android SDK, not done yet) — `/join` page is ready but its download link has no file behind it | in-progress |
| 8 | Telemetry / usage analytics | Track who's using the app and which tabs/features are most used, once login exists to attach identity to events | pending |

---

> _(see [ROADMAP_ARCHIVE.md](ROADMAP_ARCHIVE.md) for all completed/dropped items)_
