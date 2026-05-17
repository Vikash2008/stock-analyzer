from typing import Dict, List, Optional, Tuple

import pandas as pd
from scipy import optimize


def xirr(cash_flows: List[Tuple[pd.Timestamp, float]], guess: float = 0.1) -> Optional[float]:
    """
    Compute XIRR for a list of (date, amount) tuples.
    Outflows (investments) are negative; inflows (proceeds, current value) are positive.
    Returns None if the calculation fails to converge.
    """
    if len(cash_flows) < 2:
        return None

    dates = [cf[0] for cf in cash_flows]
    amounts = [cf[1] for cf in cash_flows]

    d0 = min(d.toordinal() for d in dates)
    years = [(d.toordinal() - d0) / 365.0 for d in dates]

    def npv(rate: float) -> float:
        return sum(a / (1.0 + rate) ** t for a, t in zip(amounts, years))

    try:
        return float(optimize.brentq(npv, -0.9999, 1000.0, xtol=1e-8, maxiter=2000))
    except ValueError:
        pass

    try:
        result = float(optimize.newton(npv, guess, maxiter=500, tol=1e-6))
        return result
    except Exception:
        return None


def portfolio_xirr(
    transactions: pd.DataFrame,
    holdings: pd.DataFrame,
    prices: Dict[str, Optional[float]],
    usd_inr: float = 85.5,
    display_currency: str = "INR",
) -> Optional[float]:
    """
    Build XIRR cash flows from all BUY/SELL/DIVIDEND transactions plus today's
    portfolio value, normalising everything to `display_currency`.
    """
    flows: List[Tuple[pd.Timestamp, float]] = []

    for _, tx in transactions.iterrows():
        tx_type = tx["type"]
        if tx_type not in ("BUY", "SELL", "DIVIDEND"):
            continue
        amount = float(tx["quantity"]) * float(tx["price"])
        amount = _convert(amount, tx["currency"], display_currency, usd_inr)

        if tx_type == "BUY":
            flows.append((tx["date"], -(amount + float(tx["charges"]))))
        elif tx_type == "SELL":
            flows.append((tx["date"], amount - float(tx["charges"])))
        else:  # DIVIDEND — pure inflow, no charges
            flows.append((tx["date"], amount))

    # Terminal inflow: current portfolio value
    today = pd.Timestamp.now().normalize()
    current_total = 0.0
    for _, row in holdings.iterrows():
        price = prices.get(row["yf_symbol"])
        if price is None:
            continue
        cv = float(row["quantity"]) * price
        current_total += _convert(cv, row["currency"], display_currency, usd_inr)

    if current_total > 0:
        flows.append((today, current_total))

    return xirr(flows)


def _convert(amount: float, src: str, dst: str, usd_inr: float) -> float:
    if src == dst:
        return amount
    if src == "USD" and dst == "INR":
        return amount * usd_inr
    if src == "INR" and dst == "USD":
        return amount / usd_inr
    return amount
