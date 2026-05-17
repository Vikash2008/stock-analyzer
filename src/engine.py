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

from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

import pandas as pd

from src.cache import Cache

_DATA_FILE = Path("data/msp_v2.csv")
_USD_PORTS = {"Vested", "IndMoney US", "IndMoney Mummy"}


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
) -> PortfolioBundle:
    """
    Load data from cache, re-fetch only what is stale, return a bundle.
    Safe to call on every Streamlit re-render — expensive work is skipped
    when the cache is warm.
    """
    from src.data_loader import load_transactions
    from src.portfolio import calculate_holdings, enrich_holdings
    from src.price_fetcher import get_current_prices, get_tickers_info, get_usd_inr_rate

    cache = Cache()

    # ── Layer 1: FIFO (permanent, mtime-gated) ────────────────────────────────
    if not cache.fifo_is_fresh(_DATA_FILE):
        print("[engine] FIFO stale — recomputing from", _DATA_FILE)
        txns = load_transactions(_DATA_FILE)
        holdings_raw, realized_all = calculate_holdings(txns)
        cache.set_fifo(_DATA_FILE, txns, holdings_raw, realized_all)
        force_refresh_prices = True   # symbol list may have changed
    else:
        txns, holdings_raw, realized_all = cache.get_fifo()

    # ── Layer 2: Prices + FX (30-min TTL) ────────────────────────────────────
    if force_refresh_prices or not cache.is_fresh("prices"):
        print("[engine] Fetching live prices…")
        symbols = list(holdings_raw["yf_symbol"].unique())
        prices  = get_current_prices(symbols)
        usd_inr = get_usd_inr_rate()
        cache.set("prices", prices)
        cache.set("fx", usd_inr)
    else:
        prices  = cache.get("prices")
        usd_inr = cache.get("fx") or 85.5

    # ── Layer 3: Sector / company info (7-day TTL) ────────────────────────────
    if not cache.is_fresh("info"):
        print("[engine] Fetching ticker info (sector/name)…")
        symbols = list(holdings_raw["yf_symbol"].unique())
        info = get_tickers_info(symbols)
        cache.set("info", info)
    else:
        info = cache.get("info")

    # ── Enrich holdings ───────────────────────────────────────────────────────
    holdings_all = enrich_holdings(holdings_raw, prices, info)
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

    # ── Summary ───────────────────────────────────────────────────────────────
    total_invested = holdings["disp_invested"].sum()
    total_current  = holdings["disp_current"].sum()
    total_gain     = total_current - total_invested
    return_pct     = (total_gain / total_invested * 100) if total_invested else 0.0

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
        as_of=pd.Timestamp.now(),
        all_portfolios=all_portfolios,
        cache_status=cache.status(),
    )
