"""
GET /api/portfolio-history

Computes the portfolio value time-series on the backend via a single bulk
yfinance download. This eliminates the 80-request burst that caused OOM when
every symbol's full history was fetched individually.

Returns a shape compatible with PortfolioSeries in usePortfolioHistory.ts:
  { dates, values, invested, unrealized, realized, total, returnPct,
    xirrTrend: {dates, values} }
"""
from __future__ import annotations

import calendar
import ctypes
import gc
import time
from collections import defaultdict
from typing import Optional

import pandas as pd
import yfinance as yf
from fastapi import APIRouter, Query

from src.engine import build

router = APIRouter()

_SKIP_PORTS = {"Equity", "MF_Portfolio"}
_USD_PORTS  = {"Vested", "IndMoney US", "IndMoney Mummy"}

try:
    _libc: Optional[ctypes.CDLL] = ctypes.CDLL("libc.so.6")
except OSError:
    _libc = None

_cache: dict[str, tuple[dict, float]] = {}
_CACHE_TTL = 1800.0  # 30 minutes


def _force_trim() -> None:
    gc.collect()
    if _libc is not None:
        try:
            _libc.malloc_trim(0)
        except Exception:
            pass


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


def _compute(currency: str, portfolio_filter: Optional[str], segment: Optional[str]) -> dict:
    empty = {
        "dates": [], "values": [], "invested": [], "unrealized": [],
        "realized": [], "total": [], "returnPct": [],
        "xirrTrend": {"dates": [], "values": []},
    }

    bundle = build(currency=currency)
    usd_inr = bundle.usd_inr or 95.5

    def port_ok(port: str) -> bool:
        if port in _SKIP_PORTS:
            return False
        if portfolio_filter and port != portfolio_filter:
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

    buy_sell = df_txns[df_txns["type"].isin(["BUY", "SELL"])] if "type" in df_txns.columns else pd.DataFrame()
    if buy_sell.empty:
        return empty

    symbols = list(buy_sell["yf_symbol"].dropna().unique())
    if not symbols:
        return empty

    earliest = pd.to_datetime(buy_sell["date"]).min() - pd.Timedelta(days=30)
    start_dt = earliest.strftime("%Y-%m-%d")

    # ── Bulk price download ────────────────────────────────────────────────────
    print(f"[portfolio_history] bulk download {len(symbols)} symbols from {start_dt}")
    try:
        raw = yf.download(symbols, start=start_dt, auto_adjust=True, progress=False, threads=False)
        if raw.empty:
            df_close: pd.DataFrame = pd.DataFrame()
        elif isinstance(raw.columns, pd.MultiIndex):
            lvl0 = raw.columns.get_level_values(0)
            df_close = raw["Close"].copy() if "Close" in lvl0 else pd.DataFrame()
        elif "Close" in raw.columns:
            df_close = raw[["Close"]].rename(columns={"Close": symbols[0]}).copy()
        else:
            df_close = pd.DataFrame()

        if not df_close.empty:
            if hasattr(df_close.index, "tz") and df_close.index.tz is not None:
                df_close.index = df_close.index.tz_localize(None)
            df_close.index = df_close.index.strftime("%Y-%m-%d")
    except Exception as e:
        print(f"[portfolio_history] download error: {e}")
        df_close = pd.DataFrame()

    del raw  # type: ignore[possibly-undefined]
    _force_trim()

    # ── Build qty-delta map ────────────────────────────────────────────────────
    qty_deltas: dict[str, list[tuple[str, float]]] = defaultdict(list)
    first_tx_date: dict[str, str] = {}

    for _, tx in buy_sell.iterrows():
        key  = f"{tx['portfolio']}:{tx['yf_symbol']}"
        d    = str(tx["date"])[:10]
        delta = _safe_float(tx["quantity"]) if tx["type"] == "BUY" else -_safe_float(tx["quantity"])
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

    for k in qty_deltas:
        qty_deltas[k].sort()

    all_dates = sorted(df_close.index.tolist()) if not df_close.empty else []
    n = len(all_dates)
    val_arr = [0.0] * n
    inv_arr = [0.0] * n

    # ── Per-holding value contribution ────────────────────────────────────────
    seen_keys: set[str] = set()
    for _, h in df_holdings.iterrows():
        port   = str(h["portfolio"])
        yf_sym = str(h["yf_symbol"])
        key    = f"{port}:{yf_sym}"
        if key in seen_keys:
            continue
        seen_keys.add(key)

        is_usd = port in _USD_PORTS
        fx = (usd_inr if is_usd else 1.0) if currency == "INR" else (1.0 if is_usd else 1.0 / usd_inr)

        avg_cost = _safe_float(h.get("avg_cost"))
        deltas   = qty_deltas.get(key, [])
        first    = first_tx_date.get(key, "")

        has_col  = not df_close.empty and yf_sym in df_close.columns
        const_px = _safe_float(h.get("current_price")) if not has_col else None

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

    if all_dates and all_dates[-1] == today_str:
        val_arr[-1] = today_val
        inv_arr[-1] = today_inv
    else:
        all_dates.append(today_str)
        val_arr.append(today_val)
        inv_arr.append(today_inv)

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
    }


@router.get("/api/portfolio-history")
def get_portfolio_history(
    currency:  str           = Query("INR"),
    portfolio: Optional[str] = Query(None),
    segment:   Optional[str] = Query(None),
) -> dict:
    cache_key = f"{currency}:{portfolio or ''}:{segment or ''}"
    if cache_key in _cache:
        result, ts = _cache[cache_key]
        if time.time() - ts < _CACHE_TTL:
            return result

    result = _compute(currency, portfolio, segment)
    _cache[cache_key] = (result, time.time())
    return result
