import streamlit as st

from src.engine import PortfolioBundle
from src.xirr import portfolio_xirr
from dashboard.classify import segment, SKIP_PORTS, USD_PORTS


def _fmt(v: float) -> str:
    if abs(v) >= 1e7: return f"₹{v/1e7:.2f} Cr"
    if abs(v) >= 1e5: return f"₹{v/1e5:.2f} L"
    return f"₹{v:,.2f}"


@st.cache_data(ttl=1800, show_spinner=False)
def _compute_all(h, txns, usd_inr):
    """Heavy computation cached for 30 min — runs once per price refresh cycle."""
    prices = dict(zip(h["yf_symbol"], h["current_price"]))

    # Segment totals
    totals = {s: [0.0, 0.0] for s in ("indian_mf", "us_mf", "indian_stock", "us_stock")}
    for port, yf_sym, is_usd, inv, cur in zip(
        h["portfolio"], h["yf_symbol"],
        h["portfolio"].isin(USD_PORTS),
        h["total_invested"], h["current_value"],
    ):
        seg = segment(port, yf_sym)
        if seg == "skip": continue
        inv_inr = float(inv) * usd_inr if is_usd else float(h.loc[h["yf_symbol"]==yf_sym, "disp_invested"].iloc[0])
        cur_inr = float(cur) * usd_inr if is_usd else float(h.loc[h["yf_symbol"]==yf_sym, "disp_current"].iloc[0])
        totals[seg][0] += inv_inr
        totals[seg][1] += cur_inr

    # Simpler vectorized totals
    totals = {s: [0.0, 0.0] for s in ("indian_mf", "us_mf", "indian_stock", "us_stock")}
    for _, row in h.iterrows():
        seg = segment(row["portfolio"], row["yf_symbol"])
        if seg == "skip": continue
        is_usd = row["portfolio"] in USD_PORTS
        totals[seg][0] += row["total_invested"] * usd_inr if is_usd else row["disp_invested"]
        totals[seg][1] += row["current_value"]  * usd_inr if is_usd else row["disp_current"]

    def xirr_seg(seg_name):
        filt = h["portfolio"].apply(lambda p: segment(p, "") != "skip") & \
               h.apply(lambda r: segment(r["portfolio"], r["yf_symbol"]) == seg_name, axis=1)
        filt_t = txns.apply(lambda r: segment(r.get("portfolio",""), r.get("yf_symbol","")) == seg_name, axis=1)
        v = portfolio_xirr(txns[filt_t], h[filt], prices, usd_inr, "INR")
        return f"{v*100:+.2f}%" if v is not None else "N/A"

    def xirr_ports(port_set):
        hh = h[h["portfolio"].isin(port_set)]
        tt = txns[txns["portfolio"].isin(port_set)] if "portfolio" in txns.columns else txns
        v = portfolio_xirr(tt, hh, prices, usd_inr, "INR")
        return f"{v*100:+.2f}%" if v is not None else "N/A"

    def xirr_multi_seg(seg_names):
        seg_set = set(seg_names)
        filt   = h.apply(lambda r: segment(r["portfolio"], r["yf_symbol"]) in seg_set, axis=1)
        filt_t = txns.apply(lambda r: segment(r.get("portfolio",""), r.get("yf_symbol","")) in seg_set, axis=1)
        v = portfolio_xirr(txns[filt_t], h[filt], prices, usd_inr, "INR")
        return f"{v*100:+.2f}%" if v is not None else "N/A"

    active_ports = set(h["portfolio"].unique()) - SKIP_PORTS
    xirr_total   = xirr_ports(active_ports)
    xirr_stk     = xirr_multi_seg(["indian_stock", "us_stock"])
    xirr_mf      = xirr_multi_seg(["indian_mf", "us_mf"])
    xirr_ind_mf  = xirr_seg("indian_mf")
    xirr_us_mf   = xirr_seg("us_mf")
    xirr_ind_stk = xirr_seg("indian_stock")
    xirr_us_stk  = xirr_seg("us_stock")

    # Per-portfolio XIRR
    port_xirr = {}
    for port in active_ports:
        hh = h[h["portfolio"] == port]
        tt = txns[txns["portfolio"] == port] if "portfolio" in txns.columns else txns
        v = portfolio_xirr(tt, hh, prices, usd_inr, "INR")
        port_xirr[port] = f"{v*100:+.2f}%" if v is not None else "N/A"

    return totals, xirr_total, xirr_stk, xirr_mf, xirr_ind_mf, xirr_us_mf, xirr_ind_stk, xirr_us_stk, port_xirr, prices


def _show_holdings(h, usd_inr, txns=None, seg_filter=None, prices=None):
    if "portfolio" in h.columns:
        h = h[~h["portfolio"].isin(SKIP_PORTS)]
    if seg_filter is not None:
        mask = h.apply(lambda r: segment(r.get("portfolio",""), r.get("yf_symbol","")) in seg_filter, axis=1)
        h = h[mask]
    if h.empty:
        st.info("No holdings in this segment.")
        return

    view = st.radio("View", ["Cumulative", "By Portfolio"], horizontal=True, key="holdings_view")

    import pandas as pd

    if view == "Cumulative":
        rows = []
        for sym, g in h.groupby("symbol", sort=False):
            qty      = g["quantity"].sum()
            invested = g["disp_invested"].sum()
            current  = g["disp_current"].sum()
            gain     = current - invested
            pct      = (gain / invested * 100) if invested else 0.0
            ltp      = g["current_price"].iloc[0] if "current_price" in g.columns else None
            xirr_val = None
            if txns is not None and prices is not None:
                sym_txns = txns[(txns["symbol"] == sym) & (~txns["portfolio"].isin(SKIP_PORTS))]
                v = portfolio_xirr(sym_txns, g, prices, usd_inr, "INR")
                xirr_val = f"{v*100:+.2f}%" if v is not None else "N/A"
            rows.append({
                "Symbol":    sym,
                "Current":   _fmt(current),
                "Gain/Loss": _fmt(gain),
                "P&L %":     f"{pct:+.1f}%",
                "XIRR":      xirr_val or "N/A",
                "Invested":  _fmt(invested),
                "Qty":       round(qty, 2),
                "Avg Cost":  round(invested / qty, 2) if qty else 0,
                "LTP":       round(ltp, 2) if ltp else None,
                "Portfolios": ", ".join(sorted(g["portfolio"].unique())) if "portfolio" in g.columns else "",
                "_cur_raw":  current,
            })
        rows.sort(key=lambda r: -r["_cur_raw"])
        disp = pd.DataFrame(rows).drop(columns=["_cur_raw"]).reset_index(drop=True)
    else:
        show = {
            "symbol": "Symbol", "disp_current": "Current", "disp_gain": "Gain/Loss",
            "disp_pnl_pct": "P&L %", "disp_invested": "Invested",
            "quantity": "Qty", "avg_cost": "Avg Cost", "current_price": "LTP",
            "portfolio": "Portfolio",
        }
        available = {k: v for k, v in show.items() if k in h.columns}
        disp = h[list(available.keys())].rename(columns=available).copy().reset_index(drop=True)
        disp["Current"]   = disp["Current"].apply(_fmt)
        disp["Gain/Loss"] = disp["Gain/Loss"].apply(_fmt)
        disp["Invested"]  = disp["Invested"].apply(_fmt)
        disp["P&L %"]     = disp["P&L %"].apply(lambda x: f"{x:+.1f}%")
        for col in ["Avg Cost", "LTP", "Qty"]:
            if col in disp.columns:
                disp[col] = disp[col].round(2)

    key = f"sel_row_{sorted(seg_filter) if seg_filter else 'all'}"
    sym_key = f"sym_{key}"

    # If nothing selected yet, show full table with selection
    selected_sym = st.session_state.get(sym_key)

    def _txn_panel(sym):
        if txns is None: return
        t = txns[txns["symbol"] == sym].copy()
        t["date"] = t["date"].dt.strftime("%d %b %Y")
        cols = {"date": "Date", "portfolio": "Portfolio", "type": "Type",
                "quantity": "Qty", "price": "Price", "charges": "Charges"}
        avail = {k: v for k, v in cols.items() if k in t.columns}
        _, r = st.columns([0.03, 0.97])
        with r:
            st.caption(f"↳ **{sym}** — Transactions")
            st.dataframe(t[list(avail.keys())].rename(columns=avail).sort_values("Date", ascending=False),
                         use_container_width=True, hide_index=True)

    if not selected_sym:
        ev = st.dataframe(disp, use_container_width=True, hide_index=True,
                          on_select="rerun", selection_mode="single-row", key=key)
        sel = ev.selection.rows if ev and ev.selection else []
        if sel:
            st.session_state[sym_key] = disp.iloc[sel[0]]["Symbol"]
            st.rerun()
    else:
        idx = disp[disp["Symbol"] == selected_sym].index[0]

        # Top slice — clicking the last row (selected) collapses; any other row expands it
        top_ev = st.dataframe(disp.iloc[:idx+1], use_container_width=True, hide_index=True,
                              on_select="rerun", selection_mode="single-row", key=f"top_{key}")
        top_sel = top_ev.selection.rows if top_ev and top_ev.selection else []
        if top_sel:
            clicked = disp.iloc[top_sel[0]]["Symbol"]
            st.session_state[sym_key] = None if clicked == selected_sym else clicked
            st.rerun()

        _txn_panel(selected_sym)

        below = disp.iloc[idx+1:].reset_index(drop=True)
        if not below.empty:
            bot_ev = st.dataframe(below, use_container_width=True, hide_index=True,
                                  on_select="rerun", selection_mode="single-row", key=f"bot_{key}")
            bot_sel = bot_ev.selection.rows if bot_ev and bot_ev.selection else []
            if bot_sel:
                st.session_state[sym_key] = below.iloc[bot_sel[0]]["Symbol"]
                st.rerun()


def _tile(col, label, cur, inv, xirr_str, key):
    gain = cur - inv
    pct  = (gain / inv * 100) if inv else 0.0
    sign = "+" if gain >= 0 else ""
    is_pos = gain >= 0
    gain_color  = "#1a7a3a" if is_pos else "#c0392b"
    border_color = "#27ae60" if is_pos else "#e74c3c"
    bg_color     = "#f0faf4" if is_pos else "#fdf3f2"
    xirr_line = f'<div style="font-size:11px; color:#7f8c8d; margin-top:5px">XIRR &nbsp;<b>{xirr_str}</b></div>' if xirr_str else ""
    col.markdown(f"""
<div style="background:{bg_color}; border:1px solid #dde6f0; border-radius:10px;
            padding:14px 16px; margin-bottom:4px; border-left:4px solid {border_color}">
  <div style="font-size:11px; color:#7f8c8d; text-transform:uppercase;
              letter-spacing:0.07em; margin-bottom:6px">{label}</div>
  <div style="font-size:22px; font-weight:700; color:#1a2744; line-height:1.2">{_fmt(cur)}</div>
  <div style="margin-top:6px; display:flex; gap:8px; align-items:baseline">
    <span style="font-size:13px; font-weight:600; color:{gain_color}">{sign}{_fmt(gain)}</span>
    <span style="font-size:15px; font-weight:700; color:{gain_color}">{sign}{pct:.1f}%</span>
  </div>
  {xirr_line}
</div>
""", unsafe_allow_html=True)
    if col.button("↓ Holdings", key=key, use_container_width=True):
        st.session_state["active_segment"] = None if st.session_state.get("active_segment") == key else key


def render(bundle: PortfolioBundle) -> None:
    h       = bundle.holdings
    txns    = bundle.transactions
    usd_inr = bundle.usd_inr
    (totals, xirr_total, xirr_stk, xirr_mf, xirr_ind_mf, xirr_us_mf,
     xirr_ind_stk, xirr_us_stk, port_xirr, prices) = _compute_all(h, txns, usd_inr)

    inv_ind_mf,  cur_ind_mf  = totals["indian_mf"]
    inv_us_mf,   cur_us_mf   = totals["us_mf"]
    inv_ind_stk, cur_ind_stk = totals["indian_stock"]
    inv_us_stk,  cur_us_stk  = totals["us_stock"]

    inv_total = inv_ind_mf + inv_us_mf + inv_ind_stk + inv_us_stk
    cur_total = cur_ind_mf + cur_us_mf + cur_ind_stk + cur_us_stk
    inv_mf    = inv_ind_mf + inv_us_mf
    cur_mf    = cur_ind_mf + cur_us_mf
    inv_stk   = inv_ind_stk + inv_us_stk
    cur_stk   = cur_ind_stk + cur_us_stk

    # ── Row 1: 3 tiles ────────────────────────────────────────────────────────
    st.caption("**Overview**")
    _tile(st, "Total Portfolio", cur_total, inv_total, xirr_total, "total")
    oc1, oc2 = st.columns(2)
    _tile(oc1, "Stocks",       cur_stk, inv_stk, xirr_stk, "stk")
    _tile(oc2, "Mutual Funds", cur_mf,  inv_mf,  xirr_mf,  "mf")

    # ── Row 2: breakdown ─────────────────────────────────────────────────────
    bl, br = st.columns([0.4, 0.6])
    bl.caption("**Breakdown**")
    breakdown_mode = br.radio("", ["By Category", "By Portfolio"],
                              horizontal=True, key="breakdown_mode",
                              label_visibility="collapsed")

    if breakdown_mode == "By Category":
        r1c1, r1c2 = st.columns(2)
        _tile(r1c1, "Indian Stocks", cur_ind_stk, inv_ind_stk, xirr_ind_stk, "indian_stock")
        _tile(r1c2, "US Stocks",     cur_us_stk,  inv_us_stk,  xirr_us_stk,  "us_stock")
        r2c1, r2c2 = st.columns(2)
        _tile(r2c1, "Indian MF",     cur_ind_mf,  inv_ind_mf,  xirr_ind_mf,  "indian_mf")
        _tile(r2c2, "US MF",         cur_us_mf,   inv_us_mf,   xirr_us_mf,   "us_mf")
    else:
        _SKIP_PORT_VIEW = SKIP_PORTS | {"IndMoney Ind"}
        indian, us = [], []
        for port, g in h.groupby("portfolio"):
            if port in _SKIP_PORT_VIEW: continue
            is_usd = port in USD_PORTS
            inv = g["total_invested"].sum() * usd_inr if is_usd else g["disp_invested"].sum()
            cur = g["current_value"].sum()  * usd_inr if is_usd else g["disp_current"].sum()
            xirr_s = port_xirr.get(port, "N/A")
            (us if is_usd else indian).append((cur, port, inv, xirr_s))

        indian.sort(key=lambda x: -x[0])
        us.sort(key=lambda x: -x[0])

        st.markdown("<div style='font-size:11px;color:#6b7fa3;text-transform:uppercase;letter-spacing:0.06em;margin:6px 0 2px'>🇮🇳 &nbsp;India</div>",
                    unsafe_allow_html=True)
        if indian:
            for col, (cur_p, port, inv_p, xirr_p) in zip(st.columns(len(indian)), indian):
                _tile(col, port, cur_p, inv_p, xirr_p, f"port_{port}")

        st.markdown("<div style='font-size:11px;color:#6b7fa3;text-transform:uppercase;letter-spacing:0.06em;margin:8px 0 2px'>🇺🇸 &nbsp;US</div>",
                    unsafe_allow_html=True)
        if us:
            cols = st.columns(len(us) + (len(indian) - len(us)))  # align width with India row
            for col, (cur_p, port, inv_p, xirr_p) in zip(cols, us):
                _tile(col, port, cur_p, inv_p, xirr_p, f"port_{port}")

    # ── Holdings drawer ───────────────────────────────────────────────────────
    seg_map = {
        "total":        (None,                         "All Holdings"),
        "mf":           ({"indian_mf", "us_mf"},       "Mutual Funds"),
        "stk":          ({"indian_stock", "us_stock"}, "Stocks"),
        "indian_mf":    ({"indian_mf"},                "Indian MF"),
        "us_mf":        ({"us_mf"},                    "US MF"),
        "indian_stock": ({"indian_stock"},              "Indian Stocks"),
        "us_stock":     ({"us_stock"},                  "US Stocks"),
    }
    active = st.session_state.get("active_segment")
    if active:
        seg_filter, seg_label = seg_map.get(active, (None, "Holdings"))
        with st.expander(f"{seg_label} — Holdings", expanded=True):
            _show_holdings(h, usd_inr, txns=txns, seg_filter=seg_filter, prices=prices)
