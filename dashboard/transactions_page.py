import pandas as pd
import streamlit as st

from dashboard import ui_state, charts
from dashboard.classify import SKIP_PORTS, USD_PORTS
from src.engine import PortfolioBundle


def _fmt(v: float, is_usd=False) -> str:
    if is_usd:
        if abs(v) >= 1e3: return f"${v/1e3:.1f}K"
        return f"${v:,.0f}"
    if abs(v) >= 1e7: return f"₹{v/1e7:.2f} Cr"
    if abs(v) >= 1e5: return f"₹{v/1e5:.2f} L"
    return f"₹{v:,.0f}"


def render(bundle: PortfolioBundle) -> None:
    port    = ui_state.sel_portfolio()
    sym     = ui_state.sel_symbol()
    h       = bundle.holdings
    txns    = bundle.transactions

    # ── Back nav ──────────────────────────────────────────────────────────────
    crumb     = f"Portfolios → {port} → {sym}" if port else f"Portfolios → {sym}"
    back_label = f"← Back to {port} Holdings" if port else "← Back to Holdings"
    st.caption(crumb)
    if st.button(back_label, key="back_to_holdings"):
        ui_state.go_back()
        return

    if not sym:
        st.warning("No symbol selected.")
        return

    # ── Symbol overview card ──────────────────────────────────────────────────
    is_usd = port in USD_PORTS if port else False
    h_row  = h[(h["symbol"] == sym) & (h["portfolio"] == port)] if port else h[h["symbol"] == sym]

    if not h_row.empty:
        row      = h_row.iloc[0]
        inv      = row["total_invested"] if is_usd else row["disp_invested"]
        cur      = row["current_value"]  if is_usd else row["disp_current"]
        gain     = cur - inv
        pct      = (gain / inv * 100) if inv else 0.0
        sign     = "+" if gain >= 0 else ""
        color    = "#1a7a3a" if gain >= 0 else "#c0392b"
        ltp      = round(row["current_price"], 2) if pd.notna(row.get("current_price")) else "—"
        yf_sym   = row["yf_symbol"]
        current_price = float(row["current_price"]) if pd.notna(row.get("current_price")) else None
        st.markdown(f"""
<div style="background:#f0f4fb;border:1px solid #c8d6f0;border-radius:10px;
            padding:12px 16px;margin-bottom:12px">
  <div style="font-size:12px;color:#7f8c8d">{port} · {sym}</div>
  <div style="font-size:22px;font-weight:700;color:#1a2744">{_fmt(cur, is_usd)}</div>
  <div style="font-size:13px;font-weight:600;color:{color};margin-top:2px">
    {sign}{_fmt(abs(gain), is_usd)} &nbsp; {sign}{pct:.1f}%
  </div>
  <div style="font-size:11px;color:#7f8c8d;margin-top:6px">
    Qty {round(row['quantity'],3)} &nbsp;·&nbsp; Avg {round(row['avg_cost'],2)} &nbsp;·&nbsp; LTP {ltp}
  </div>
</div>""", unsafe_allow_html=True)
    else:
        h_any = h[h["symbol"] == sym]
        yf_sym = h_any["yf_symbol"].iloc[0] if not h_any.empty else sym
        current_price = None
        st.markdown(f"**{sym}** — position fully sold")

    # ── Transactions filter ───────────────────────────────────────────────────
    sym_txns = txns[
        (txns["symbol"] == sym) &
        (txns["type"].isin(["BUY", "SELL"])) &
        (~txns["portfolio"].isin(SKIP_PORTS))
    ].copy()
    if port:
        sym_txns = sym_txns[sym_txns["portfolio"] == port]

    # ── Tabs ──────────────────────────────────────────────────────────────────
    tab_txn, tab_chart = st.tabs(["Transactions", "Charts"])

    with tab_txn:
        if sym_txns.empty:
            st.info("No transactions found.")
        else:
            st.caption(f"{len(sym_txns)} rows")
            display = sym_txns[["date", "type", "quantity", "price", "charges"]].copy()
            display = display.sort_values("date", ascending=False)
            display["date"]     = display["date"].dt.strftime("%d %b %Y")
            display["quantity"] = display["quantity"].round(3)
            display["price"]    = display["price"].round(2)
            display["charges"]  = display["charges"].round(2)
            display = display.rename(columns={
                "date": "Date", "type": "Type",
                "quantity": "Qty", "price": "Price", "charges": "Charges",
            })
            st.dataframe(display, use_container_width=True, hide_index=True)

    with tab_chart:
        charts.render(sym_txns, yf_sym, current_price)
