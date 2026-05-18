"""Navigation state — session_state only, URL sync on read for refresh persistence."""
import streamlit as st


def _init():
    """Sync from URL query params once per session (on first load / refresh)."""
    if st.session_state.get("_nav_init"):
        return
    st.session_state["_nav_init"] = True
    try:
        qp = st.query_params
        if "page" in qp:
            st.session_state["page"] = qp["page"]
        if "portfolio" in qp:
            st.session_state["sel_portfolio"] = qp["portfolio"]
        if "symbol" in qp:
            st.session_state["sel_symbol"] = qp["symbol"]
    except Exception:
        pass


def get_page() -> str:
    _init()
    return st.session_state.get("page", "portfolios")


def navigate(page: str, portfolio: str = None, symbol: str = None, segment: str = None):
    st.session_state["page"] = page
    if portfolio is not None:
        st.session_state["sel_portfolio"] = portfolio
    if symbol is not None:
        st.session_state["sel_symbol"] = symbol
    if segment is not None:
        st.session_state["sel_segment"] = segment
    elif page in ("portfolios", "holdings", "summary"):
        st.session_state.pop("sel_segment", None)
    for _k in ("h_sel", "seg_cum_sel", "seg_std_sel"):
        st.session_state.pop(_k, None)
    try:
        params = {"page": page}
        if portfolio:
            params["portfolio"] = portfolio
        if symbol:
            params["symbol"] = symbol
        st.query_params.update(params)
    except Exception:
        pass
    st.rerun()


def go_back():
    page = get_page()
    if page == "transactions":
        seg = st.session_state.get("sel_segment")
        if seg:
            navigate("holdings", segment=seg)
        else:
            navigate("holdings", portfolio=st.session_state.get("sel_portfolio"))
    else:
        navigate("portfolios")


def sel_portfolio() -> str:
    return st.session_state.get("sel_portfolio", "")


def sel_symbol() -> str:
    return st.session_state.get("sel_symbol", "")


def sel_segment() -> str:
    return st.session_state.get("sel_segment", "")


def do_refresh():
    from src.cache import Cache
    c = Cache()
    c.invalidate("prices")
    c.invalidate("fx")
    st.cache_data.clear()
    st.rerun()
