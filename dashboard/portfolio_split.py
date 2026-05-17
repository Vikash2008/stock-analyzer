import streamlit as st

from src.engine import PortfolioBundle
from src.xirr import portfolio_xirr
from dashboard.classify import USD_PORTS as _USD_PORTS, SKIP_PORTS as _SKIP_PORTS


def _fmt_inr(v: float) -> str:
    if abs(v) >= 1e7: return f"₹{v/1e7:.2f} Cr"
    if abs(v) >= 1e5: return f"₹{v/1e5:.2f} L"
    return f"₹{v:,.2f}"


def _fmt_usd(v: float) -> str:
    if abs(v) >= 1e6: return f"${v/1e6:.2f}M"
    if abs(v) >= 1e3: return f"${v/1e3:.2f}K"
    return f"${v:.2f}"


def _holdings_table(g, ccy):
    show = {
        "symbol": "Symbol", "name": "Name", "quantity": "Qty",
        "avg_cost": "Avg Cost", "current_price": "LTP",
        "disp_invested": "Invested", "disp_current": "Current",
        "disp_gain": "Gain/Loss", "disp_pnl_pct": "P&L %",
    }
    available = {k: v for k, v in show.items() if k in g.columns}
    disp = g[list(available.keys())].rename(columns=available).copy()
    for col in ["Avg Cost", "LTP", "Invested", "Current", "Gain/Loss"]:
        if col in disp.columns:
            disp[col] = disp[col].round(2)
    st.dataframe(disp.sort_values("Invested", ascending=False),
                 use_container_width=True, hide_index=True)


def render(bundle: PortfolioBundle) -> None:
    h       = bundle.holdings
    usd_inr = bundle.usd_inr
    prices  = dict(zip(h["yf_symbol"], h["current_price"]))

    if h.empty or "portfolio" not in h.columns:
        st.info("No holdings data available.")
        return

    # Build rows sorted by current value
    portfolio_data = []
    total_invested_inr = total_current_inr = 0.0

    for port, g in h.groupby("portfolio"):
        if port in _SKIP_PORTS:
            continue
        is_usd = port in _USD_PORTS
        invested = g["total_invested"].sum() if is_usd else g["disp_invested"].sum()
        current  = g["current_value"].sum()  if is_usd else g["disp_current"].sum()
        gain     = current - invested
        ret_pct  = (gain / invested * 100) if invested else 0.0
        fmt      = _fmt_usd if is_usd else _fmt_inr
        ccy      = "USD" if is_usd else "INR"

        port_txns = bundle.transactions[bundle.transactions["portfolio"] == port] \
                    if "portfolio" in bundle.transactions.columns else bundle.transactions
        xirr_val  = portfolio_xirr(port_txns, g, prices, usd_inr, "INR")
        xirr_str  = f"{xirr_val*100:+.2f}%" if xirr_val is not None else "N/A"

        cur_inr = current * usd_inr if is_usd else current
        total_invested_inr += invested * usd_inr if is_usd else invested
        total_current_inr  += cur_inr

        portfolio_data.append((cur_inr, port, g, ccy, fmt, invested, current, gain, ret_pct, xirr_str))

    portfolio_data.sort(key=lambda x: -x[0])

    st.subheader("Portfolio Split")

    for _, port, g, ccy, fmt, invested, current, gain, ret_pct, xirr_str in portfolio_data:
        sign = "+" if gain >= 0 else ""
        label = (
            f"**{port}** &nbsp;·&nbsp; {ccy} &nbsp;·&nbsp; "
            f"{fmt(current)} &nbsp;·&nbsp; "
            f"{sign}{fmt(gain)} ({sign}{ret_pct:.1f}%) &nbsp;·&nbsp; "
            f"XIRR {xirr_str}"
        )
        with st.expander(label):
            _holdings_table(g, ccy)

    gain_inr = total_current_inr - total_invested_inr
    ret_pct  = (gain_inr / total_invested_inr * 100) if total_invested_inr else 0.0
    sign     = "+" if gain_inr >= 0 else ""
    st.caption(
        f"Total — Invested: {_fmt_inr(total_invested_inr)} · "
        f"Current: {_fmt_inr(total_current_inr)} · "
        f"Gain: {sign}{_fmt_inr(gain_inr)} ({sign}{ret_pct:.1f}%)"
    )
