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
| 10 | Portfolio-load slowness — raise `price_fetcher.py` worker pool + keep resolving root causes | 2026-09-16 incident: one 32-symbol portfolio refresh took 88s (9 symbols consistently unrecognized by Yahoo's quote/quoteSummary APIs, retried internally with no bound). Fixed same day: real request timeouts (`_TimeoutSession`), 20s cap + cooldown on the slow `yf.download` fallback, name-fetch redundancy removed, `quickstats.py`'s broken `_with_timeout` fixed, dedicated pools for Deep Research (`gemini.py`) + background price-refresh (were sharing Python's tiny implicit default pool with chart fetches), `dividends.py` pool made persistent. Oracle VM specs checked live: 2 vCPU idle (load ~0.14, not the bottleneck), RAM tight (~147MB available of 952MB, backend process alone ~484MB) — raising `price_fetcher.py`'s pool from 12 further (e.g. →16) is safe but is NOT expected to fix root slowness, since the 88s cause was serial yfinance retries, not thread-pool queuing. Revisit once today's fixes are live and observed for a few cycles. | pending |

---

> _(see [ROADMAP_ARCHIVE.md](ROADMAP_ARCHIVE.md) for all completed/dropped items)_
