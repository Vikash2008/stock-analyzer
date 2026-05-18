import pandas as pd
import streamlit as st

from dashboard import ui_state
from dashboard.classify import USD_PORTS, SKIP_PORTS, segment
from src.engine import PortfolioBundle
from src.xirr import portfolio_xirr

_SEGMENT_LABELS = {
    "total":        "All Holdings",
    "stk":          "Stocks",
    "mf":           "Mutual Funds",
    "indian_stock": "Indian Stocks",
    "us_stock":     "US Stocks",
    "indian_mf":    "Indian MF",
    "us_mf":        "US MF",
}

_SEGMENT_FILTER = {
    "total":        None,
    "stk":          {"indian_stock", "us_stock"},
    "mf":           {"indian_mf", "us_mf"},
    "indian_stock": {"indian_stock"},
    "us_stock":     {"us_stock"},
    "indian_mf":    {"indian_mf"},
    "us_mf":        {"us_mf"},
}


def _fmt(v: float, is_usd=False) -> str:
    if is_usd:
        if abs(v) >= 1e3: return f"${v/1e3:.1f}K"
        return f"${v:,.0f}"
    if abs(v) >= 1e7: return f"₹{v/1e7:.2f} Cr"
    if abs(v) >= 1e5: return f"₹{v/1e5:.2f} L"
    return f"₹{v:,.0f}"


def _xirr_str(txns, h_rows, prices, usd_inr) -> str:
    v = portfolio_xirr(txns, h_rows, prices, usd_inr, "INR")
    return f"{v*100:+.2f}%" if v is not None else "—"


def _agg_realized(realized_df: pd.DataFrame, usd_inr: float) -> dict:
    """Returns dict of (portfolio, symbol) -> (realized_gain_inr, cost_of_sold_inr)."""
    out = {}
    for _, row in realized_df.iterrows():
        fx = usd_inr if row.get("currency", "INR") == "USD" else 1.0
        key = (row.get("portfolio", ""), row["symbol"])
        g, c = out.get(key, (0.0, 0.0))
        out[key] = (g + float(row["realized_pnl"]) * fx,
                    c + float(row["quantity"]) * float(row["buy_price"]) * fx)
    return out


def _fmt_gain(gain: float, pct: float, is_usd: bool = False) -> str:
    sign = "+" if gain >= 0 else "−"
    psign = "+" if pct >= 0 else ""
    return f"{sign}{_fmt(abs(gain), is_usd)} ({psign}{pct:.1f}%)"


@st.cache_data(show_spinner=False, ttl=1800)
def _batch_xirr(txns, h, usd_inr) -> dict:
    prices = dict(zip(h["yf_symbol"], h["current_price"]))
    out = {}
    for sym, g in h.groupby("symbol"):
        sym_t = txns[(txns["symbol"] == sym) & (~txns["portfolio"].isin(SKIP_PORTS))]
        v = portfolio_xirr(sym_t, g, prices, usd_inr, "INR")
        out[sym] = f"{v*100:+.2f}%" if v is not None else "—"
    return out


def _summary_card(label: str, cur: float, inv: float, is_usd: bool = False,
                  xirr_str: str = None, real_gain: float = 0.0, real_cost: float = 0.0,
                  today_gain=None, today_pct=None) -> None:
    total_gain = (cur - inv) + real_gain
    total_pct  = (total_gain / (inv + real_cost) * 100) if (inv + real_cost) else 0.0
    gain_pos   = total_gain >= 0
    bg          = "#f0fdf8" if gain_pos else "#fff5f5"
    border_left = "#10b981" if gain_pos else "#f43f5e"
    gl_color    = "#0a7a42" if gain_pos else "#be1c1c"
    real_color  = "#0a7a42" if real_gain >= 0 else "#be1c1c"
    gain_sign   = "+" if total_gain >= 0 else ""
    pct_sign    = "+" if total_pct  >= 0 else ""
    real_sign   = "+" if real_gain  >= 0 else ""
    gl_str      = f"{gain_sign}{_fmt(total_gain, is_usd)}"
    pct_str     = f"({pct_sign}{total_pct:.1f}%)"
    real_str    = f"{real_sign}{_fmt(real_gain, is_usd)}"
    xirr_clean  = xirr_str or "N/A"
    xirr_color  = "#334155"
    if xirr_clean != "N/A":
        xirr_color = "#be1c1c" if xirr_clean.startswith("-") else "#0a7a42"
    if today_gain is not None and pd.notna(today_gain):
        tg_color = "#0a7a42" if today_gain >= 0 else "#be1c1c"
        tg_sign  = "+" if today_gain >= 0 else ""
        tg_txt   = f"{tg_sign}{_fmt(today_gain, is_usd)}"
        if today_pct is not None and pd.notna(today_pct):
            tp_sign = "+" if today_pct >= 0 else ""
            tg_html = f'<b style="color:{tg_color};">{tg_txt}</b><span style="color:{tg_color};">&nbsp;({tp_sign}{today_pct:.2f}%)</span>'
        else:
            tg_html = f'<b style="color:{tg_color};">{tg_txt}</b>'
    else:
        tg_html = '<span style="color:#94a3b8;">N/A</span>'
    st.markdown(f"""
<div style="background:{bg};border:1px solid #e2e8f0;border-left:4px solid {border_left};
            border-radius:10px;padding:10px 12px;margin-bottom:8px;">
  <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;
              letter-spacing:0.1em;margin-bottom:5px;">{label}</div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
    <span style="font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">{_fmt(cur, is_usd)}</span>
    <span style="font-size:10px;">{tg_html}</span>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
    <span style="font-size:10px;font-weight:700;color:{gl_color};">{gl_str}&nbsp;{pct_str}</span>
    <span style="font-size:10px;color:#64748b;">XIRR&nbsp;<b style="color:{xirr_color};">{xirr_clean}</b></span>
  </div>
  <div style="border-top:1px solid #e2e8f0;padding-top:6px;display:flex;justify-content:space-between;">
    <span style="font-size:9px;color:#94a3b8;">Invested&nbsp;<b style="color:#334155;font-weight:600;">{_fmt(inv, is_usd)}</b></span>
    <span style="font-size:9px;color:#94a3b8;">Realized&nbsp;<b style="color:{real_color};font-weight:600;">{real_str}</b></span>
  </div>
</div>
""", unsafe_allow_html=True)


def _h_card(ticker, sub_label, cur, inv, real_g, real_cost, xirr_str, nav_key,
            nav_portfolio=None, nav_symbol=None, ltp=None, qty=None, avg_cost=None, is_usd=False,
            today_gain=None, today_pct=None):
    total_gain = (cur - inv) + real_g
    total_pct  = (total_gain / (inv + real_cost) * 100) if (inv + real_cost) else 0.0
    gain_pos   = total_gain >= 0

    bg          = "#f0fdf8" if gain_pos else "#fff5f5"
    border_left = "#10b981" if gain_pos else "#f43f5e"
    gl_color    = "#0a7a42" if gain_pos else "#be1c1c"
    real_color  = "#0a7a42" if real_g >= 0 else "#be1c1c"

    gain_sign  = "+" if total_gain >= 0 else ""
    pct_sign   = "+" if total_pct  >= 0 else ""
    gl_str     = f"{gain_sign}{_fmt(total_gain, is_usd)}"
    pct_str    = f"({pct_sign}{total_pct:.1f}%)"

    xirr_clean = xirr_str or "—"
    xirr_color = "#334155"
    if xirr_clean not in ("—", "N/A"):
        xirr_color = "#be1c1c" if xirr_clean.startswith("-") else "#0a7a42"

    real_sign  = "+" if real_g >= 0 else ""
    real_str   = f"{real_sign}{_fmt(real_g, is_usd)}"
    ltp_html   = f"LTP&nbsp;<b style='color:#334155;font-weight:600;'>{ltp}</b>" if ltp is not None else ""

    footer_inv = f"Invested&nbsp;<b style='color:#334155;font-weight:600;'>{_fmt(inv, is_usd)}</b>"
    if qty is not None and avg_cost is not None:
        footer_inv += f"&nbsp;·&nbsp;{round(qty, 2)}&nbsp;sh&nbsp;·&nbsp;{round(avg_cost, 2)}/sh"

    if today_gain is not None and pd.notna(today_gain):
        tg_color = "#0a7a42" if today_gain >= 0 else "#be1c1c"
        tg_sign  = "+" if today_gain >= 0 else ""
        tg_txt   = f"{tg_sign}{_fmt(today_gain, is_usd)}"
        if today_pct is not None and pd.notna(today_pct):
            tp_sign = "+" if today_pct >= 0 else ""
            tg_html = f'<b style="color:{tg_color};">{tg_txt}</b><span style="color:{tg_color};">&nbsp;({tp_sign}{today_pct:.2f}%)</span>'
        else:
            tg_html = f'<b style="color:{tg_color};">{tg_txt}</b>'
    else:
        tg_html = '<span style="color:#94a3b8;">N/A</span>'

    st.markdown(f"""
<div class="portcard" style="background:{bg};border:1px solid #e2e8f0;border-left:4px solid {border_left};
            border-radius:10px 10px 0 0;padding:10px 12px;margin-bottom:0;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
    <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;">
      {ticker}{f'&nbsp;·&nbsp;{sub_label}' if sub_label else ''}</div>
    <span style="font-size:9px;color:#94a3b8;">{ltp_html}</span>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
    <span style="font-size:16px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">{_fmt(cur, is_usd)}</span>
    <span style="font-size:10px;">{tg_html}</span>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
    <span style="font-size:10px;font-weight:700;color:{gl_color};">{gl_str}&nbsp;{pct_str}</span>
    <span style="font-size:10px;color:#64748b;">XIRR&nbsp;<b style="color:{xirr_color};">{xirr_clean}</b></span>
  </div>
  <div style="border-top:1px solid #e2e8f0;padding-top:6px;display:flex;justify-content:space-between;">
    <span style="font-size:9px;color:#94a3b8;">{footer_inv}</span>
    <span style="font-size:9px;color:#94a3b8;">Realized&nbsp;<b style="color:{real_color};font-weight:600;">{real_str}</b></span>
  </div>
</div>
""", unsafe_allow_html=True)

    if st.button("→", key=f"hbtn_{nav_key}", use_container_width=True):
        if nav_portfolio:
            ui_state.navigate("transactions", portfolio=nav_portfolio, symbol=nav_symbol)
        else:
            ui_state.navigate("transactions", symbol=nav_symbol)


def _render_segment(bundle: PortfolioBundle) -> None:
    seg_key = ui_state.sel_segment()
    label   = _SEGMENT_LABELS.get(seg_key, "Holdings")
    seg_set = _SEGMENT_FILTER.get(seg_key)
    h       = bundle.holdings
    txns    = bundle.transactions
    usd_inr = bundle.usd_inr

    if st.button("← Overview", key="back_seg"):
        ui_state.navigate("portfolios")
        return

    h = h[~h["portfolio"].isin(SKIP_PORTS)]
    if seg_set is not None:
        h = h[h.apply(lambda r: segment(r["portfolio"], r["yf_symbol"]) in seg_set, axis=1)]

    if h.empty:
        st.info("No holdings in this segment.")
        return

    real_map  = _agg_realized(bundle.realized, usd_inr)
    seg_ports = set(h["portfolio"].unique())
    seg_real_g    = sum(v[0] for k, v in real_map.items() if k[0] in seg_ports)
    seg_real_cost = sum(v[1] for k, v in real_map.items() if k[0] in seg_ports)
    prices_map = dict(zip(h["yf_symbol"], h["current_price"]))
    seg_txns   = txns[txns["portfolio"].isin(seg_ports) & txns["yf_symbol"].isin(set(h["yf_symbol"]))]
    seg_xirr_v = portfolio_xirr(seg_txns, h, prices_map, usd_inr, "INR")
    seg_xirr_str = f"{seg_xirr_v*100:+.2f}%" if seg_xirr_v is not None else "N/A"
    seg_cur  = h["disp_current"].sum()
    seg_tg   = h["disp_today_gain"].fillna(0.0).sum() if "disp_today_gain" in h.columns else None
    seg_tp   = round(seg_tg / (seg_cur - seg_tg) * 100, 2) if (seg_tg is not None and (seg_cur - seg_tg)) else None
    _summary_card(label, seg_cur, h["disp_invested"].sum(),
                  xirr_str=seg_xirr_str, real_gain=seg_real_g, real_cost=seg_real_cost,
                  today_gain=seg_tg, today_pct=seg_tp)

    view = st.radio("", ["Cumulative", "Standalone"], horizontal=True,
                    key="seg_view", label_visibility="collapsed")

    xirr_map = _batch_xirr(txns, h, usd_inr)

    if view == "Cumulative":
        rows = []
        for sym, g in h.groupby("symbol", sort=False):
            qty      = g["quantity"].sum()
            inv_r    = g["disp_invested"].sum()
            cur_r    = g["disp_current"].sum()
            ports    = sorted(g["portfolio"].unique())
            real_g   = sum(real_map.get((p, sym), (0.0, 0.0))[0] for p in ports)
            real_cost= sum(real_map.get((p, sym), (0.0, 0.0))[1] for p in ports)
            company  = g["company"].iloc[0] if "company" in g.columns and pd.notna(g["company"].iloc[0]) else ""
            ltp      = round(g["current_price"].iloc[0], 2) if "current_price" in g.columns and pd.notna(g["current_price"].iloc[0]) else None
            avg_c    = round(inv_r / qty, 2) if qty else None
            port_nav = ports[0] if len(ports) == 1 else None
            tg_r     = g["disp_today_gain"].fillna(0.0).sum() if "disp_today_gain" in g.columns else None
            tp_r     = round(tg_r / (cur_r - tg_r) * 100, 2) if (tg_r is not None and (cur_r - tg_r)) else None
            rows.append(dict(_cur=cur_r, sym=sym, company=company, cur=cur_r, inv=inv_r,
                             real_g=real_g, real_cost=real_cost, xirr=xirr_map.get(sym, "—"),
                             ltp=ltp, qty=qty, avg_c=avg_c, port_nav=port_nav,
                             today_gain=tg_r, today_pct=tp_r))

        rows.sort(key=lambda r: -r["_cur"])
        st.caption(f"{len(rows)} symbols")
        for i, r in enumerate(rows):
            _h_card(r["sym"], r["company"], r["cur"], r["inv"], r["real_g"], r["real_cost"],
                    r["xirr"], f"seg_cum_{i}",
                    nav_portfolio=r["port_nav"], nav_symbol=r["sym"],
                    ltp=r["ltp"], qty=r["qty"], avg_cost=r["avg_c"],
                    today_gain=r["today_gain"], today_pct=r["today_pct"])

    else:
        rows = []
        for _, row in h.iterrows():
            inv_r    = row["disp_invested"]
            cur_r    = row["disp_current"]
            real_g, real_cost = real_map.get((row["portfolio"], row["symbol"]), (0.0, 0.0))
            ltp      = round(row["current_price"], 2) if pd.notna(row.get("current_price")) else None
            tg_r     = row["disp_today_gain"] if "disp_today_gain" in row and pd.notna(row["disp_today_gain"]) else None
            tp_r     = row["today_pct"] if "today_pct" in row and pd.notna(row["today_pct"]) else None
            rows.append(dict(_cur=cur_r, sym=row["symbol"], port=row["portfolio"],
                             cur=cur_r, inv=inv_r, real_g=real_g, real_cost=real_cost,
                             xirr=xirr_map.get(row["symbol"], "—"),
                             ltp=ltp, qty=row["quantity"], avg_c=row["avg_cost"],
                             today_gain=tg_r, today_pct=tp_r))

        rows.sort(key=lambda r: -r["_cur"])
        st.caption(f"{len(rows)} holdings")
        for i, r in enumerate(rows):
            _h_card(r["sym"], r["port"], r["cur"], r["inv"], r["real_g"], r["real_cost"],
                    r["xirr"], f"seg_std_{i}",
                    nav_portfolio=r["port"], nav_symbol=r["sym"],
                    ltp=r["ltp"], qty=r["qty"], avg_cost=r["avg_c"],
                    today_gain=r["today_gain"], today_pct=r["today_pct"])


def render(bundle: PortfolioBundle) -> None:
    if ui_state.sel_segment():
        _render_segment(bundle)
        return

    port    = ui_state.sel_portfolio()
    h       = bundle.holdings
    txns    = bundle.transactions
    usd_inr = bundle.usd_inr

    if st.button("← All Portfolios", key="back_to_ports"):
        ui_state.navigate("portfolios")
        return

    if not port:
        st.warning("No portfolio selected.")
        return

    port_h = h[h["portfolio"] == port].copy() if "portfolio" in h.columns else h.copy()
    if port_h.empty:
        st.info(f"No holdings in {port}.")
        return

    is_usd = port in USD_PORTS
    inv    = port_h["total_invested"].sum() * usd_inr if is_usd else port_h["disp_invested"].sum()
    cur    = port_h["current_value"].sum()  * usd_inr if is_usd else port_h["disp_current"].sum()
    real_map      = _agg_realized(bundle.realized, usd_inr)
    port_real_g   = sum(v[0] for k, v in real_map.items() if k[0] == port)
    port_real_cost= sum(v[1] for k, v in real_map.items() if k[0] == port)
    prices_map    = dict(zip(port_h["yf_symbol"], port_h["current_price"]))
    port_txns     = txns[txns["portfolio"] == port] if "portfolio" in txns.columns else txns
    port_xirr_v   = portfolio_xirr(port_txns, port_h, prices_map, usd_inr, "INR")
    port_xirr_str = f"{port_xirr_v*100:+.2f}%" if port_xirr_v is not None else "N/A"
    port_tg  = port_h["disp_today_gain"].fillna(0.0).sum() if "disp_today_gain" in port_h.columns else None
    port_tp  = round(port_tg / (cur - port_tg) * 100, 2) if (port_tg is not None and (cur - port_tg)) else None
    _summary_card(port, cur, inv, is_usd,
                  xirr_str=port_xirr_str, real_gain=port_real_g, real_cost=port_real_cost,
                  today_gain=port_tg, today_pct=port_tp)

    tab_hold, tab_sum = st.tabs(["Holdings", "Summary"])

    with tab_hold:
        port_xirr_map = _batch_xirr(txns, port_h, usd_inr)

        rows = []
        for _, row in port_h.iterrows():
            inv_r    = row["total_invested"] if is_usd else row["disp_invested"]
            cur_r    = row["current_value"]  if is_usd else row["disp_current"]
            real_g, real_cost = real_map.get((port, row["symbol"]), (0.0, 0.0))
            ltp      = round(row["current_price"], 2) if pd.notna(row.get("current_price")) else None
            company  = row.get("company", "") if pd.notna(row.get("company", None)) else ""
            tg_r     = row["disp_today_gain"] if "disp_today_gain" in row and pd.notna(row["disp_today_gain"]) else None
            tp_r     = row["today_pct"] if "today_pct" in row and pd.notna(row["today_pct"]) else None
            rows.append(dict(_cur=cur_r, sym=row["symbol"], company=company,
                             cur=cur_r, inv=inv_r, real_g=real_g, real_cost=real_cost,
                             xirr=port_xirr_map.get(row["symbol"], "—"),
                             ltp=ltp, qty=row["quantity"], avg_c=row["avg_cost"],
                             today_gain=tg_r, today_pct=tp_r))

        rows.sort(key=lambda r: -r["_cur"])
        st.caption(f"{len(rows)} holdings")
        for i, r in enumerate(rows):
            _h_card(r["sym"], r["company"], r["cur"], r["inv"], r["real_g"], r["real_cost"],
                    r["xirr"], f"port_{port}_{i}",
                    nav_portfolio=port, nav_symbol=r["sym"],
                    ltp=r["ltp"], qty=r["qty"], avg_cost=r["avg_c"], is_usd=is_usd,
                    today_gain=r["today_gain"], today_pct=r["today_pct"])

    with tab_sum:
        from dashboard import summary_page
        summary_page.render(bundle, port)
