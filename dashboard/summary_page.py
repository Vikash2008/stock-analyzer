import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from dashboard.charts import _fetch_history
from dashboard.classify import USD_PORTS, SKIP_PORTS
from dashboard import ui_state
from src.engine import PortfolioBundle
from src.xirr import portfolio_xirr

_METRICS    = ["Portfolio Value", "Invested", "Profit / Loss", "Return %", "XIRR Trend"]
_RANGES     = ["1m", "3m", "6m", "1y", "2y", "3y", "5y", "All"]
_RANGE_DAYS = {"1m": 30, "3m": 90, "6m": 182, "1y": 365,
               "2y": 730, "3y": 1095, "5y": 1825}

_SEGMENT_LABELS = {
    "total": "All Holdings", "stk": "Stocks", "mf": "Mutual Funds",
    "indian_stock": "Indian Stocks", "us_stock": "US Stocks",
    "indian_mf": "Indian MF", "us_mf": "US MF",
}
_SEGMENT_FILTER = {
    "total": None,
    "stk":          {"indian_stock", "us_stock"},
    "mf":           {"indian_mf", "us_mf"},
    "indian_stock": {"indian_stock"},
    "us_stock":     {"us_stock"},
    "indian_mf":    {"indian_mf"},
    "us_mf":        {"us_mf"},
}

# ── Cached heavy builders (full history — range filtering done in caller) ─────

@st.cache_data(ttl=1800, show_spinner=False)
def _build_value_series(port_h: pd.DataFrame, txns_port: pd.DataFrame,
                        usd_inr: float) -> pd.Series:
    """Portfolio value history using actual historical quantities per symbol."""
    if port_h.empty:
        return pd.Series(dtype=float)
    parts = []
    for _, row in port_h.iterrows():
        sym      = row["yf_symbol"]
        is_usd   = row["portfolio"] in USD_PORTS
        sym_txns = txns_port[txns_port["yf_symbol"] == sym].sort_values("date")
        if sym_txns.empty:
            continue
        hist = _fetch_history(sym, "2010-01-01")
        if hist.empty:
            continue
        price_s = hist.set_index("date")["close"]
        # Build daily quantity step function: BUY adds, SELL subtracts
        deltas = sym_txns.copy()
        deltas["delta"] = deltas.apply(
            lambda r: r["quantity"] if r["type"] == "BUY" else -r["quantity"], axis=1
        )
        qty_ts    = deltas.groupby("date")["delta"].sum().cumsum()
        qty_daily = qty_ts.reindex(price_s.index).ffill().fillna(0).clip(lower=0)
        first     = sym_txns["date"].min()
        mask      = price_s.index >= first
        s = price_s[mask] * qty_daily[mask]
        if is_usd:
            s = s * usd_inr
        if not s.empty:
            parts.append(s)
    if not parts:
        return pd.Series(dtype=float)
    return pd.concat(parts, axis=1).ffill().sum(axis=1).sort_index()


@st.cache_data(ttl=1800, show_spinner=False)
def _build_invested_series(port_h: pd.DataFrame, txns_port: pd.DataFrame,
                           usd_inr: float) -> pd.Series:
    """Historical invested = qty_at_T × avg_cost, same date index and FX as value series."""
    if port_h.empty:
        return pd.Series(dtype=float)
    parts = []
    for _, row in port_h.iterrows():
        sym      = row["yf_symbol"]
        is_usd   = row["portfolio"] in USD_PORTS
        avg_cost = float(row["avg_cost"])
        sym_txns = txns_port[txns_port["yf_symbol"] == sym].sort_values("date")
        if sym_txns.empty:
            continue
        hist = _fetch_history(sym, "2010-01-01")
        if hist.empty:
            continue
        price_dates = hist.set_index("date").index
        deltas = sym_txns.copy()
        deltas["delta"] = deltas.apply(
            lambda r: r["quantity"] if r["type"] == "BUY" else -r["quantity"], axis=1
        )
        qty_ts    = deltas.groupby("date")["delta"].sum().cumsum()
        qty_daily = qty_ts.reindex(price_dates).ffill().fillna(0).clip(lower=0)
        first     = sym_txns["date"].min()
        mask      = price_dates >= first
        s = qty_daily[mask] * avg_cost
        if is_usd:
            s = s * usd_inr
        if not s.empty:
            parts.append(s)
    if not parts:
        return pd.Series(dtype=float)
    return pd.concat(parts, axis=1).ffill().sum(axis=1).sort_index()


@st.cache_data(ttl=1800, show_spinner=False)
def _build_xirr_trend(txns: pd.DataFrame, port_h: pd.DataFrame,
                      usd_inr: float, portfolio: str) -> pd.Series:
    """Monthly XIRR over full history. Cached — first run is slow, range switches instant."""
    pt = txns[txns["portfolio"] == portfolio].copy()
    if pt.empty:
        return pd.Series(dtype=float)
    prices = dict(zip(port_h["yf_symbol"], port_h["current_price"]))
    months = pd.date_range(pt["date"].min(), pd.Timestamp.today(), freq="ME")
    out = []
    for dt in months:
        t_sub = pt[pt["date"] <= dt]
        if t_sub.empty:
            continue
        v = portfolio_xirr(t_sub, port_h, prices, usd_inr, "INR")
        if v is not None:
            out.append((dt, round(v * 100, 2)))
    if not out:
        return pd.Series(dtype=float)
    return pd.Series([x[1] for x in out], index=[x[0] for x in out])


@st.cache_data(ttl=1800, show_spinner=False)
def _build_xirr_trend_multi(txns_seg: pd.DataFrame, port_h: pd.DataFrame,
                             usd_inr: float) -> pd.Series:
    """Monthly XIRR using historical portfolio value at each month T as terminal.
    This gives 'what would my annualised return have been if I exited at month T?'
    and avoids the today's-terminal distortion for multi-portfolio segments.
    """
    if txns_seg.empty or port_h.empty:
        return pd.Series(dtype=float)

    # Build combined historical value series across all portfolios in segment
    ports = list(port_h["portfolio"].unique())
    val_parts = []
    for p in ports:
        ph = port_h[port_h["portfolio"] == p]
        pt = txns_seg[txns_seg["portfolio"] == p]
        sv = _build_value_series(ph, pt, usd_inr)
        if not sv.empty:
            val_parts.append(sv)

    if not val_parts:
        return pd.Series(dtype=float)
    val_series = pd.concat(val_parts, axis=1).ffill().sum(axis=1).sort_index()

    prices = dict(zip(port_h["yf_symbol"], port_h["current_price"]))
    months = pd.date_range(txns_seg["date"].min(), pd.Timestamp.today(), freq="ME")
    out = []
    for dt in months:
        t_sub = txns_seg[txns_seg["date"] <= dt]
        if t_sub.empty:
            continue
        # Historical portfolio value at this month end
        past = val_series[val_series.index <= dt]
        if past.empty:
            continue
        terminal = float(past.iloc[-1])
        if terminal <= 0:
            continue
        h_sub = port_h[port_h["portfolio"].isin(set(t_sub["portfolio"].unique()))]
        v = portfolio_xirr(t_sub, h_sub, prices, usd_inr, "INR",
                           terminal_override=terminal, terminal_date=dt)
        if v is not None:
            out.append((dt, round(v * 100, 2)))
    if not out:
        return pd.Series(dtype=float)
    return pd.Series([x[1] for x in out], index=[x[0] for x in out])


def _slice(s: pd.Series, sel_r: str) -> pd.Series:
    if sel_r == "All" or s.empty:
        return s
    cutoff = pd.Timestamp.today() - pd.Timedelta(days=_RANGE_DAYS[sel_r])
    return s[s.index >= cutoff]


def _pnl_series(val_full: pd.Series, inv_full: pd.Series) -> pd.Series:
    """Align value and invested over full history, then return P&L series."""
    c = pd.concat([val_full, inv_full], axis=1, keys=["v", "i"]).ffill().dropna()
    return c["v"] - c["i"]


def _fmt_num(v: float) -> str:
    av = abs(v)
    if av >= 1e7:
        return f"₹{v/1e7:.2f} Cr"
    if av >= 1e5:
        return f"₹{v/1e5:.2f} L"
    return f"₹{v:,.0f}"


def _stat(label: str, value: str, color: str = "#1a2744") -> None:
    st.markdown(
        f'<div style="margin-bottom:6px">'
        f'<span style="font-size:11px;color:#7f8c8d;text-transform:uppercase">{label}: </span>'
        f'<span style="font-size:15px;font-weight:700;color:{color}">{value}</span>'
        f'</div>',
        unsafe_allow_html=True,
    )


# ── Plotting helpers ──────────────────────────────────────────────────────────

def _rgb(h: str) -> str:
    h = h.lstrip("#")
    return ",".join(str(int(h[i:i+2], 16)) for i in (0, 2, 4))


def _auto_scale(s: pd.Series):
    """Return (divisor, hover_suffix, tick_suffix) based on series magnitude."""
    mx = s.abs().max() if not s.empty else 0
    if mx >= 1e7:
        return 1e7, " Cr", " Cr"
    if mx >= 1e5:
        return 1e5, " L", " L"
    return 1.0, "", ""


def _line_fig(x, y, name: str, color: str,
              fmt: str = ",.2f", suffix: str = "",
              divisor: float = 1.0, fill: bool = True) -> go.Figure:
    yv = [v / divisor for v in y] if divisor != 1.0 else list(y)
    return go.Figure(go.Scatter(
        x=x, y=yv, mode="lines", name=name,
        line=dict(color=color, width=2),
        fill="tozeroy" if fill else "none",
        fillcolor=f"rgba({_rgb(color)},0.08)" if fill else None,
        hovertemplate=f"%{{x|%d %b %Y}}  %{{y:{fmt}}}{suffix}<extra></extra>",
    ))


def _style(fig: go.Figure, title: str, y_tick_suffix: str = "") -> None:
    fig.update_layout(
        height=380, margin=dict(l=0, r=0, t=32, b=0),
        title=dict(text=title, font=dict(size=13, color="#1a2744"), x=0),
        plot_bgcolor="#ffffff", paper_bgcolor="#ffffff",
        xaxis=dict(showgrid=True, gridcolor="#f0f4fb", zeroline=False),
        yaxis=dict(showgrid=True, gridcolor="#f0f4fb", zeroline=False,
                   rangemode="normal", ticksuffix=y_tick_suffix),
        font=dict(size=12), showlegend=False,
    )


# ── Selector UI (shared) ──────────────────────────────────────────────────────

def _selectors(mk: str, rk: str, mkey: str, rkey: str):
    sel_m = st.session_state.get(mk, "Portfolio Value")
    sel_r = st.session_state.get(rk, "1y")
    new_m = st.radio("", _METRICS, index=_METRICS.index(sel_m),
                     horizontal=True, key=mkey, label_visibility="collapsed")
    new_r = st.radio("", _RANGES,  index=_RANGES.index(sel_r),
                     horizontal=True, key=rkey, label_visibility="collapsed")
    if new_m != sel_m or new_r != sel_r:
        st.session_state[mk] = new_m
        st.session_state[rk] = new_r
        st.rerun()
    return sel_m, sel_r


# ── Chart renderer for a single portfolio ────────────────────────────────────

def render(bundle: PortfolioBundle, port: str) -> None:
    h, txns, usd_inr = bundle.holdings, bundle.transactions, bundle.usd_inr
    port_h    = h[h["portfolio"] == port].copy()
    txns_port = txns[txns["portfolio"] == port]
    if port_h.empty:
        st.info("No holdings to summarize.")
        return

    sel_m, sel_r = _selectors(f"sum_m_{port}", f"sum_r_{port}",
                               f"smm_{port}", f"smr_{port}")

    with st.spinner("Loading… (first time only)"):
        val_full = _build_value_series(port_h, txns_port, usd_inr)
        inv_full = _build_invested_series(port_h, txns_port, usd_inr)
        val_s    = _slice(val_full, sel_r)
        inv_s    = _slice(inv_full, sel_r)

        if sel_m == "Portfolio Value":
            if val_s.empty:
                st.info("No price data.")
            else:
                d, sf, tsf = _auto_scale(val_s)
                gain = val_s.iloc[-1] - val_s.iloc[0]
                gc2  = "#27ae60" if gain >= 0 else "#e74c3c"
                _stat("Gain in period", f"{'+'if gain>=0 else ''}{_fmt_num(gain)}", gc2)
                fig = _line_fig(val_s.index, val_s.values, "Value", "#2e4a8a", divisor=d, suffix=sf, fill=False)
                _style(fig, "Portfolio Value Over Time", y_tick_suffix=tsf)
                st.plotly_chart(fig, use_container_width=True)

        elif sel_m == "Invested":
            if inv_s.empty:
                st.info("No transactions in this range.")
            else:
                d, sf, tsf = _auto_scale(inv_s)
                invested_in_period = inv_s.iloc[-1] - inv_s.iloc[0]
                _stat("Invested in period", _fmt_num(invested_in_period))
                fig = _line_fig(inv_s.index, inv_s.values, "Invested", "#7f8c8d", divisor=d, suffix=sf, fill=False)
                _style(fig, "Cumulative Invested Over Time", y_tick_suffix=tsf)
                st.plotly_chart(fig, use_container_width=True)

        elif sel_m == "Profit / Loss":
            if val_full.empty or inv_full.empty:
                st.info("Not enough data.")
            else:
                pnl = _slice(_pnl_series(val_full, inv_full), sel_r)
                if pnl.empty:
                    st.info("Not enough data.")
                else:
                    d, sf, tsf = _auto_scale(pnl)
                    chg = pnl.iloc[-1] - pnl.iloc[0]
                    gc  = "#27ae60" if chg >= 0 else "#e74c3c"
                    _stat("Gain / Loss in period", f"{'+'if chg>=0 else ''}{_fmt_num(chg)}", gc)
                    color = "#27ae60" if pnl.iloc[-1] >= 0 else "#e74c3c"
                    fig = _line_fig(pnl.index, pnl.values, "P&L", color, divisor=d, suffix=sf)
                    fig.add_hline(y=0, line_color="#aaaaaa", line_dash="dot", line_width=1)
                    _style(fig, "Profit / Loss Over Time", y_tick_suffix=tsf)
                    st.plotly_chart(fig, use_container_width=True)

        elif sel_m == "Return %":
            if val_full.empty or inv_full.empty:
                st.info("Not enough data.")
            else:
                c = pd.concat([val_full, inv_full], axis=1, keys=["v", "i"]).ffill().dropna()
                ret = _slice((c["v"] - c["i"]) / c["i"] * 100, sel_r)
                if ret.empty:
                    st.info("Not enough data.")
                else:
                    rv = ret.iloc[-1]
                    gc = "#27ae60" if rv >= 0 else "#e74c3c"
                    rchg = ret.iloc[-1] - ret.iloc[0]
                    rc   = "#27ae60" if rchg >= 0 else "#e74c3c"
                    _stat("Return gain in period", f"{'+'if rchg>=0 else ''}{rchg:.1f}%", rc)
                    fig = _line_fig(ret.index, ret.values, "Return %", gc, fmt=".1f", suffix="%")
                    fig.add_hline(y=0, line_color="#aaaaaa", line_dash="dot", line_width=1)
                    _style(fig, "Return % Over Time", y_tick_suffix="%")
                    st.plotly_chart(fig, use_container_width=True)

        elif sel_m == "XIRR Trend":
            s = _slice(_build_xirr_trend(txns, port_h, usd_inr, port), sel_r)
            if s.empty:
                st.info("Not enough data for XIRR trend.")
            else:
                xv = s.iloc[-1]
                gc = "#27ae60" if xv >= 0 else "#e74c3c"
                _stat("XIRR", f"{xv:+.2f}%", gc)
                fig = _line_fig(s.index, s.values, "XIRR %", gc, fmt=".2f", suffix="%")
                fig.add_hline(y=0, line_color="#aaaaaa", line_dash="dot", line_width=1)
                _style(fig, "XIRR Trend (Monthly)", y_tick_suffix="%")
                st.plotly_chart(fig, use_container_width=True)


# ── Chart renderer for a segment (multiple portfolios) ───────────────────────

def _render_multi(bundle: PortfolioBundle, filtered_h: pd.DataFrame) -> None:
    txns, usd_inr = bundle.transactions, bundle.usd_inr
    ports         = list(filtered_h["portfolio"].unique())
    sel_m, sel_r  = _selectors("sum_m_seg", "sum_r_seg", "smm_seg", "smr_seg")

    def _val_series_list():
        out = []
        for p in ports:
            ph = filtered_h[filtered_h["portfolio"] == p]
            pt = txns[txns["portfolio"] == p]
            sv = _build_value_series(ph, pt, usd_inr)
            if not sv.empty:
                out.append(sv)
        return out

    with st.spinner("Loading… (first time only)"):
        v_parts  = _val_series_list()
        i_parts  = [sv for sv in [
            _build_invested_series(filtered_h[filtered_h["portfolio"] == p],
                                   txns[txns["portfolio"] == p], usd_inr)
            for p in ports] if not sv.empty]
        full_val = pd.concat(v_parts, axis=1).ffill().sum(axis=1).sort_index() if v_parts else pd.Series(dtype=float)
        full_inv = pd.concat(i_parts, axis=1).ffill().sum(axis=1).sort_index() if i_parts else pd.Series(dtype=float)
        val_s    = _slice(full_val, sel_r)
        inv_s    = _slice(full_inv, sel_r)

        if sel_m == "Portfolio Value":
            if val_s.empty:
                st.info("No price data.")
            else:
                d, sf, tsf = _auto_scale(val_s)
                gain = val_s.iloc[-1] - val_s.iloc[0]
                gc2  = "#27ae60" if gain >= 0 else "#e74c3c"
                _stat("Gain in period", f"{'+'if gain>=0 else ''}{_fmt_num(gain)}", gc2)
                fig = _line_fig(val_s.index, val_s.values, "Value", "#2e4a8a", divisor=d, suffix=sf, fill=False)
                _style(fig, "Portfolio Value Over Time", y_tick_suffix=tsf)
                st.plotly_chart(fig, use_container_width=True)

        elif sel_m == "Invested":
            if inv_s.empty:
                st.info("No transactions in this range.")
            else:
                d, sf, tsf = _auto_scale(inv_s)
                invested_in_period = inv_s.iloc[-1] - inv_s.iloc[0]
                _stat("Invested in period", _fmt_num(invested_in_period))
                fig = _line_fig(inv_s.index, inv_s.values, "Invested", "#7f8c8d", divisor=d, suffix=sf, fill=False)
                _style(fig, "Cumulative Invested Over Time", y_tick_suffix=tsf)
                st.plotly_chart(fig, use_container_width=True)

        elif sel_m == "Profit / Loss":
            if full_val.empty or full_inv.empty:
                st.info("Not enough data.")
            else:
                pnl = _slice(_pnl_series(full_val, full_inv), sel_r)
                if pnl.empty:
                    st.info("Not enough data.")
                else:
                    d, sf, tsf = _auto_scale(pnl)
                    chg = pnl.iloc[-1] - pnl.iloc[0]
                    gc  = "#27ae60" if chg >= 0 else "#e74c3c"
                    _stat("Gain / Loss in period", f"{'+'if chg>=0 else ''}{_fmt_num(chg)}", gc)
                    color = "#27ae60" if pnl.iloc[-1] >= 0 else "#e74c3c"
                    fig = _line_fig(pnl.index, pnl.values, "P&L", color, divisor=d, suffix=sf)
                    fig.add_hline(y=0, line_color="#aaaaaa", line_dash="dot", line_width=1)
                    _style(fig, "Profit / Loss Over Time", y_tick_suffix=tsf)
                    st.plotly_chart(fig, use_container_width=True)

        elif sel_m == "Return %":
            if full_val.empty or full_inv.empty:
                st.info("Not enough data.")
            else:
                c = pd.concat([full_val, full_inv], axis=1, keys=["v", "i"]).ffill().dropna()
                ret = _slice((c["v"] - c["i"]) / c["i"] * 100, sel_r)
                if ret.empty:
                    st.info("Not enough data.")
                else:
                    rv = ret.iloc[-1]
                    gc = "#27ae60" if rv >= 0 else "#e74c3c"
                    rchg = ret.iloc[-1] - ret.iloc[0]
                    rc   = "#27ae60" if rchg >= 0 else "#e74c3c"
                    _stat("Return gain in period", f"{'+'if rchg>=0 else ''}{rchg:.1f}%", rc)
                    fig = _line_fig(ret.index, ret.values, "Return %", gc, fmt=".1f", suffix="%")
                    fig.add_hline(y=0, line_color="#aaaaaa", line_dash="dot", line_width=1)
                    _style(fig, "Return % Over Time", y_tick_suffix="%")
                    st.plotly_chart(fig, use_container_width=True)

        elif sel_m == "XIRR Trend":
            syms      = set(filtered_h["yf_symbol"])
            txns_seg  = txns[txns["portfolio"].isin(ports) & txns["yf_symbol"].isin(syms)]
            s = _slice(_build_xirr_trend_multi(txns_seg, filtered_h, usd_inr), sel_r)
            if s.empty:
                st.info("Not enough data for XIRR trend.")
            else:
                xv = s.iloc[-1]
                gc = "#27ae60" if xv >= 0 else "#e74c3c"
                _stat("XIRR", f"{xv:+.2f}%", gc)
                fig = _line_fig(s.index, s.values, "XIRR %", gc, fmt=".2f", suffix="%")
                fig.add_hline(y=0, line_color="#aaaaaa", line_dash="dot", line_width=1)
                _style(fig, "XIRR Trend (Monthly)", y_tick_suffix="%")
                st.plotly_chart(fig, use_container_width=True)


# ── Standalone page entry point ───────────────────────────────────────────────

def render_page(bundle: PortfolioBundle) -> None:
    from dashboard.classify import segment as classify_segment

    port    = ui_state.sel_portfolio()
    seg_key = ui_state.sel_segment()

    if st.button("← Overview", key="back_sum"):
        ui_state.navigate("portfolios")
        return

    if seg_key:
        label   = _SEGMENT_LABELS.get(seg_key, seg_key)
        seg_set = _SEGMENT_FILTER.get(seg_key)
        h = bundle.holdings[~bundle.holdings["portfolio"].isin(SKIP_PORTS)]
        if seg_set is not None:
            h = h[h.apply(lambda r: classify_segment(r["portfolio"], r["yf_symbol"]) in seg_set, axis=1)]
        st.caption(f"Summary · {label}")
        _render_multi(bundle, h)
    elif port:
        st.caption(f"Summary · {port}")
        render(bundle, port)
    else:
        st.warning("No portfolio selected.")
