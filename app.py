import streamlit as st
from src import engine
from dashboard import ui_state
from dashboard import portfolio_page, holdings_page, transactions_page

st.set_page_config(
    page_title="Portfolio Analyzer",
    page_icon="📈",
    layout="wide",
)

st.markdown("""
<style>
  .block-container { padding-top: 1rem !important; }
  header[data-testid="stHeader"] { display: none; }

  [data-testid="stSidebar"] { background: #1a2744; }
  [data-testid="stSidebar"] * { color: #c8d6f0 !important; }
  [data-testid="stSidebar"] .stButton > button { background: #2e4a8a; border: none; color: #fff !important; }

  .stCaption { color: #6b7fa3 !important; font-size: 11px !important; letter-spacing: 0.05em; }
  hr { border-color: #e4eaf5 !important; }

  [data-testid="stExpander"] summary {
    background: #f0f4fb; border-radius: 6px; font-size: 13px; color: #1a2744;
  }
  [data-testid="stDataFrameResizable"] th {
    background: #f0f4fb !important; color: #1a2744 !important; font-size: 12px !important;
  }
  [data-testid="stRadio"] label { font-size: 12px !important; }
  .stButton > button {
    font-size: 12px !important; padding: 4px 12px !important;
    border-radius: 6px !important; border: 1px solid #c8d6f0 !important;
    color: #1a2744 !important; background: #f0f4fb !important;
  }
  .stButton > button:hover { background: #2e4a8a !important; color: #fff !important; }
</style>
""", unsafe_allow_html=True)

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("### 📈 Portfolio Analyzer")
    currency = st.radio("Display currency", ["INR", "USD"], horizontal=True)
    st.divider()
    refresh = st.button("🔄 Refresh prices")

# ── Load bundle once (all portfolios) ─────────────────────────────────────────
@st.cache_data(show_spinner="Loading portfolio…", ttl=1800)
def _load_bundle(currency):
    return engine.build(currency=currency, force_refresh_prices=False)

if refresh:
    _load_bundle.clear()

bundle = _load_bundle(currency)

with st.sidebar:
    st.caption(f"USD/INR: {bundle.usd_inr:.2f}")
    st.caption(f"As of: {bundle.as_of.strftime('%d %b %Y %H:%M')}")
    with st.expander("Cache"):
        st.code(bundle.cache_status)

# ── Page router ───────────────────────────────────────────────────────────────
page = ui_state.get_page()

if page == "holdings":
    holdings_page.render(bundle)
elif page == "transactions":
    transactions_page.render(bundle)
else:
    st.markdown("### 📈 Portfolio Analyzer")
    portfolio_page.render(bundle)
