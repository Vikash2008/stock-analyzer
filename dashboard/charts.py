import pandas as pd
import plotly.graph_objects as go
import streamlit as st
import yfinance as yf


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


def render(sym_txns: pd.DataFrame, yf_symbol: str, current_price: float | None) -> None:
    """Price line chart with BUY/SELL bubbles for a single symbol."""
    if sym_txns.empty:
        st.info("No transactions to chart.")
        return

    start = (sym_txns["date"].min() - pd.Timedelta(days=30)).strftime("%Y-%m-%d")

    with st.spinner("Loading price history…"):
        hist = _fetch_history(yf_symbol, start)

    fig = go.Figure()

    if not hist.empty:
        fig.add_trace(go.Scatter(
            x=hist["date"], y=hist["close"],
            mode="lines", name="Price",
            line=dict(color="#2e4a8a", width=1.5),
            hovertemplate="%{x|%d %b %Y}  %{y:,.2f}<extra></extra>",
        ))
    else:
        st.warning("Price history unavailable — showing transactions only.")

    sym_txns = sym_txns.copy()
    sym_txns["tx_value"] = sym_txns["quantity"] * sym_txns["price"]
    max_val = sym_txns["tx_value"].max() or 1

    for tx_type, color in [("BUY", "#27ae60"), ("SELL", "#e74c3c")]:
        t = sym_txns[sym_txns["type"] == tx_type]
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
                "Qty: %{customdata[0]}<br>"
                "Price: %{customdata[1]:,}<br>"
                "Value: %{customdata[2]:,}<br>"
                "<extra></extra>"
            ),
        ))

    fig.update_layout(
        height=400,
        margin=dict(l=0, r=0, t=10, b=0),
        legend=dict(orientation="h", yanchor="bottom", y=1.01, xanchor="right", x=1),
        hovermode="closest",
        plot_bgcolor="#ffffff", paper_bgcolor="#ffffff",
        xaxis=dict(showgrid=True, gridcolor="#f0f4fb", zeroline=False),
        yaxis=dict(showgrid=True, gridcolor="#f0f4fb", zeroline=False),
        font=dict(size=12),
    )

    st.plotly_chart(fig, use_container_width=True)
