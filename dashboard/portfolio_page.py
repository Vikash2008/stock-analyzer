import streamlit as st

from dashboard.metrics import render as metrics_render
from src.engine import PortfolioBundle


def render(bundle: PortfolioBundle) -> None:
    if bundle.holdings.empty:
        st.info("No holdings data.")
        return

    metrics_render(bundle)
