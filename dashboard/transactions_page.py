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
    port = ui_state.sel_portfolio()
    sym  = ui_state.sel_symbol()
    h    = bundle.holdings
    txns = bundle.transactions

    back_label = f"← {port} Holdings" if port else "← Holdings"
    if st.button(back_label, key="back_to_holdings"):
        ui_state.go_back()
        return

    if not sym:
        st.warning("No symbol selected.")
        return

    is_usd = port in USD_PORTS if port else False
    h_row  = h[(h["symbol"] == sym) & (h["portfolio"] == port)] if port else h[h["symbol"] == sym]

    if not h_row.empty:
        row           = h_row.iloc[0]
        inv           = row["total_invested"] if is_usd else row["disp_invested"]
        cur           = row["current_value"]  if is_usd else row["disp_current"]
        gain          = cur - inv
        pct           = (gain / inv * 100) if inv else 0.0
        gain_pos      = gain >= 0
        bg            = "#f0fdf8" if gain_pos else "#fff5f5"
        border_left   = "#10b981" if gain_pos else "#f43f5e"
        gl_color      = "#0a7a42" if gain_pos else "#be1c1c"
        gain_sign     = "+" if gain >= 0 else ""
        pct_sign      = "+" if pct >= 0 else ""
        ltp           = round(row["current_price"], 2) if pd.notna(row.get("current_price")) else "—"
        qty           = round(row["quantity"], 3)
        avg_c         = round(row["avg_cost"], 2)
        company       = row.get("company", "") or ""
        yf_sym        = row["yf_symbol"]
        current_price = float(row["current_price"]) if pd.notna(row.get("current_price")) else None

        port_prefix = f"{port}&nbsp;·&nbsp;" if port else ""
        name_suffix = f"&nbsp;·&nbsp;{company}" if company else ""

        tg_raw = row.get("disp_today_gain") if not h_row.empty else None
        tp_raw = row.get("today_pct") if not h_row.empty else None
        if tg_raw is not None and pd.notna(tg_raw):
            tg_color = "#0a7a42" if tg_raw >= 0 else "#be1c1c"
            tg_sign  = "+" if tg_raw >= 0 else ""
            tg_txt   = f"{tg_sign}{_fmt(tg_raw, is_usd)}"
            if tp_raw is not None and pd.notna(tp_raw):
                tp_sign = "+" if tp_raw >= 0 else ""
                tg_html = f'<b style="color:{tg_color};">{tg_txt}</b><span style="color:{tg_color};">&nbsp;({tp_sign}{tp_raw:.2f}%)</span>'
            else:
                tg_html = f'<b style="color:{tg_color};">{tg_txt}</b>'
        else:
            tg_html = '<span style="color:#94a3b8;">N/A</span>'

        st.markdown(f"""
<div style="background:{bg};border:1px solid #e2e8f0;border-left:4px solid {border_left};
            border-radius:10px;padding:10px 12px;margin-bottom:8px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
    <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;">
      {port_prefix}{sym}{name_suffix}</div>
    <span style="font-size:9px;color:#94a3b8;">LTP&nbsp;<b style="color:#334155;font-weight:600;">{ltp}</b></span>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
    <span style="font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">{_fmt(cur, is_usd)}</span>
    <span style="font-size:10px;">{tg_html}</span>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
    <span style="font-size:10px;font-weight:700;color:{gl_color};">{gain_sign}{_fmt(gain, is_usd)}&nbsp;({pct_sign}{pct:.1f}%)</span>
  </div>
  <div style="border-top:1px solid #e2e8f0;padding-top:5px;">
    <span style="font-size:9px;color:#94a3b8;">
      Invested&nbsp;<b style="color:#334155;font-weight:600;">{_fmt(inv, is_usd)}</b>
      &nbsp;·&nbsp;{qty}&nbsp;sh&nbsp;·&nbsp;{avg_c}/sh
    </span>
  </div>
</div>
""", unsafe_allow_html=True)

    else:
        h_any         = h[h["symbol"] == sym]
        yf_sym        = h_any["yf_symbol"].iloc[0] if not h_any.empty else sym
        current_price = None
        st.markdown(f"**{sym}** — position fully sold")

    sym_txns = txns[
        (txns["symbol"] == sym) &
        (txns["type"].isin(["BUY", "SELL"])) &
        (~txns["portfolio"].isin(SKIP_PORTS))
    ].copy()
    if port:
        sym_txns = sym_txns[sym_txns["portfolio"] == port]

    tab_txn, tab_chart = st.tabs(["Transactions", "Charts"])

    with tab_txn:
        if sym_txns.empty:
            st.info("No transactions found.")
        else:
            sorted_txns = sym_txns.sort_values("date", ascending=False)
            html_rows = []
            for _, t in sorted_txns.iterrows():
                tx_type = t["type"]
                if tx_type == "BUY":
                    badge_bg, badge_fg = "#d1fae5", "#065f46"
                elif tx_type == "SELL":
                    badge_bg, badge_fg = "#fee2e2", "#991b1b"
                else:
                    badge_bg, badge_fg = "#dbeafe", "#1e40af"
                date_str   = t["date"].strftime("%d %b %Y")
                detail_str = f"{round(t['quantity'], 3)} sh · {round(t['price'], 2)}/sh"
                amount_str = _fmt(t["quantity"] * t["price"], is_usd)
                html_rows.append(f"""
<div style="display:flex;justify-content:space-between;align-items:center;
            padding:8px 10px;background:#fff;border:1px solid #e2e8f0;
            border-radius:8px;margin-bottom:4px;">
  <div style="display:flex;align-items:center;gap:8px;">
    <span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;
                 letter-spacing:0.05em;flex-shrink:0;
                 background:{badge_bg};color:{badge_fg};">{tx_type}</span>
    <div>
      <div style="font-size:11px;font-weight:600;color:#0f172a;">{date_str}</div>
      <div style="font-size:10px;color:#64748b;">{detail_str}</div>
    </div>
  </div>
  <div style="font-size:12px;font-weight:700;color:#0f172a;flex-shrink:0;">{amount_str}</div>
</div>""")

            st.caption(f"{len(sorted_txns)} transactions")
            st.markdown("\n".join(html_rows), unsafe_allow_html=True)

    with tab_chart:
        charts.render(sym_txns, yf_sym, current_price)
