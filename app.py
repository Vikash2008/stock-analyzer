import streamlit as st
from src import engine
from src.cache import Cache
from dashboard import ui_state
from dashboard import portfolio_page, holdings_page, transactions_page, summary_page

st.set_page_config(
    page_title="Portfolio Analyzer",
    page_icon="📈",
    layout="wide",
)

st.markdown("""
<style>
  .block-container { padding-top: 1rem !important; }
  header[data-testid="stHeader"] { display: none; }
  #MainMenu { display: none !important; }
  footer { display: none !important; }
  [data-testid="stToolbar"] { display: none !important; }
  [data-testid="stDecoration"] { display: none !important; }
  [data-testid="stBottom"] { display: none !important; }
  [data-testid="stBottomBlockContainer"] { display: none !important; }
  [data-testid="stStatusWidget"] { display: none !important; }
  .viewerBadge_container__r5tak { display: none !important; }
  .viewerBadge_link__qRIco { display: none !important; }
  #stDecoration { display: none !important; }
  .block-container { padding-bottom: 1rem !important; }
  .main > div { padding-bottom: 0 !important; }

  [data-testid="stSidebar"] { background: linear-gradient(180deg, #0d1b2e 0%, #162640 100%); }
  [data-testid="stSidebar"] * { color: #b8cce8 !important; }
  [data-testid="stSidebar"] .stButton > button {
    background: #1e3a5f !important; border: 1px solid #2a4a75 !important;
    color: #e2eaf5 !important; border-radius: 6px !important;
  }
  [data-testid="stSidebar"] .stButton > button:hover { background: #2563eb !important; border-color: #2563eb !important; }

  .stCaption { color: #64748b !important; font-size: 11px !important; letter-spacing: 0.04em; }
  [data-testid="column"] [data-testid="element-container"] { margin-bottom: 2px !important; }
  hr { border-color: #e8eef5 !important; }

  [data-testid="stExpander"] summary {
    background: #f8fafc; border-radius: 8px; font-size: 13px; color: #1e293b;
    border: 1px solid #e2e8f0;
  }
  [data-testid="stDataFrameResizable"] th {
    background: #f1f5f9 !important; color: #475569 !important;
    font-size: 11px !important; font-weight: 600 !important;
    text-transform: uppercase !important; letter-spacing: 0.05em !important;
  }
  [data-testid="stDataFrameResizable"] td { font-size: 12px !important; color: #1e293b !important; }
  [data-testid="stRadio"] label { font-size: 11px !important; font-weight: 500 !important; }
  .stButton > button {
    font-size: 11px !important; padding: 3px 10px !important;
    border-radius: 6px !important; border: 1px solid #e2e8f0 !important;
    color: #334155 !important; background: #ffffff !important;
    font-weight: 500 !important;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04) !important;
  }
  .stButton > button:hover {
    background: #2563eb !important; color: #fff !important;
    border-color: #2563eb !important;
    box-shadow: 0 2px 6px rgba(37,99,235,0.25) !important;
  }

  @media screen and (max-width: 768px) {
    .block-container { padding-top: 0.4rem !important; padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
    .portfolio-tile { padding: 8px 10px !important; border-radius: 8px !important; }
    .tile-label { font-size: 9px !important; margin-bottom: 2px !important; }
    .tile-value { font-size: 17px !important; }
    .tile-grid { margin-top: 6px !important; gap: 3px 6px !important; }
    .tile-sublabel { font-size: 9px !important; }
    .tile-subval { font-size: 12px !important; }
    .summary-card { padding: 10px 12px !important; border-radius: 8px !important; }
    .card-value { font-size: 18px !important; }
    .stButton > button { font-size: 10px !important; padding: 2px 8px !important; }
    [data-testid="stCaptionContainer"] { font-size: 10px !important; }
    [data-testid="column"] { gap: 0.25rem !important; }
    [data-testid="stVerticalBlock"] { gap: 0.3rem !important; }
  }
</style>
""", unsafe_allow_html=True)

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("### 📈 Portfolio Analyzer")
    currency = st.radio("Display currency", ["INR", "USD"], horizontal=True)
    st.divider()

# ── Load bundle once (cached indefinitely — manual refresh only) ──────────────
@st.cache_data(show_spinner="Loading portfolio…")
def _load_bundle(currency):
    return engine.build(currency=currency, force_refresh_prices=False)

bundle = _load_bundle(currency)

with st.sidebar:
    st.caption(f"USD/INR: {bundle.usd_inr:.2f}")
    with st.expander("Cache"):
        st.code(bundle.cache_status)

# ── Top-right refresh bar ─────────────────────────────────────────────────────
_, _ref_col = st.columns([5, 1])
with _ref_col:
    st.caption(f"As of {bundle.as_of.strftime('%d %b %H:%M')}")
    if st.button("🔄 Refresh", use_container_width=True):
        c = Cache()
        c.invalidate("prices")
        c.invalidate("fx")
        _load_bundle.clear()
        st.rerun()

# ── Page router ───────────────────────────────────────────────────────────────
page = ui_state.get_page()

if page == "holdings":
    holdings_page.render(bundle)
elif page == "transactions":
    transactions_page.render(bundle)
elif page == "summary":
    summary_page.render_page(bundle)
else:
    st.markdown("### 📈 Portfolio Analyzer")
    portfolio_page.render(bundle)
