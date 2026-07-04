"""
GET  /api/portfolio-history                 — demo/no-CSV path
POST /api/portfolio-history (body: raw CSV) — real uploaded-portfolio path, mirrors
                                               backend/routers/portfolio.py's GET/POST split

Computes the portfolio value time-series on the backend via a single bulk
yfinance download. This eliminates the 80-request burst that caused OOM when
every symbol's full history was fetched individually.

Returns a shape compatible with PortfolioSeries in usePortfolioHistory.ts:
  { dates, values, invested, unrealized, realized, total, returnPct,
    xirrTrend: {dates, values} }

Result-cache key is prefixed with a hash of the caller's CSV content ("demo" when there is
none) — previously this endpoint never received the caller's uploaded CSV at all (always
computed from the server's default file) and the cache key had no per-user component, which
would have let two different real users' charts collide on a common portfolio name once the
CSV-blindness was fixed. Both gaps are closed together here.
"""
from __future__ import annotations

import calendar
import hashlib
import time
from collections import defaultdict
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Query, Request

from backend import price_store
from src.engine import build

router = APIRouter()

_SKIP_PORTS = {"Equity", "MF_Portfolio"}
_USD_PORTS  = {"Vested", "IndMoney US", "IndMoney Mummy"}

_cache: dict[str, tuple[dict, float]] = {}
# 30 min (2026-07-04, was 5 min — briefly 30 before that too). Raised back to match the
# frontend's own market_hours.is_stale gate: the underlying daily-close price data only
# actually updates every 30 min during market hours, so a shorter result-cache TTL was just
# recomputing off the same unchanged price data more often than useful. Accepted tradeoff:
# the chart's "today" point can now visibly lag HoldingCard/SummaryCard (which refresh every
# 2 min via the separate live-price pipeline) by up to 30 min.
_CACHE_TTL = 1800.0

# Below this point count, a shrink comparison isn't meaningful — short real histories exist
# (e.g. a portfolio that only started a few weeks ago).
_MIN_HEALTHY_POINTS = 30


def _guard_result(cache_key: str, prev: Optional[dict], fresh: dict) -> dict:
    """Defense against a bad/partial yf.download() silently overwriting a good cache for the
    full 30-min TTL. Unlike the frontend's incremental per-symbol cache (useHistory.ts), this
    endpoint always does one atomic recompute on a cache miss — so there's no delta-merge to
    guard, but also no comparison at all against the previous good result. A transient Yahoo
    rate-limit or a symbol's column coming back all-NaN mid-download would otherwise be cached
    and served to every user unchanged. Mirrors guardFullResponse() in useHistory.ts."""
    prev_n = len(prev["dates"]) if prev else 0
    fresh_n = len(fresh["dates"])
    if prev_n < _MIN_HEALTHY_POINTS or fresh_n >= prev_n * 0.5:
        fresh["guardRejected"] = False
        return fresh
    print(f"[portfolio_history] SUSPICIOUS SHRINK {cache_key}: fresh recompute had {fresh_n} "
          f"points vs previous {prev_n} — keeping stale cache instead")
    # Shallow copy — `prev` may still be referenced elsewhere in _cache; flip the flag on a
    # copy so this rejection is visible to the caller without mutating the cached original.
    # dataAsOf deliberately NOT bumped — the data itself didn't change, so the "as of" time
    # shown to the user should keep reflecting when it was last genuinely good.
    rejected = dict(prev)
    rejected["guardRejected"] = True
    return rejected


# Raw per-symbol price history now lives in backend.price_store — the ONE shared, disk-persisted
# store also used by history.py, instead of a second independent copy of the same public market
# data. price_store.ensure_prices()/get_entry() replace the old _ensure_prices()/_price_cache.


def clear_portfolio_history_cache(csv_hash: Optional[str] = None) -> None:
    """Called by mutating endpoints (add-txn, delete-holding) so a portfolio change shows up
    immediately instead of waiting out the result-cache TTL. Only clears the computed-result
    cache — the raw price store is still valid, a transaction edit doesn't change historical
    prices, so the next request recomputes from cache with no redownload needed.

    Scoped to `csv_hash` — every cache key is prefixed with the CSV-content hash it was
    computed under (see get_portfolio_history), so this only clears the mutating user's own
    entries, never every other concurrently-active user's cached chart data. Passing None
    clears everything (demo-file-affecting scenarios only)."""
    if csv_hash is None:
        _cache.clear()
        return
    prefix = f"{csv_hash}:"
    for key in [k for k in _cache if k.startswith(prefix)]:
        _cache.pop(key, None)


def _segment_ok(portfolio: str, segment: Optional[str]) -> bool:
    if segment is None:
        return True
    if segment in ("stk", "indian_stock"):
        return portfolio not in _USD_PORTS and not portfolio.startswith("MF_")
    if segment in ("us_stock", "usstk"):
        return portfolio in _USD_PORTS
    if segment in ("mf", "indian_mf"):
        return portfolio.startswith("MF_")
    return True


def _safe_float(v, default: float = 0.0) -> float:
    try:
        f = float(v)
        return default if pd.isna(f) else f
    except Exception:
        return default


def _compute(
    currency: str,
    portfolio_filter: Optional[str],
    segment: Optional[str],
    symbol_filter: Optional[str] = None,
    csv_content: Optional[str] = None,
) -> dict:
    empty = {
        "dates": [], "values": [], "invested": [], "unrealized": [],
        "realized": [], "total": [], "returnPct": [],
        "xirrTrend": {"dates": [], "values": []},
        "dataAsOf": time.time(), "guardRejected": False, "todayMismatch": False,
    }

    bundle = build(currency=currency, csv_content=csv_content)
    usd_inr = bundle.usd_inr or 95.5

    # Comma-separated so both callers share one param: the Holdings page passes a single
    # portfolio name (or none, for "all"); the Txn page passes an explicit list when a
    # symbol is held across multiple specific portfolios (e.g. navigated from a segment
    # view). Passing none at all (the Txn page's "aggregate" navigation case) already
    # means "every non-skip portfolio", identical to the existing no-filter default.
    portfolio_filter_set = (
        {p.strip() for p in portfolio_filter.split(",") if p.strip()} if portfolio_filter else None
    )

    def port_ok(port: str) -> bool:
        if port in _SKIP_PORTS:
            return False
        if portfolio_filter_set and port not in portfolio_filter_set:
            return False
        return _segment_ok(port, segment)

    df_txns     = bundle.transactions.copy()
    df_holdings = bundle.holdings.copy()
    df_realized = bundle.realized.copy()

    if "portfolio" in df_txns.columns:
        df_txns = df_txns[df_txns["portfolio"].apply(port_ok)]
    if "portfolio" in df_holdings.columns:
        df_holdings = df_holdings[df_holdings["portfolio"].apply(port_ok)]
    if "portfolio" in df_realized.columns:
        df_realized = df_realized[df_realized["portfolio"].apply(port_ok)]

    if symbol_filter:
        if "symbol" in df_txns.columns:
            df_txns = df_txns[df_txns["symbol"] == symbol_filter]
        if "symbol" in df_holdings.columns:
            df_holdings = df_holdings[df_holdings["symbol"] == symbol_filter]
        if "symbol" in df_realized.columns:
            df_realized = df_realized[df_realized["symbol"] == symbol_filter]

    buy_sell = df_txns[df_txns["type"].isin(["BUY", "SELL"])] if "type" in df_txns.columns else pd.DataFrame()
    if buy_sell.empty:
        return empty

    symbols = list(buy_sell["yf_symbol"].dropna().unique())
    if not symbols:
        return empty

    earliest = pd.to_datetime(buy_sell["date"]).min() - pd.Timedelta(days=30)
    start_dt = earliest.strftime("%Y-%m-%d")

    # ── Incremental price fetch ─────────────────────────────────────────────────
    # price_store.ensure_prices() only downloads what's missing/new for each symbol instead of
    # redownloading full multi-year history on every recompute — shared with history.py so the
    # same symbol is never fetched/stored twice across the two chart endpoints.
    print(f"[portfolio_history] ensuring prices for {len(symbols)} symbols from {start_dt}")
    price_store.ensure_prices(symbols, start_dt)

    price_rows: dict[str, dict[str, float]] = {}
    for sym in symbols:
        entry = price_store.get_entry(sym)
        if not entry:
            continue
        for d, p in zip(entry["dates"], entry["prices"]):
            price_rows.setdefault(d, {})[sym] = p

    if price_rows:
        # Deliberately NOT reindexed to include every requested symbol as a column — a
        # symbol with no price data at all (e.g. a NAV-based MF with nothing on yfinance)
        # must stay absent from df_close.columns so `has_col` below is correctly False and
        # the const_px/current_price fallback path is used, same as the pre-cache behavior.
        df_close = pd.DataFrame.from_dict(price_rows, orient="index").sort_index()
    else:
        df_close = pd.DataFrame()

    # ── Build qty-delta map ────────────────────────────────────────────────────
    qty_deltas: dict[str, list[tuple[str, float]]] = defaultdict(list)
    first_tx_date: dict[str, str] = {}
    # BUY-only running totals per key — the only way to derive avg_cost for a CLOSED
    # position, which has no row in df_holdings at all to read avg_cost from (the FIFO
    # engine drops a symbol from "holdings" once fully exited).
    buy_totals: dict[str, tuple[float, float]] = {}

    for _, tx in buy_sell.iterrows():
        key   = f"{tx['portfolio']}:{tx['yf_symbol']}"
        d     = str(tx["date"])[:10]
        qty_  = _safe_float(tx["quantity"])
        delta = qty_ if tx["type"] == "BUY" else -qty_
        arr  = qty_deltas[key]
        merged = False
        for i, (ed, ev) in enumerate(arr):
            if ed == d:
                arr[i] = (d, ev + delta)
                merged = True
                break
        if not merged:
            arr.append((d, delta))
        if key not in first_tx_date or d < first_tx_date[key]:
            first_tx_date[key] = d
        if tx["type"] == "BUY":
            cost = qty_ * _safe_float(tx["price"]) + _safe_float(tx.get("charges", 0))
            tq, tc = buy_totals.get(key, (0.0, 0.0))
            buy_totals[key] = (tq + qty_, tc + cost)

    for k in qty_deltas:
        qty_deltas[k].sort()

    all_dates = sorted(df_close.index.tolist()) if not df_close.empty else []
    n = len(all_dates)
    val_arr = [0.0] * n
    inv_arr = [0.0] * n

    # ── Per-holding value contribution ────────────────────────────────────────
    # Walk every portfolio:symbol key that ever had a BUY/SELL — not just currently-open
    # holdings. df_holdings only contains OPEN positions, so limiting this loop to it would
    # silently drop a fully-sold symbol's entire historical contribution to Value/Invested,
    # not just after the exit but for every date it WAS held — understating both series.
    holdings_by_key: dict[str, "pd.Series"] = {}
    for _, h in df_holdings.iterrows():
        holdings_by_key.setdefault(f"{h['portfolio']}:{h['yf_symbol']}", h)

    for key in set(holdings_by_key) | set(qty_deltas):
        port, yf_sym = key.split(":", 1)

        is_usd = port in _USD_PORTS
        fx = (usd_inr if is_usd else 1.0) if currency == "INR" else (1.0 if is_usd else 1.0 / usd_inr)

        has_col = not df_close.empty and yf_sym in df_close.columns
        h = holdings_by_key.get(key)

        if h is not None:
            avg_cost = _safe_float(h.get("avg_cost"))
            const_px = _safe_float(h.get("current_price")) if not has_col else None
        else:
            # Closed position — no live holdings row. avg_cost comes from its own BUY
            # history instead (same method the frontend's Txn-page chart already used for
            # synthetic closed-holding entries before this endpoint covered them itself).
            # const_px falls back to 0 (matches the frontend's synthetic-holding fallback)
            # — a closed symbol with literally no price data can't have its value curve
            # reconstructed either way, and qty is 0 by "today" regardless.
            tq, tc = buy_totals.get(key, (0.0, 0.0))
            avg_cost = tc / tq if tq > 0 else 0.0
            const_px = 0.0 if not has_col else None

        deltas = qty_deltas.get(key, [])
        first  = first_tx_date.get(key, "")

        qty = 0.0
        di  = 0
        if has_col and all_dates:
            while di < len(deltas) and deltas[di][0] < all_dates[0]:
                qty = max(0.0, qty + deltas[di][1])
                di += 1
        else:
            for _, dv in deltas:
                qty = max(0.0, qty + dv)
            di = len(deltas)

        last_px: Optional[float] = None

        for i, d in enumerate(all_dates):
            if d < first:
                continue
            while di < len(deltas) and deltas[di][0] <= d:
                qty = max(0.0, qty + deltas[di][1])
                di += 1

            if has_col:
                cell = df_close.at[d, yf_sym] if d in df_close.index else float("nan")
                if not pd.isna(cell):
                    last_px = float(cell)
            else:
                last_px = const_px

            if last_px is None or qty <= 0:
                continue

            val_arr[i] += last_px * qty * fx
            inv_arr[i] += avg_cost * qty * fx

    # ── Today pin ─────────────────────────────────────────────────────────────
    today_str = pd.Timestamp.now().strftime("%Y-%m-%d")
    today_val = float(df_holdings["disp_current"].sum())  if "disp_current"  in df_holdings.columns else 0.0
    today_inv = float(df_holdings["disp_invested"].sum()) if "disp_invested" in df_holdings.columns else 0.0

    # Capture what the historical qty-walk itself arrived at for today, BEFORE it gets
    # overwritten by the live total below — comparing the two catches exactly the class of
    # bug that caused the original "7-day jump" report (the historical build-up silently
    # diverging from the true total) instead of only ever masking it with the pin.
    pinned_today = bool(all_dates and all_dates[-1] == today_str)
    computed_today_val = val_arr[-1] if pinned_today else None
    computed_today_inv = inv_arr[-1] if pinned_today else None

    if pinned_today:
        val_arr[-1] = today_val
        inv_arr[-1] = today_inv
    else:
        all_dates.append(today_str)
        val_arr.append(today_val)
        inv_arr.append(today_inv)

    def _mismatch(computed: Optional[float], live: float) -> bool:
        if computed is None or live <= 0:
            return False
        diff = abs(computed - live)
        # Needs both a meaningful absolute AND relative gap — avoids flagging small accounts
        # on ordinary FX-rounding noise while still catching a real divergence.
        return diff > 10_000 and diff / live > 0.02

    today_mismatch = _mismatch(computed_today_val, today_val) or _mismatch(computed_today_inv, today_inv)
    if today_mismatch:
        print(f"[portfolio_history] TODAY MISMATCH {currency}:{portfolio_filter or ''}:{segment or ''}:"
              f"{symbol_filter or ''} — historical walk computed value={computed_today_val}, "
              f"invested={computed_today_inv} but live totals are value={today_val:.0f}, "
              f"invested={today_inv:.0f} — chart may be inaccurate")

    start_idx = next((i for i, v in enumerate(val_arr) if v > 0), -1)
    if start_idx < 0:
        return empty

    dates_s    = all_dates[start_idx:]
    values     = val_arr[start_idx:]
    invested   = inv_arr[start_idx:]
    unrealized = [v - inv for v, inv in zip(values, invested)]

    # ── Realized series (cumulative) ──────────────────────────────────────────
    real_evts: list[tuple[str, float, float]] = []
    for _, r in df_realized.iterrows():
        is_usd   = str(r.get("currency", "INR")) == "USD"
        fx       = (usd_inr if is_usd else 1.0) if currency == "INR" else (1.0 if is_usd else 1.0 / usd_inr)
        sell_d   = str(r.get("sell_date", ""))[:10]
        pnl      = _safe_float(r.get("realized_pnl")) * fx
        r_type   = str(r.get("type", ""))
        cost     = _safe_float(r.get("quantity")) * _safe_float(r.get("buy_price")) * fx if r_type == "SELL" else 0.0
        real_evts.append((sell_d, pnl, cost))
    real_evts.sort(key=lambda x: x[0])

    realized_arr  = [0.0] * len(dates_s)
    real_cost_arr = [0.0] * len(dates_s)
    cum_r = cum_c = 0.0
    ri = 0
    for i, d in enumerate(dates_s):
        while ri < len(real_evts) and real_evts[ri][0] <= d:
            cum_r += real_evts[ri][1]
            cum_c += real_evts[ri][2]
            ri += 1
        realized_arr[i]  = cum_r
        real_cost_arr[i] = cum_c

    total_arr  = [u + r for u, r in zip(unrealized, realized_arr)]
    return_pct = [
        total_arr[i] / (invested[i] + real_cost_arr[i]) * 100
        if (invested[i] + real_cost_arr[i]) > 0 else 0.0
        for i in range(len(dates_s))
    ]

    # ── XIRR trend (monthly) ──────────────────────────────────────────────────
    xirr_dates: list[str] = []
    xirr_vals:  list[float] = []
    try:
        from src.xirr import xirr as _xf  # type: ignore[import]

        if not df_txns.empty:
            rows_sorted = df_txns.sort_values("date").to_dict("records")
            run_cfs: list[tuple[pd.Timestamp, float]] = []
            ti = 0
            now_ts = pd.Timestamp.now().replace(tzinfo=None)
            t0_str = str(rows_sorted[0]["date"])[:10]
            y, mo  = pd.Timestamp(t0_str).year, pd.Timestamp(t0_str).month

            while True:
                last_day = calendar.monthrange(y, mo)[1]
                me_full  = pd.Timestamp(y, mo, last_day)
                is_now   = me_full > now_ts
                me       = now_ts if is_now else me_full
                me_str   = me.strftime("%Y-%m-%d")

                while ti < len(rows_sorted):
                    tx   = rows_sorted[ti]
                    tx_d = str(tx.get("date", ""))[:10]
                    if tx_d > me_str:
                        break
                    ti += 1
                    tx_type = str(tx.get("type", ""))
                    if tx_type not in ("BUY", "SELL", "DIVIDEND"):
                        continue
                    is_usd = str(tx.get("portfolio", "")) in _USD_PORTS
                    fx     = (usd_inr if is_usd else 1.0) if currency == "INR" else (1.0 if is_usd else 1.0 / usd_inr)
                    amt    = _safe_float(tx.get("quantity")) * _safe_float(tx.get("price")) * fx
                    c_amt  = _safe_float(tx.get("charges")) * fx
                    ts     = pd.Timestamp(tx_d)
                    if tx_type == "BUY":
                        run_cfs.append((ts, -(amt + c_amt)))
                    elif tx_type == "SELL":
                        run_cfs.append((ts, amt - c_amt))
                    elif tx_type == "DIVIDEND":
                        run_cfs.append((ts, amt))

                v_idx = len(dates_s) - 1
                while v_idx >= 0 and dates_s[v_idx] > me_str:
                    v_idx -= 1

                if v_idx >= 0 and values[v_idx] > 0 and run_cfs:
                    try:
                        rv = _xf(run_cfs + [(me, values[v_idx])])
                        if rv is not None and -0.99 < rv < 50:
                            xirr_dates.append(me_str)
                            xirr_vals.append(rv * 100)
                    except Exception:
                        pass

                if is_now:
                    break
                mo += 1
                if mo > 12:
                    mo = 1
                    y += 1
    except Exception as ex:
        print(f"[portfolio_history] xirr trend skipped: {ex}")

    return {
        "dates":      dates_s,
        "values":     values,
        "invested":   invested,
        "unrealized": unrealized,
        "realized":   realized_arr,
        "total":      total_arr,
        "returnPct":  return_pct,
        "xirrTrend":  {"dates": xirr_dates, "values": xirr_vals},
        # dataAsOf: when this was actually computed from live data — distinct from the outer
        # _cache's own timestamp, which bumps on every retry attempt even when guard_result
        # rejects the attempt and keeps old data. This is what the frontend should show as
        # "as of" — it stays honest about how old the DATA really is, not how recently we
        # last checked.
        "dataAsOf":      time.time(),
        "guardRejected": False,  # _guard_result flips this to True if it rejects this result
        "todayMismatch": today_mismatch,
    }


def _portfolio_history_response(
    currency: str,
    portfolio: Optional[str],
    segment: Optional[str],
    symbol: Optional[str],
    csv_content: Optional[str],
) -> dict:
    # Every cache key is prefixed with a hash of the caller's own CSV content ("demo" when
    # there is none) — two different real users filtering to a same-named portfolio (e.g.
    # both have a "Zerodha") must never read/write the same entry.
    csv_hash = hashlib.md5(csv_content.encode()).hexdigest() if csv_content else "demo"
    cache_key = f"{csv_hash}:{currency}:{portfolio or ''}:{segment or ''}:{symbol or ''}"
    prev_entry = _cache.get(cache_key)
    if prev_entry:
        result, ts = prev_entry
        if time.time() - ts < _CACHE_TTL:
            return result

    fresh = _compute(currency, portfolio, segment, symbol, csv_content)
    result = _guard_result(cache_key, prev_entry[0] if prev_entry else None, fresh)
    _cache[cache_key] = (result, time.time())
    return result


@router.get("/api/portfolio-history")
def get_portfolio_history(
    currency:  str           = Query("INR"),
    portfolio: Optional[str] = Query(None, description="Single portfolio name, or comma-separated list"),
    segment:   Optional[str] = Query(None),
    symbol:    Optional[str] = Query(None, description="Clean symbol (not yf_symbol) — scopes to one holding, e.g. the Txn-page chart"),
) -> dict:
    """No-CSV path — always computes from the server's demo file, same as before."""
    return _portfolio_history_response(currency, portfolio, segment, symbol, csv_content=None)


@router.post("/api/portfolio-history")
async def post_portfolio_history(
    request: Request,
    currency:  str           = Query("INR"),
    portfolio: Optional[str] = Query(None, description="Single portfolio name, or comma-separated list"),
    segment:   Optional[str] = Query(None),
    symbol:    Optional[str] = Query(None, description="Clean symbol (not yf_symbol) — scopes to one holding, e.g. the Txn-page chart"),
) -> dict:
    """Real-portfolio path — body is the caller's raw CSV text, same convention as
    backend/routers/portfolio.py's POST. Without this, the chart was always computed from the
    server's default file regardless of who was asking (the pre-existing pending bug)."""
    body = await request.body()
    csv_content = body.decode("utf-8", errors="replace") if body else None
    return _portfolio_history_response(currency, portfolio, segment, symbol, csv_content)
