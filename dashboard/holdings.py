import pandas as pd
import streamlit as st
from src.engine import PortfolioBundle


def _color_pnl(val):
    if not isinstance(val, (int, float)) or pd.isna(val):
        return ""
    return "color: #2ca02c" if val > 0 else ("color: #d62728" if val < 0 else "")


def render(bundle: PortfolioBundle) -> None:
    h = bundle.holdings
    if h.empty:
        st.info("No open positions for the selected portfolio(s).")
        return

    c1, c2 = st.columns(2)
    portfolios = sorted(h["portfolio"].unique()) if "portfolio" in h.columns else []
    sel_ports = c1.multiselect("Portfolio", portfolios, default=portfolios, key="h_port")
    symbols = sorted(h["symbol"].unique()) if "symbol" in h.columns else []
    sel_syms = c2.multiselect("Symbol", symbols, key="h_sym")

    if sel_ports and "portfolio" in h.columns:
        h = h[h["portfolio"].isin(sel_ports)]
    if sel_syms:
        h = h[h["symbol"].isin(sel_syms)]

    st.subheader(f"Holdings — {len(h)} position(s)")

    show_cols = {
        "symbol":       "Symbol",
        "name":         "Name",
        "portfolio":    "Portfolio",
        "exchange":     "Exchange",
        "quantity":     "Qty",
        "avg_cost":     "Avg Cost",
        "current_price":"LTP",
        "disp_invested":"Invested",
        "disp_current": "Current",
        "disp_gain":    "Gain/Loss",
        "disp_pnl_pct": "P&L %",
    }

    # Keep only columns that exist
    available = {k: v for k, v in show_cols.items() if k in h.columns}
    disp = h[list(available.keys())].rename(columns=available)

    for col in ["Avg Cost", "LTP"]:
        if col in disp.columns:
            disp[col] = disp[col].round(2)
    for col in ["Invested", "Current", "Gain/Loss"]:
        if col in disp.columns:
            disp[col] = disp[col].round(2)

    st.dataframe(
        disp.style.map(_color_pnl, subset=["Gain/Loss", "P&L %"]),
        use_container_width=True,
        hide_index=True,
    )
