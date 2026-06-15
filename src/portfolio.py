from collections import deque
from dataclasses import dataclass
from typing import Deque, Dict, List, Optional, Tuple

import pandas as pd


@dataclass
class _Lot:
    date: pd.Timestamp
    quantity: float
    cost_per_share: float  # price + prorated charges per share
    buy_fx_rate: float = 1.0  # INR/USD rate at purchase; 1.0 for INR lots


def _run_fifo(
    transactions: pd.DataFrame,
    portfolio: Optional[str] = None,
) -> Tuple[List[dict], List[dict], List[dict]]:
    """Core FIFO engine for a single isolated transaction set."""
    lots: Dict[str, Deque[_Lot]] = {}
    realized_rows: List[dict] = []

    for _, tx in transactions.iterrows():
        sym = tx["yf_symbol"]
        qty: float = float(tx["quantity"])
        price: float = float(tx["price"])
        charges: float = float(tx["charges"])

        if tx["type"] == "BUY":
            cost_per_share = price + (charges / qty if qty else 0)
            raw_fx = tx.get("buy_fx_rate") if "buy_fx_rate" in tx.index else None
            fx_rate = float(raw_fx) if (raw_fx is not None and pd.notna(raw_fx)) else 1.0
            lots.setdefault(sym, deque()).append(
                _Lot(date=tx["date"], quantity=qty, cost_per_share=cost_per_share, buy_fx_rate=fx_rate)
            )

        elif tx["type"] == "SELL":
            net_sell_price = price - (charges / qty if qty else 0)
            remaining = qty
            queue = lots.get(sym, deque())

            while remaining > 0 and queue:
                lot = queue[0]
                sold = min(lot.quantity, remaining)
                row = {

                    "symbol": tx["symbol"],
                    "exchange": tx["exchange"],
                    "currency": tx["currency"],
                    "type": "SELL",
                    "buy_date": lot.date,
                    "sell_date": tx["date"],
                    "quantity": sold,
                    "buy_price": lot.cost_per_share,
                    "sell_price": net_sell_price,
                    "realized_pnl": sold * (net_sell_price - lot.cost_per_share),
                }
                if portfolio is not None:
                    row["portfolio"] = portfolio
                realized_rows.append(row)
                lot.quantity -= sold
                remaining -= sold
                if lot.quantity <= 1e-9:
                    queue.popleft()

            if remaining > 1e-9:
                import warnings
                label = f"{portfolio}:{sym}" if portfolio else sym
                warnings.warn(f"[fifo] {label}: oversold by {remaining:.4f} units on {tx['date'].date()} — missing BUY transactions?")

        elif tx["type"] == "DIVIDEND":
            row = {
                "symbol": tx["symbol"],
                "exchange": tx["exchange"],
                "currency": tx["currency"],
                "type": "DIVIDEND",
                "buy_date": None,
                "sell_date": tx["date"],
                "quantity": qty,
                "buy_price": 0.0,
                "sell_price": price,
                "realized_pnl": qty * price,
            }
            if portfolio is not None:
                row["portfolio"] = portfolio
            realized_rows.append(row)

    # Precompute symbol → metadata (O(n) once, not O(n) per symbol)
    meta_lookup: Dict[str, pd.Series] = {}
    for _, tx in transactions.iterrows():
        meta_lookup[tx["yf_symbol"]] = tx

    holding_rows: List[dict] = []
    fx_lot_rows:  List[dict] = []
    for sym, queue in lots.items():
        total_qty = sum(l.quantity for l in queue)
        if total_qty <= 1e-9:
            continue
        if total_qty < -1e-9:
            import warnings
            warnings.warn(f"[fifo] {sym}: negative remaining qty {total_qty:.6f} — check for data errors")
            continue
        total_cost      = sum(l.quantity * l.cost_per_share for l in queue)
        total_fx_weight = sum(l.quantity * l.buy_fx_rate for l in queue)
        avg_buy_fx_rate = total_fx_weight / total_qty if total_qty > 1e-9 else 1.0
        meta = meta_lookup[sym]
        row = {
            "symbol":          meta["symbol"],
            "exchange":        meta["exchange"],
            "yf_symbol":       sym,
            "currency":        meta["currency"],
            "quantity":        total_qty,
            "avg_cost":        total_cost / total_qty,
            "total_invested":  total_cost,
            "avg_buy_fx_rate": avg_buy_fx_rate,
        }
        if portfolio is not None:
            row["portfolio"] = portfolio
        holding_rows.append(row)

        # Per-lot records for FX Gains tab (rate buckets / year-month breakdown)
        for lot in queue:
            if lot.quantity <= 1e-9:
                continue
            lot_row = {
                "symbol":      meta["symbol"],
                "yf_symbol":   sym,
                "date":        lot.date.strftime("%Y-%m-%d"),
                "qty":         lot.quantity,
                "cost_usd":    lot.cost_per_share,
                "buy_fx_rate": lot.buy_fx_rate,
            }
            if portfolio is not None:
                lot_row["portfolio"] = portfolio
            fx_lot_rows.append(lot_row)

    return holding_rows, realized_rows, fx_lot_rows


def calculate_holdings(
    transactions: pd.DataFrame,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Process transactions FIFO to produce open holdings and a realized P&L ledger.
    When a 'portfolio' column is present, FIFO runs independently per portfolio
    so that sells in one portfolio never consume lots from another.

    Returns
    -------
    holdings : DataFrame
        One row per open position (per portfolio if applicable).
    realized : DataFrame
        One row per closed lot or dividend event.
    """
    _HOLDING_COLS = ["symbol", "exchange", "yf_symbol", "currency", "quantity", "avg_cost", "total_invested", "avg_buy_fx_rate"]
    _REALIZED_COLS = ["symbol", "exchange", "currency", "type", "buy_date", "sell_date", "quantity", "buy_price", "sell_price", "realized_pnl"]

    if "portfolio" in transactions.columns:
        all_holdings: List[dict] = []
        all_realized: List[dict] = []
        all_fx_lots:  List[dict] = []
        for port, group in transactions.groupby("portfolio", sort=False):
            h, r, fl = _run_fifo(group.reset_index(drop=True), portfolio=port)
            all_holdings.extend(h)
            all_realized.extend(r)
            all_fx_lots.extend(fl)
    else:
        all_holdings, all_realized, all_fx_lots = _run_fifo(transactions)

    holdings = (
        pd.DataFrame(all_holdings)
        if all_holdings
        else pd.DataFrame(columns=_HOLDING_COLS)
    )
    realized = (
        pd.DataFrame(all_realized)
        if all_realized
        else pd.DataFrame(columns=_REALIZED_COLS)
    )
    return holdings, realized, all_fx_lots


def enrich_holdings(
    holdings: pd.DataFrame,
    prices: Dict[str, Optional[float]],
    ticker_info: Dict[str, dict],
    prev_closes: Optional[Dict[str, Optional[float]]] = None,
) -> pd.DataFrame:
    """Add live price, current value, unrealized P&L, sector, company name, and today's gain."""
    if holdings.empty:
        return holdings

    df = holdings.copy()
    df["current_price"] = df["yf_symbol"].map(prices)
    df["current_value"] = df["quantity"] * df["current_price"]
    df["unrealized_pnl"] = df["current_value"] - df["total_invested"]
    df["pnl_pct"] = (df["unrealized_pnl"] / df["total_invested"] * 100).round(2)
    df["sector"] = df["yf_symbol"].map(
        lambda s: (ticker_info.get(s) or {}).get("sector", "Unknown")
    )
    df["company"] = df["yf_symbol"].map(
        lambda s: (ticker_info.get(s) or {}).get("name") or None
    )

    pc = prev_closes or {}
    df["previous_close"] = df["yf_symbol"].map(pc)
    price_change = df["current_price"] - df["previous_close"]
    df["today_gain"] = price_change * df["quantity"]
    df["today_pct"]  = (price_change / df["previous_close"] * 100).round(2)

    return df
