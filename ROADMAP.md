# ROADMAP.md — Stock Analyzer

> Prioritized backlog. Update this at the end of every session that adds, fixes, or drops an item.
> Status: `pending` | `in-progress` | `done`
> Fully-done sections (Phase 4, Benchmarking Accuracy, Cold Start UX, Report Tab Redesign, Explore & Deep Research, App Launch & Chart Caching, Mobile CSV Persistence, the old Done log) archived to `ROADMAP_ARCHIVE.md` 2026-06-19 to keep this file boot-cheap — `/get_ready` reads it in full every session just to find the pending rows below.

---

## Backlog — Upcoming

| # | Item | Notes | Status |
|---|------|-------|--------|
| 6 | Per-transaction delete with stable row ID | Current delete (Delete Holding modal) matches transactions by exact field-equality (no stable ID in CSV schema) — fine for normal use, but two truly identical txns can't be told apart | pending |
| 8 | Telemetry / usage analytics | Track who's using the app and which tabs/features are most used, now unblocked since login exists | pending |
| 9 | Frontend `holdingBreakdownRows` vs backend Invested-basis mismatch | 2026-09-09: backend `portfolio_history.py` was fixed to use a running per-date cost basis instead of a constant avg_cost; frontend Charts-tab `holdingBreakdownRows` (HoldingsPage.tsx) still uses the old constant-avg_cost method and will now disagree with the aggregate chart for the same symbol/range | pending |

---

> _(see [ROADMAP_ARCHIVE.md](ROADMAP_ARCHIVE.md) for all completed/dropped items)_
