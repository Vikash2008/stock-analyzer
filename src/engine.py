"""
Portfolio engine — single entry point for the UI layer.

Usage:
    bundle = build(selected_portfolios=["Zerodha", "Groww"], currency="INR")

On cold start (first run or after restart) the engine reads from the persistent
disk cache. Only layers whose TTL has expired are re-fetched:
  - FIFO / holdings: recomputed only when msp_v2.csv changes (mtime gate)
  - Prices + FX:     re-fetched after 30 min
  - Sector info:     re-fetched after 7 days
"""

from __future__ import annotations

import hashlib
import io
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd

from src.cache import Cache

_DATA_FILE  = Path("data/demo_msp_v2.csv")
_USD_PORTS  = {"Vested", "IndMoney US", "IndMoney Mummy"}
_SKIP_PORTS = {"Equity", "MF_Portfolio"}   # aggregate duplicates — excluded from totals


# ── Data bundle ───────────────────────────────────────────────────────────────

@dataclass
class PortfolioBundle:
    selected_portfolios: List[str]
    currency: str
    usd_inr: float

    holdings: pd.DataFrame
    transactions: pd.DataFrame
    realized: pd.DataFrame

    total_invested: float
    total_current: float
    total_gain: float
    return_pct: float

    xirr_total:          Optional[float]      # annualised %, e.g. 18.5 (not 0.185)
    xirr_stk:            Optional[float]
    xirr_mf:             Optional[float]
    xirr_by_portfolio:   Dict[str, float]

    as_of: pd.Timestamp
    all_portfolios: List[str]
    cache_status: str            # shown in sidebar for visibility


# ── Currency helper ───────────────────────────────────────────────────────────

def _to_display(value: Optional[float], src: str, dst: str, rate: float) -> float:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return 0.0
    if src == dst:
        return value
    return value * rate if (src == "USD" and dst == "INR") else value / rate


# ── Engine ────────────────────────────────────────────────────────────────────

def build(
    selected_portfolios: Optional[List[str]] = None,
    currency: str = "INR",
    force_refresh_prices: bool = False,
    csv_content: Optional[str] = None,
) -> PortfolioBundle:
    """
    Load data from cache, re-fetch only what is stale, return a bundle.
    csv_content: raw CSV text from an uploaded file; if None, uses demo_msp_v2.csv.
    """
    from src.data_loader import load_transactions
    from src.portfolio import calculate_holdings, enrich_holdings
    from src.price_fetcher import get_prices_and_prev_close, get_tickers_info, get_usd_inr_rate

    cache = Cache()

    # ── Layer 1: FIFO (permanent, mtime/hash-gated) ───────────────────────────
    if csv_content is not None:
        csv_hash  = hashlib.md5(csv_content.encode()).hexdigest()
        fifo_key  = csv_hash
        source    = io.StringIO(csv_content)
    else:
        fifo_key  = _DATA_FILE
        source    = _DATA_FILE

    if not cache.fifo_is_fresh(fifo_key):
        print("[engine] FIFO stale — recomputing")
        txns = load_transactions(source)
        holdings_raw, realized_all = calculate_holdings(txns)
        cache.set_fifo(fifo_key, txns, holdings_raw, realized_all)
        force_refresh_prices = True   # symbol list may have changed
    else:
        txns, holdings_raw, realized_all = cache.get_fifo()

    # ── Layer 2: Prices + FX (30-min TTL) ────────────────────────────────────
    if force_refresh_prices or not cache.is_fresh("prices"):
        print("[engine] Fetching live prices…")
        symbols = list(holdings_raw["yf_symbol"].unique())
        prices, prev_closes = get_prices_and_prev_close(symbols)
        usd_inr = get_usd_inr_rate()
        cache.set("prices", prices)
        cache.set("prev_closes", prev_closes)
        cache.set("fx", usd_inr)
    else:
        prices      = cache.get("prices")
        prev_closes = cache.get("prev_closes") or {}
        usd_inr     = cache.get("fx") or 85.5

    # ── Layer 3: Sector / company info (7-day TTL) ────────────────────────────
    if not cache.is_fresh("info"):
        print("[engine] Fetching ticker info (sector/name)…")
        symbols = list(holdings_raw["yf_symbol"].unique())
        info = get_tickers_info(symbols)
        cache.set("info", info)
    else:
        info = cache.get("info")

    # ── Enrich holdings ───────────────────────────────────────────────────────
    holdings_all = enrich_holdings(holdings_raw, prices, info, prev_closes)
    if "name" in txns.columns and "name" not in holdings_all.columns:
        name_map = txns.groupby("yf_symbol")["name"].first()
        holdings_all["name"] = holdings_all["yf_symbol"].map(name_map).fillna("")

    # ── Portfolio list ────────────────────────────────────────────────────────
    all_portfolios = sorted(txns["portfolio"].unique().tolist()) \
        if "portfolio" in txns.columns else []

    if not selected_portfolios:
        selected_portfolios = all_portfolios

    # ── Filter ────────────────────────────────────────────────────────────────
    port_col = "portfolio" in holdings_all.columns
    holdings     = holdings_all[holdings_all["portfolio"].isin(selected_portfolios)].copy() \
                   if port_col else holdings_all.copy()
    transactions = txns[txns["portfolio"].isin(selected_portfolios)].copy() \
                   if "portfolio" in txns.columns else txns.copy()
    realized     = realized_all[realized_all["portfolio"].isin(selected_portfolios)].copy() \
                   if "portfolio" in realized_all.columns else realized_all.copy()

    # ── Display-currency columns ──────────────────────────────────────────────
    holdings["disp_invested"] = holdings.apply(
        lambda r: _to_display(r["total_invested"], r["currency"], currency, usd_inr), axis=1
    )
    holdings["disp_current"] = holdings.apply(
        lambda r: _to_display(r["current_value"], r["currency"], currency, usd_inr), axis=1
    )
    holdings["disp_gain"]    = holdings["disp_current"] - holdings["disp_invested"]
    holdings["disp_pnl_pct"] = (
        holdings["disp_gain"] / holdings["disp_invested"].replace(0, float("nan")) * 100
    ).round(2)
    holdings["disp_today_gain"] = holdings.apply(
        lambda r: _to_display(r["today_gain"], r["currency"], currency, usd_inr)
        if pd.notna(r.get("today_gain")) else None, axis=1
    )

    # ── Summary (exclude aggregate-duplicate portfolios) ─────────────────────
    _totals = holdings[~holdings["portfolio"].isin(_SKIP_PORTS)] \
              if "portfolio" in holdings.columns else holdings
    total_invested = _totals["disp_invested"].sum()
    total_current  = _totals["disp_current"].sum()
    total_gain     = total_current - total_invested
    return_pct     = (total_gain / total_invested * 100) if total_invested else 0.0

    # ── XIRR (uses existing portfolio_xirr from src/xirr.py) ─────────────────
    from src.xirr import portfolio_xirr as _px

    def _xirr(tx, hd):
        try:
            if tx.empty:
                return None
            v = _px(tx, hd, prices, usd_inr, currency)
            return round(v * 100, 2) if v is not None else None
        except Exception:
            return None

    _active = {p for p in selected_portfolios if p not in _SKIP_PORTS}
    _stk    = {p for p in _active if not p.startswith("MF_")}
    _mf     = {p for p in _active if p.startswith("MF_")}

    _ptx = transactions if "portfolio" in transactions.columns else pd.DataFrame()
    _phd = holdings    if "portfolio" in holdings.columns    else pd.DataFrame()

    xirr_total = _xirr(_ptx[_ptx["portfolio"].isin(_active)], _phd[_phd["portfolio"].isin(_active)])
    xirr_stk   = _xirr(_ptx[_ptx["portfolio"].isin(_stk)],   _phd[_phd["portfolio"].isin(_stk)])
    xirr_mf    = _xirr(_ptx[_ptx["portfolio"].isin(_mf)],    _phd[_phd["portfolio"].isin(_mf)])

    xirr_by_portfolio: Dict[str, float] = {}
    for _p in _active:
        _v = _xirr(_ptx[_ptx["portfolio"] == _p], _phd[_phd["portfolio"] == _p])
        if _v is not None:
            xirr_by_portfolio[_p] = _v

    return PortfolioBundle(
        selected_portfolios=selected_portfolios,
        currency=currency,
        usd_inr=usd_inr,
        holdings=holdings,
        transactions=transactions,
        realized=realized,
        total_invested=total_invested,
        total_current=total_current,
        total_gain=total_gain,
        return_pct=return_pct,
        xirr_total=xirr_total,
        xirr_stk=xirr_stk,
        xirr_mf=xirr_mf,
        xirr_by_portfolio=xirr_by_portfolio,
        as_of=pd.Timestamp.now('UTC'),
        all_portfolios=all_portfolios,
        cache_status=cache.status(),
    )
