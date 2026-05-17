import streamlit as st
from src import engine
from dashboard import filters, metrics, holdings, transactions, portfolio_split

st.set_page_config(
    page_title="Portfolio Analyzer",
    page_icon="📈",
    layout="wide",
)

st.markdown("""
<style>
  /* Layout */
  .block-container { padding-top: 1rem !important; }
  header[data-testid="stHeader"] { display: none; }

  /* Sidebar */
  [data-testid="stSidebar"] { background: #1a2744; }
  [data-testid="stSidebar"] * { color: #c8d6f0 !important; }
  [data-testid="stSidebar"] .stButton > button { background: #2e4a8a; border: none; color: #fff !important; }

  /* Section captions */
  .stCaption { color: #6b7fa3 !important; font-size: 11px !important; letter-spacing: 0.05em; }

  /* Divider */
  hr { border-color: #e4eaf5 !important; }

  /* Expander header */
  [data-testid="stExpander"] summary {
    background: #f0f4fb;
    border-radius: 6px;
    font-size: 13px;
    color: #1a2744;
  }

  /* Dataframe header row */
  [data-testid="stDataFrameResizable"] th { background: #f0f4fb !important; color: #1a2744 !important; font-size: 12px !important; }

  /* Radio buttons */
  [data-testid="stRadio"] label { font-size: 12px !important; }

  /* Buttons */
  .stButton > button {
    font-size: 12px !important;
    padding: 2px 10px !important;
    border-radius: 6px !important;
    border: 1px solid #c8d6f0 !important;
    color: #1a2744 !important;
    background: #f0f4fb !important;
  }
  .stButton > button:hover { background: #2e4a8a !important; color: #fff !important; }
</style>
""", unsafe_allow_html=True)

st.markdown("### 📈 Portfolio Analyzer")

# ── Sidebar: read filters before loading data ─────────────────────────────────
with st.sidebar:
    st.header("Filters")

    # We need all_portfolios before the multiselect — load a minimal bundle first
    # using session_state to avoid a double load on every rerender
    if "all_portfolios" not in st.session_state:
        _probe = engine.build()
        st.session_state["all_portfolios"] = _probe.all_portfolios

    all_portfolios = st.session_state["all_portfolios"]

    selected = st.multiselect(
        "Portfolio",
        options=all_portfolios,
        default=all_portfolios,
    )
    selected = selected or all_portfolios

    currency = st.radio("Display currency", ["INR", "USD"], horizontal=True)

    st.divider()
    refresh = st.button("🔄 Refresh prices")

# ── Load data (reads from disk cache; only re-fetches stale layers) ───────────
bundle = engine.build(
    selected_portfolios=selected,
    currency=currency,
    force_refresh_prices=refresh,
)

# Update sidebar metadata after load
with st.sidebar:
    st.caption(f"USD/INR: {bundle.usd_inr:.2f}")
    st.caption(f"As of: {bundle.as_of.strftime('%d %b %Y %H:%M')}")
    with st.expander("Cache status"):
        st.code(bundle.cache_status)

# ── Dashboard sections (add new ones here only) ───────────────────────────────
metrics.render(bundle)


