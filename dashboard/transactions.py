import streamlit as st
from src.engine import PortfolioBundle


def render(bundle: PortfolioBundle) -> None:
    t = bundle.transactions.copy()
    if t.empty:
        st.info("No transactions for the selected portfolio(s).")
        return

    c1, c2 = st.columns(2)
    portfolios = sorted(t["portfolio"].unique()) if "portfolio" in t.columns else []
    sel_ports = c1.multiselect("Portfolio", portfolios, default=portfolios, key="t_port")
    symbols = sorted(t["symbol"].unique()) if "symbol" in t.columns else []
    sel_syms = c2.multiselect("Symbol", symbols, key="t_sym")

    if sel_ports and "portfolio" in t.columns:
        t = t[t["portfolio"].isin(sel_ports)]
    if sel_syms:
        t = t[t["symbol"].isin(sel_syms)]

    st.subheader(f"Transactions — {len(t)} row(s)")

    show_cols = {
        "date":      "Date",
        "symbol":    "Symbol",
        "portfolio": "Portfolio",
        "exchange":  "Exchange",
        "type":      "Type",
        "quantity":  "Qty",
        "price":     "Price",
        "charges":   "Charges",
        "currency":  "Ccy",
    }

    available = {k: v for k, v in show_cols.items() if k in t.columns}
    t["date"] = t["date"].dt.strftime("%d %b %Y")
    disp = t[list(available.keys())].rename(columns=available).sort_values(
        "Date", ascending=False
    )

    st.dataframe(disp, use_container_width=True, hide_index=True)
