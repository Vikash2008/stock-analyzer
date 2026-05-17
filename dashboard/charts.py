from datetime import datetime, timedelta

import pandas as pd
import plotly.graph_objects as go
import streamlit as st
import yfinance as yf

_RANGES    = ["1d", "5d", "1m", "3m", "6m", "1y", "2y", "3y", "5y", "All"]
_RANGE_DAYS = {"1d": 1, "5d": 5, "1m": 30, "3m": 90, "6m": 182,
               "1y": 365, "2y": 730, "3y": 1095, "5y": 1825}


@st.cache_data(ttl=3600, show_spinner=False)
def _fetch_history(yf_symbol: str, start: str) -> pd.DataFrame:
    try:
        raw = yf.download(yf_symbol, start=start, auto_adjust=True, progress=False)
        if raw.empty:
            return pd.DataFrame()
        if isinstance(raw.columns, pd.MultiIndex):
            raw.columns = raw.columns.droplevel(1)
        return raw["Close"].dropna().reset_index().rename(columns={"Date": "date", "Close": "close"})
    except Exception:
        return pd.DataFrame()


def _apply_range(df: pd.DataFrame, sel: str) -> pd.DataFrame:
    if sel == "All" or df.empty:
        return df
    cutoff = pd.Timestamp.today() - pd.Timedelta(days=_RANGE_DAYS[sel])
    return df[df["date"] >= cutoff]


def render(sym_txns: pd.DataFrame, yf_symbol: str, current_price: float | None) -> None:
    if sym_txns.empty:
        st.info("No transactions to chart.")
        return

    # Fetch from the earlier of: first transaction − 30d, or 5 years ago
    first_tx       = sym_txns["date"].min() - pd.Timedelta(days=30)
    five_years_ago = datetime.today() - timedelta(days=5 * 365)
    start = min(first_tx.to_pydatetime(), five_years_ago).strftime("%Y-%m-%d")

    with st.spinner("Loading price history…"):
        hist = _fetch_history(yf_symbol, start)

    # Persist selected range per symbol
    range_key = f"chart_range_{yf_symbol}"
    sel = st.session_state.get(range_key, "1y")

    # Filter both price history and transactions to the range so y-axis auto-scales
    hist_view = _apply_range(hist, sel)
    txns_view = _apply_range(sym_txns.copy(), sel)

    fig = go.Figure()

    if not hist_view.empty:
        fig.add_trace(go.Scatter(
            x=hist_view["date"], y=hist_view["close"],
            mode="lines", name="Price",
            line=dict(color="#2e4a8a", width=1.5),
            hovertemplate="%{x|%d %b %Y}  %{y:,.2f}<extra></extra>",
        ))
    elif hist.empty:
        st.warning("Price history unavailable — showing transactions only.")

    # Bubble size relative to all transactions (consistent across range changes)
    max_val = (sym_txns["quantity"] * sym_txns["price"]).max() or 1
    txns_view = txns_view.copy()
    txns_view["tx_value"] = txns_view["quantity"] * txns_view["price"]

    for tx_type, color in [("BUY", "#27ae60"), ("SELL", "#e74c3c")]:
        t = txns_view[txns_view["type"] == tx_type]
        if t.empty:
            continue
        fig.add_trace(go.Scatter(
            x=t["date"], y=t["price"],
            mode="markers", name=tx_type,
            marker=dict(
                size=(t["tx_value"] / max_val * 36 + 10).clip(10, 46),
                color=color, opacity=0.85,
                line=dict(width=1.5, color="white"),
            ),
            customdata=list(zip(t["quantity"].round(3), t["price"].round(2), t["tx_value"].round(0))),
            hovertemplate=(
                f"<b>{tx_type}</b>  %{{x|%d %b %Y}}<br>"
                "Qty: %{{customdata[0]}}<br>"
                "Price: %{{customdata[1]:,}}<br>"
                "Value: %{{customdata[2]:,}}<br>"
                "<extra></extra>"
            ),
        ))

    fig.update_layout(
        height=400,
        margin=dict(l=0, r=0, t=10, b=0),
        legend=dict(orientation="h", yanchor="bottom", y=1.01, xanchor="left", x=0),
        hovermode="closest",
        plot_bgcolor="#ffffff", paper_bgcolor="#ffffff",
        xaxis=dict(showgrid=True, gridcolor="#f0f4fb", zeroline=False),
        yaxis=dict(showgrid=True, gridcolor="#f0f4fb", zeroline=False),
        font=dict(size=12),
    )

    st.plotly_chart(fig, use_container_width=True,
                    config={"modeBarButtonsToRemove": ["lasso2d", "select2d", "autoScale2d"]})

    # Range selector below chart
    new_sel = st.radio(
        "", _RANGES, index=_RANGES.index(sel), horizontal=True,
        key=f"range_sel_{yf_symbol}", label_visibility="collapsed",
    )
    if new_sel != sel:
        st.session_state[range_key] = new_sel
        st.rerun()
