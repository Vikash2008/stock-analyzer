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


def _summary_card(label: str, cur: float, inv: float, is_usd: bool = False) -> None:
    gain  = cur - inv
    pct   = (gain / inv * 100) if inv else 0.0
    sign  = "+" if gain >= 0 else ""
    color = "#1a7a3a" if gain >= 0 else "#c0392b"
    st.markdown(f"""
<div style="background:#f0f4fb;border:1px solid #c8d6f0;border-radius:10px;
            padding:12px 16px;margin-bottom:12px">
  <div style="font-size:12px;color:#7f8c8d;margin-bottom:2px">{label}</div>
  <div style="font-size:22px;font-weight:700;color:#1a2744">{_fmt(cur, is_usd)}</div>
  <div style="font-size:13px;font-weight:600;color:{color}">{sign}{_fmt(abs(gain), is_usd)} &nbsp; {sign}{pct:.1f}%</div>
</div>
""", unsafe_allow_html=True)


def _render_segment(bundle: PortfolioBundle) -> None:
    seg_key = ui_state.sel_segment()
    label   = _SEGMENT_LABELS.get(seg_key, "Holdings")
    seg_set = _SEGMENT_FILTER.get(seg_key)
    h       = bundle.holdings
    txns    = bundle.transactions
    usd_inr = bundle.usd_inr
    prices  = dict(zip(h["yf_symbol"], h["current_price"]))

    if st.button("← Overview", key="back_seg"):
        ui_state.navigate("portfolios")
        return

    h = h[~h["portfolio"].isin(SKIP_PORTS)]
    if seg_set is not None:
        h = h[h.apply(lambda r: segment(r["portfolio"], r["yf_symbol"]) in seg_set, axis=1)]

    if h.empty:
        st.info("No holdings in this segment.")
        return

    _summary_card(label, h["disp_current"].sum(), h["disp_invested"].sum())

    view = st.radio("", ["Cumulative", "Standalone"], horizontal=True,
                    key="seg_view", label_visibility="collapsed")

    if view == "Cumulative":
        rows, meta = [], []
        for sym, g in h.groupby("symbol", sort=False):
            qty    = g["quantity"].sum()
            inv_r  = g["disp_invested"].sum()
            cur_r  = g["disp_current"].sum()
            gain_r = cur_r - inv_r
            pct_r  = (gain_r / inv_r * 100) if inv_r else 0.0
            s      = "+" if pct_r >= 0 else ""
            ports  = sorted(g["portfolio"].unique())
            sym_t  = txns[(txns["symbol"] == sym) & (~txns["portfolio"].isin(SKIP_PORTS))]
            rows.append({
                "Symbol":     sym,
                "Invested":   _fmt(inv_r),
                "Value":      _fmt(cur_r),
                "G/L":        _fmt(gain_r),
                "Return %":   f"{s}{pct_r:.1f}%",
                "XIRR":       _xirr_str(sym_t, g, prices, usd_inr),
                "Qty":        round(qty, 2),
                "Portfolios": ", ".join(ports),
                "_cur":       cur_r,
            })
            meta.append({"sym": sym, "ports": ports})

        combined = sorted(zip(rows, meta), key=lambda x: -x[0]["_cur"])
        rows = [r for r, _ in combined]
        meta = [m for _, m in combined]
        df = pd.DataFrame(rows).drop(columns=["_cur"]).reset_index(drop=True)

        st.caption(f"{len(df)} symbols")
        ev = st.dataframe(df, use_container_width=True, hide_index=True,
                          on_select="rerun", selection_mode="single-row", key="seg_cum_sel")
        sel = ev.selection.rows if ev and ev.selection else []
        if sel:
            m = meta[sel[0]]
            port_nav = m["ports"][0] if len(m["ports"]) == 1 else ""
            ui_state.navigate("transactions", portfolio=port_nav, symbol=m["sym"])

    else:
        rows = []
        for _, row in h.iterrows():
            inv_r  = row["disp_invested"]
            cur_r  = row["disp_current"]
            gain_r = cur_r - inv_r
            pct_r  = (gain_r / inv_r * 100) if inv_r else 0.0
            s      = "+" if pct_r >= 0 else ""
            sym_t  = txns[(txns["symbol"] == row["symbol"]) &
                          (txns["portfolio"] == row["portfolio"]) &
                          (~txns["portfolio"].isin(SKIP_PORTS))]
            rows.append({
                "Symbol":    row["symbol"],
                "Portfolio": row["portfolio"],
                "Qty":       round(row["quantity"], 2),
                "Avg Cost":  round(row["avg_cost"], 2),
                "LTP":       round(row["current_price"], 2) if pd.notna(row.get("current_price")) else None,
                "Invested":  _fmt(inv_r),
                "Value":     _fmt(cur_r),
                "G/L":       _fmt(gain_r),
                "Return %":  f"{s}{pct_r:.1f}%",
                "XIRR":      _xirr_str(sym_t, row.to_frame().T, prices, usd_inr),
                "_cur":      cur_r,
            })
        rows.sort(key=lambda r: -r["_cur"])
        df = pd.DataFrame(rows).drop(columns=["_cur"]).reset_index(drop=True)

        st.caption(f"{len(df)} holdings")
        ev = st.dataframe(df, use_container_width=True, hide_index=True,
                          on_select="rerun", selection_mode="single-row", key="seg_std_sel")
        sel = ev.selection.rows if ev and ev.selection else []
        if sel:
            row = df.iloc[sel[0]]
            ui_state.navigate("transactions", portfolio=row["Portfolio"], symbol=row["Symbol"])


def render(bundle: PortfolioBundle) -> None:
    if ui_state.sel_segment():
        _render_segment(bundle)
        return

    port    = ui_state.sel_portfolio()
    h       = bundle.holdings
    txns    = bundle.transactions
    usd_inr = bundle.usd_inr
    prices  = dict(zip(h["yf_symbol"], h["current_price"]))

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
    _summary_card(port, cur, inv, is_usd)

    view = st.radio("", ["Cumulative", "Standalone"], horizontal=True,
                    key="port_view", label_visibility="collapsed")

    rows = []
    for _, row in port_h.iterrows():
        inv_r  = row["total_invested"] if is_usd else row["disp_invested"]
        cur_r  = row["current_value"]  if is_usd else row["disp_current"]
        gain_r = cur_r - inv_r
        pct_r  = (gain_r / inv_r * 100) if inv_r else 0.0
        s      = "+" if pct_r >= 0 else ""
        sym_t  = txns[(txns["symbol"] == row["symbol"]) & (txns["portfolio"] == port)]
        rows.append({
            "Symbol":   row["symbol"],
            "Qty":      round(row["quantity"], 2),
            "Avg Cost": round(row["avg_cost"], 2),
            "LTP":      round(row["current_price"], 2) if pd.notna(row.get("current_price")) else None,
            "Invested": _fmt(inv_r, is_usd),
            "Value":    _fmt(cur_r, is_usd),
            "G/L":      _fmt(gain_r, is_usd),
            "Return %": f"{s}{pct_r:.1f}%",
            "XIRR":     _xirr_str(sym_t, row.to_frame().T, prices, usd_inr),
            "_cur":     cur_r,
        })

    rows.sort(key=lambda r: -r["_cur"])
    df = pd.DataFrame(rows).drop(columns=["_cur"]).reset_index(drop=True)

    st.caption(f"{len(df)} holdings")
    ev = st.dataframe(df, use_container_width=True, hide_index=True,
                      on_select="rerun", selection_mode="single-row", key="h_sel")

    sel_rows = ev.selection.rows if ev and ev.selection else []
    if sel_rows:
        sym = df.iloc[sel_rows[0]]["Symbol"]
        ui_state.navigate("transactions", portfolio=port, symbol=sym)
