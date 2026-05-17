import streamlit as st
from src.engine import PortfolioBundle


def render_sidebar(bundle: PortfolioBundle) -> tuple[list[str], str]:
    """
    Render sidebar filters. Returns (selected_portfolios, currency).
    Call this before build() to get filter values, or after to show them.
    """
    with st.sidebar:
        st.header("Filters")

        selected = st.multiselect(
            "Portfolio",
            options=bundle.all_portfolios,
            default=bundle.selected_portfolios,
        )

        currency = st.radio(
            "Display currency",
            ["INR", "USD"],
            horizontal=True,
        )

        st.caption(f"USD/INR: {bundle.usd_inr:.2f}")
        st.caption(f"Prices as of: {bundle.as_of.strftime('%d %b %Y %H:%M')}")

    return selected or bundle.all_portfolios, currency
