"""
Interactive Plotly chart builders for Finance Tracker.
"""
from typing import List, Dict, Any
import pandas as pd
import plotly.graph_objects as go
from .formatters import format_currency

def create_net_worth_chart(daily_history: List[Dict[str, Any]], metric: str = "net_worth") -> go.Figure:
    if not daily_history:
        fig = go.Figure()
        fig.add_annotation(text="No historical data available for selected range", showarrow=False)
        fig.update_layout(height=350, margin=dict(l=20, r=20, t=20, b=20))
        return fig

    df = pd.DataFrame(daily_history)
    df["date"] = pd.to_datetime(df["date"])

    fig = go.Figure()

    if metric == "net_worth":
        fig.add_trace(go.Scatter(
            x=df["date"],
            y=df["net_worth"],
            mode="lines",
            name="Net Worth",
            line=dict(color="#0d9488", width=3, shape="spline"),
            fill="tozeroy",
            fillcolor="rgba(13, 148, 136, 0.12)",
            hovertemplate="<b>%{x|%b %d, %Y}</b><br>Net Worth: <b>$%{y:,.2f}</b><extra></extra>"
        ))
    else:
        fig.add_trace(go.Scatter(
            x=df["date"],
            y=df["total_assets"],
            mode="lines",
            name="Total Assets",
            line=dict(color="#10b981", width=2.5, shape="spline"),
            hovertemplate="<b>%{x|%b %d, %Y}</b><br>Assets: <b>$%{y:,.2f}</b><extra></extra>"
        ))
        fig.add_trace(go.Scatter(
            x=df["date"],
            y=df["total_liabilities"],
            mode="lines",
            name="Total Liabilities",
            line=dict(color="#f43f5e", width=2.5, shape="spline"),
            hovertemplate="<b>%{x|%b %d, %Y}</b><br>Liabilities: <b>$%{y:,.2f}</b><extra></extra>"
        ))

    fig.update_layout(
        height=380,
        margin=dict(l=10, r=10, t=20, b=20),
        hovermode="x unified",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        xaxis=dict(
            showgrid=True,
            gridcolor="rgba(148, 163, 184, 0.15)",
            tickformat="%b %d",
            zeroline=False
        ),
        yaxis=dict(
            showgrid=True,
            gridcolor="rgba(148, 163, 184, 0.15)",
            tickprefix="$",
            zeroline=False
        ),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)"
    )
    return fig

def create_asset_allocation_chart(asset_allocation: Dict[str, Any]) -> go.Figure:
    cash_amt = asset_allocation.get("cash", {}).get("amount", 0)
    eq_amt = asset_allocation.get("equities", {}).get("amount", 0)
    debt_amt = abs(asset_allocation.get("debt", {}).get("amount", 0))

    labels = ["Cash & Equivalents", "Equities & Investments", "Credit & Liabilities"]
    values = [cash_amt, eq_amt, debt_amt]
    colors = ["#0284c7", "#0d9488", "#e11d48"]

    # Filter out zeros for cleaner chart
    filtered_labels = [l for l, v in zip(labels, values) if v > 0]
    filtered_values = [v for v in values if v > 0]
    filtered_colors = [c for c, v in zip(colors, values) if v > 0]

    if not filtered_values:
        fig = go.Figure()
        fig.add_annotation(text="No asset allocation data", showarrow=False)
        fig.update_layout(height=260, margin=dict(l=10, r=10, t=10, b=10))
        return fig

    fig = go.Figure(data=[go.Pie(
        labels=filtered_labels,
        values=filtered_values,
        hole=0.62,
        marker=dict(colors=filtered_colors),
        textinfo="percent+label",
        hovertemplate="<b>%{label}</b><br>Value: <b>$%{value:,.2f}</b><br>Share: <b>%{percent}</b><extra></extra>"
    )])

    fig.update_layout(
        height=260,
        margin=dict(l=10, r=10, t=10, b=10),
        showlegend=False,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)"
    )
    return fig

def create_attribution_chart(attribution: Dict[str, Any]) -> go.Figure:
    components = [
        ("Market Growth", attribution.get("market_movement_dollars", 0)),
        ("Net Additions / Inflows", attribution.get("net_share_additions_dollars", 0)),
        ("Cash Savings Flow", attribution.get("cash_flow_dollars", 0)),
        ("Credit Debt Reduction", attribution.get("credit_debt_change_dollars", 0)),
    ]

    labels = [c[0] for c in components]
    values = [c[1] for c in components]
    colors = ["#10b981" if v >= 0 else "#f43f5e" for v in values]

    fig = go.Figure(data=[go.Bar(
        x=values,
        y=labels,
        orientation="h",
        marker=dict(color=colors),
        hovertemplate="<b>%{y}</b><br>Impact: <b>$%{x:,.2f}</b><extra></extra>"
    )])

    fig.update_layout(
        height=240,
        margin=dict(l=10, r=20, t=10, b=20),
        xaxis=dict(
            showgrid=True,
            gridcolor="rgba(148, 163, 184, 0.15)",
            tickprefix="$",
            zeroline=True,
            zerolinecolor="rgba(148, 163, 184, 0.4)"
        ),
        yaxis=dict(autorange="reversed"),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)"
    )
    return fig

def create_account_history_chart(dates: List[str], balances: List[float], account_name: str, color: str = "#0d9488") -> go.Figure:
    if not dates:
        fig = go.Figure()
        fig.add_annotation(text="No snapshot history recorded for this account", showarrow=False)
        fig.update_layout(height=280, margin=dict(l=10, r=10, t=10, b=10))
        return fig

    fig = go.Figure(data=[go.Scatter(
        x=pd.to_datetime(dates),
        y=balances,
        mode="lines+markers",
        name=account_name,
        line=dict(color=color, width=2.5, shape="spline"),
        marker=dict(size=6),
        fill="tozeroy",
        fillcolor=f"rgba(13, 148, 136, 0.1)",
        hovertemplate="<b>%{x|%b %d, %Y}</b><br>Balance: <b>$%{y:,.2f}</b><extra></extra>"
    )])

    fig.update_layout(
        height=280,
        margin=dict(l=10, r=10, t=20, b=20),
        hovermode="x unified",
        xaxis=dict(showgrid=True, gridcolor="rgba(148, 163, 184, 0.15)", tickformat="%b %d"),
        yaxis=dict(showgrid=True, gridcolor="rgba(148, 163, 184, 0.15)", tickprefix="$"),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)"
    )
    return fig
