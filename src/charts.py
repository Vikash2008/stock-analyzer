import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

_PALETTE = px.colors.qualitative.Set3


def portfolio_allocation_pie(holdings: pd.DataFrame, value_col: str = "current_value") -> go.Figure:
    """Donut chart: portfolio allocation by stock."""
    df = holdings.dropna(subset=[value_col])
    df = df[df[value_col] > 0]
    fig = px.pie(
        df,
        names="symbol",
        values=value_col,
        title="Portfolio Allocation by Stock",
        color_discrete_sequence=_PALETTE,
        hole=0.38,
    )
    fig.update_traces(textposition="inside", textinfo="percent+label")
    fig.update_layout(showlegend=True)
    return fig


def sector_allocation_pie(holdings: pd.DataFrame, value_col: str = "current_value") -> go.Figure:
    """Donut chart: portfolio allocation by sector."""
    df = holdings.dropna(subset=[value_col, "sector"])
    df = df[df[value_col] > 0]
    sector_df = df.groupby("sector")[value_col].sum().reset_index()
    fig = px.pie(
        sector_df,
        names="sector",
        values=value_col,
        title="Sector-wise Allocation",
        color_discrete_sequence=_PALETTE,
        hole=0.38,
    )
    fig.update_traces(textposition="inside", textinfo="percent+label")
    return fig


def exchange_allocation_bar(holdings: pd.DataFrame, value_col: str = "current_value") -> go.Figure:
    """Bar chart: allocation by exchange (NSE / BSE / US)."""
    df = holdings.dropna(subset=[value_col])
    df = df[df[value_col] > 0]
    exc_df = df.groupby("exchange")[value_col].sum().reset_index()
    fig = px.bar(
        exc_df,
        x="exchange",
        y=value_col,
        title="Allocation by Exchange",
        color="exchange",
        color_discrete_sequence=_PALETTE,
        text_auto=".3s",
    )
    fig.update_layout(showlegend=False, xaxis_title="Exchange", yaxis_title="Value")
    return fig


def unrealized_pnl_bar(holdings: pd.DataFrame, pnl_col: str = "unrealized_pnl") -> go.Figure:
    """Horizontal bar chart: unrealized P&L per stock, green/red coloured."""
    df = holdings.dropna(subset=[pnl_col]).sort_values(pnl_col)
    fig = px.bar(
        df,
        x=pnl_col,
        y="symbol",
        orientation="h",
        color=pnl_col,
        color_continuous_scale=["#d62728", "#f7f7f7", "#2ca02c"],
        color_continuous_midpoint=0,
        title="Unrealized P&L by Stock",
        text_auto=".3s",
    )
    fig.update_layout(coloraxis_showscale=False, xaxis_title="P&L", yaxis_title="")
    return fig


def realized_pnl_bar(realized: pd.DataFrame, pnl_col: str = "realized_pnl") -> go.Figure:
    """Bar chart: realized P&L per stock (SELL events only)."""
    sells = realized[realized["type"] == "SELL"].copy() if "type" in realized.columns else realized.copy()
    if sells.empty:
        fig = go.Figure()
        fig.update_layout(title="No closed positions yet")
        return fig
    agg = sells.groupby("symbol")[pnl_col].sum().reset_index().sort_values(pnl_col)
    fig = px.bar(
        agg,
        x="symbol",
        y=pnl_col,
        color=pnl_col,
        color_continuous_scale=["#d62728", "#f7f7f7", "#2ca02c"],
        color_continuous_midpoint=0,
        title="Realized P&L by Stock",
        text_auto=".3s",
    )
    fig.update_layout(coloraxis_showscale=False, xaxis_title="Stock", yaxis_title="Realized P&L")
    return fig
