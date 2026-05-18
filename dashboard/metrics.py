import pandas as pd
import streamlit as st

from src.engine import PortfolioBundle
from src.xirr import portfolio_xirr
from dashboard.classify import segment, SKIP_PORTS, USD_PORTS
from dashboard import ui_state


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
        filt = (~h["portfolio"].isin(SKIP_PORTS)) & \
               h.apply(lambda r: segment(r["portfolio"], r["yf_symbol"]) == seg_name, axis=1)
        syms  = set(h[filt]["yf_symbol"])
        ports = set(h[filt]["portfolio"])
        filt_t = txns["portfolio"].isin(ports) & txns["yf_symbol"].isin(syms)
        v = portfolio_xirr(txns[filt_t], h[filt], prices, usd_inr, "INR")
        return f"{v*100:+.2f}%" if v is not None else "N/A"

    def xirr_ports(port_set):
        hh = h[h["portfolio"].isin(port_set)]
        tt = txns[txns["portfolio"].isin(port_set)] if "portfolio" in txns.columns else txns
        v = portfolio_xirr(tt, hh, prices, usd_inr, "INR")
        return f"{v*100:+.2f}%" if v is not None else "N/A"

    def xirr_multi_seg(seg_names):
        seg_set = set(seg_names)
        filt = (~h["portfolio"].isin(SKIP_PORTS)) & \
               h.apply(lambda r: segment(r["portfolio"], r["yf_symbol"]) in seg_set, axis=1)
        syms  = set(h[filt]["yf_symbol"])
        ports = set(h[filt]["portfolio"])
        filt_t = txns["portfolio"].isin(ports) & txns["yf_symbol"].isin(syms)
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


def _card(label, cur, inv, real_gain, cost_of_sold, xirr_str, key,
          nav_portfolio=None, nav_segment=None, today_gain=None, today_pct=None,
          compact=False):
    """Mobile-first card matching page_portfolios.html tile style."""
    total_gain = (cur - inv) + real_gain
    total_pct  = (total_gain / (inv + cost_of_sold) * 100) if (inv + cost_of_sold) else 0.0
    gain_pos   = total_gain >= 0

    bg          = "#f0fdf8"  if gain_pos else "#fff5f5"
    border_left = "#10b981"  if gain_pos else "#f43f5e"
    gl_color    = "#0a7a42"  if gain_pos else "#be1c1c"

    gain_sign = "+" if total_gain >= 0 else ""
    pct_sign  = "+" if total_pct  >= 0 else ""
    gl_str    = f"{gain_sign}{_fmt(total_gain)}"
    pct_str   = f"({pct_sign}{total_pct:.1f}%)"

    xirr_clean = xirr_str or "N/A"
    xirr_color = "#334155"
    if xirr_clean != "N/A":
        xirr_color = "#be1c1c" if xirr_clean.startswith("-") else "#0a7a42"

    if today_gain is not None and not pd.isna(today_gain):
        tg_color = "#0a7a42" if today_gain >= 0 else "#be1c1c"
        tg_sign  = "+" if today_gain >= 0 else ""
        tg_txt   = f"{tg_sign}{_fmt(today_gain)}"
        if today_pct is not None and not pd.isna(today_pct):
            tp_sign = "+" if today_pct >= 0 else ""
            tg_html = f'<b style="color:{tg_color};">{tg_txt}</b><span style="color:{tg_color};">&nbsp;({tp_sign}{today_pct:.2f}%)</span>'
        else:
            tg_html = f'<b style="color:{tg_color};">{tg_txt}</b>'
    else:
        tg_html = '<span style="color:#94a3b8;">N/A</span>'

    if compact:
        val_size  = "13px"
        sub_size  = "9px"
        padding   = "6px 10px"
        radius    = "8px 8px 0 0"
        lbl_mb    = "2px"
        row_mb    = "2px"
    else:
        val_size  = "22px"
        sub_size  = "10px"
        padding   = "9px 12px"
        radius    = "10px 10px 0 0"
        lbl_mb    = "5px"
        row_mb    = "4px"

    with st.container():
        st.markdown(f"""
<div class="portcard" style="background:{bg};border:1px solid #e2e8f0;border-left:4px solid {border_left};
            border-radius:10px;padding:{padding};margin-bottom:0;">
  <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;
              letter-spacing:0.1em;margin-bottom:{lbl_mb};">{label}</div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:{row_mb};">
    <span style="font-size:{val_size};font-weight:700;color:#0f172a;letter-spacing:-0.02em;">{_fmt(cur)}</span>
    <span style="font-size:{sub_size};">{tg_html}</span>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;">
    <span style="font-size:{sub_size};font-weight:700;color:{gl_color};">{gl_str}&nbsp;{pct_str}</span>
    <span style="font-size:{sub_size};color:#64748b;">XIRR&nbsp;<b style="color:{xirr_color};">{xirr_clean}</b></span>
  </div>
</div>
""", unsafe_allow_html=True)
        if st.button("→", key=f"click_{key}", use_container_width=True):
            if nav_portfolio:
                ui_state.navigate("holdings", portfolio=nav_portfolio)
            else:
                ui_state.navigate("holdings", segment=nav_segment or key)


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

    # ── Realized gains by segment ─────────────────────────────────────────────
    _sym_yf = {(r["portfolio"], r["symbol"]): r["yf_symbol"] for _, r in txns.iterrows()}
    _rseg, _rport = {}, {}
    for _, r in bundle.realized.iterrows():
        p = r.get("portfolio", "")
        if p in SKIP_PORTS:
            continue
        fx  = usd_inr if r.get("currency", "INR") == "USD" else 1.0
        g   = float(r["realized_pnl"]) * fx
        c   = float(r["quantity"]) * float(r["buy_price"]) * fx
        seg = segment(p, _sym_yf.get((p, r["symbol"]), r["symbol"]))
        if seg == "skip":
            continue
        _rseg.setdefault(seg,  [0.0, 0.0]); _rseg[seg][0]  += g; _rseg[seg][1]  += c
        _rport.setdefault(p,   [0.0, 0.0]); _rport[p][0]   += g; _rport[p][1]   += c

    def _rg(d, k): v = d.get(k, [0.0, 0.0]); return v[0], v[1]
    rg_ind_stk, rc_ind_stk = _rg(_rseg, "indian_stock")
    rg_us_stk,  rc_us_stk  = _rg(_rseg, "us_stock")
    rg_ind_mf,  rc_ind_mf  = _rg(_rseg, "indian_mf")
    rg_us_mf,   rc_us_mf   = _rg(_rseg, "us_mf")
    rg_stk = rg_ind_stk + rg_us_stk;  rc_stk = rc_ind_stk + rc_us_stk
    rg_mf  = rg_ind_mf  + rg_us_mf;   rc_mf  = rc_ind_mf  + rc_us_mf
    rg_tot = rg_stk + rg_mf;           rc_tot = rc_stk + rc_mf

    # ── Today's gain by segment ───────────────────────────────────────────────
    def _tg_pct(tg, cur):
        prev = cur - tg
        return round(tg / prev * 100, 2) if prev else 0.0

    if "disp_today_gain" in h.columns:
        h_ns = h[~h["portfolio"].isin(SKIP_PORTS)].copy()
        h_ns["_tg"]  = h_ns["disp_today_gain"].fillna(0.0)
        h_ns["_seg"] = h_ns.apply(lambda r: segment(r["portfolio"], r["yf_symbol"]), axis=1)
        by_seg  = h_ns.groupby("_seg")["_tg"].sum()
        by_port = h_ns.groupby("portfolio")["_tg"].sum().to_dict()
        tg_ind_stk = float(by_seg.get("indian_stock", 0.0))
        tg_us_stk  = float(by_seg.get("us_stock",     0.0))
        tg_ind_mf  = float(by_seg.get("indian_mf",    0.0))
        tg_us_mf   = float(by_seg.get("us_mf",        0.0))
        tg_stk = tg_ind_stk + tg_us_stk
        tg_mf  = tg_ind_mf  + tg_us_mf
        tg_tot = tg_stk + tg_mf
    else:
        tg_ind_stk = tg_us_stk = tg_ind_mf = tg_us_mf = tg_stk = tg_mf = tg_tot = None
        by_port = {}

    # ── Hero ──────────────────────────────────────────────────────────────────
    _card("Total Portfolio", cur_total, inv_total, rg_tot, rc_tot, xirr_total,
          "total", nav_segment="total",
          today_gain=tg_tot, today_pct=_tg_pct(tg_tot, cur_total) if tg_tot is not None else None)

    # ── Stocks + MF ───────────────────────────────────────────────────────────
    _card("Stocks",       cur_stk, inv_stk, rg_stk, rc_stk, xirr_stk,
          "stk", nav_segment="stk",
          today_gain=tg_stk, today_pct=_tg_pct(tg_stk, cur_stk) if tg_stk is not None else None,
          compact=True)
    _card("Mutual Funds", cur_mf,  inv_mf,  rg_mf,  rc_mf,  xirr_mf,
          "mf",  nav_segment="mf",
          today_gain=tg_mf, today_pct=_tg_pct(tg_mf, cur_mf) if tg_mf is not None else None,
          compact=True)

    # ── Breakdown toggle ─────────────────────────────────────────────────────
    mode = st.radio(
        "Breakdown", ["By Type", "By Broker"],
        horizontal=True, key="breakdown_mode",
    )

    # ── By Type ───────────────────────────────────────────────────────────────
    if mode == "By Type":
        _card("Indian Stocks", cur_ind_stk, inv_ind_stk, rg_ind_stk, rc_ind_stk,
              xirr_ind_stk, "indian_stock", nav_segment="indian_stock",
              today_gain=tg_ind_stk, today_pct=_tg_pct(tg_ind_stk, cur_ind_stk) if tg_ind_stk is not None else None,
              compact=True)
        _card("US Stocks",     cur_us_stk,  inv_us_stk,  rg_us_stk,  rc_us_stk,
              xirr_us_stk,  "us_stock",     nav_segment="us_stock",
              today_gain=tg_us_stk, today_pct=_tg_pct(tg_us_stk, cur_us_stk) if tg_us_stk is not None else None,
              compact=True)
        _card("Indian MF",     cur_ind_mf,  inv_ind_mf,  rg_ind_mf,  rc_ind_mf,
              xirr_ind_mf,  "indian_mf",    nav_segment="indian_mf",
              today_gain=tg_ind_mf, today_pct=_tg_pct(tg_ind_mf, cur_ind_mf) if tg_ind_mf is not None else None,
              compact=True)
        _card("US MF",         cur_us_mf,   inv_us_mf,   rg_us_mf,   rc_us_mf,
              xirr_us_mf,   "us_mf",        nav_segment="us_mf",
              today_gain=tg_us_mf, today_pct=_tg_pct(tg_us_mf, cur_us_mf) if tg_us_mf is not None else None,
              compact=True)

    # ── By Broker ─────────────────────────────────────────────────────────────
    else:
        _SKIP_PORT_VIEW = SKIP_PORTS | {"IndMoney Ind"}
        indian, us = [], []
        for port, g in h.groupby("portfolio"):
            if port in _SKIP_PORT_VIEW:
                continue
            is_usd = port in USD_PORTS
            inv_p = g["total_invested"].sum() * usd_inr if is_usd else g["disp_invested"].sum()
            cur_p = g["current_value"].sum()  * usd_inr if is_usd else g["disp_current"].sum()
            xirr_p = port_xirr.get(port, "N/A")
            rg_p, rc_p = _rg(_rport, port)
            (us if is_usd else indian).append((cur_p, port, inv_p, xirr_p, rg_p, rc_p))

        indian.sort(key=lambda x: -x[0])
        us.sort(key=lambda x: -x[0])

        st.markdown("🇮🇳 **India**")
        for cur_p, port, inv_p, xirr_p, rg_p, rc_p in indian:
            tg_p = by_port.get(port)
            _card(port, cur_p, inv_p, rg_p, rc_p, xirr_p,
                  f"port_{port}", nav_portfolio=port,
                  today_gain=tg_p, today_pct=_tg_pct(tg_p, cur_p) if tg_p is not None else None,
                  compact=True)

        st.markdown("🇺🇸 **US**")
        for cur_p, port, inv_p, xirr_p, rg_p, rc_p in us:
            tg_p = by_port.get(port)
            _card(port, cur_p, inv_p, rg_p, rc_p, xirr_p,
                  f"port_{port}", nav_portfolio=port,
                  today_gain=tg_p, today_pct=_tg_pct(tg_p, cur_p) if tg_p is not None else None,
                  compact=True)
