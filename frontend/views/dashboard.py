"""
Dashboard View: High-level financial overview, interactive charts, and asset breakdown.
"""
import datetime
import streamlit as st
from app.engine import reconstruct_time_series
from app.database import get_db
from app.price_service import startup_price_sync
from frontend.utils.formatters import format_currency, format_percent, format_short_currency
from frontend.utils.charts import (
    create_net_worth_chart,
    create_asset_allocation_chart,
    create_attribution_chart
)

def render_dashboard():
    # 1. Controls Bar: Time Range & Metric Toggle
    c1, c2, c3 = st.columns([2, 1, 1])
    
    with c1:
        range_options = ["1M", "3M", "YTD", "1Y", "ALL", "Custom"]
        selected_range = st.segmented_control(
            "Time Range",
            options=range_options,
            default="3M",
            label_visibility="collapsed"
        ) if hasattr(st, "segmented_control") else st.radio(
            "Time Range",
            options=range_options,
            index=1,
            horizontal=True,
            label_visibility="collapsed"
        )
    
    start_date_str = None
    end_date_str = None
    if selected_range == "Custom":
        col_s, col_e = st.columns(2)
        with col_s:
            s_date = st.date_input("Start Date", value=datetime.date.today() - datetime.timedelta(days=90))
            start_date_str = s_date.isoformat()
        with col_e:
            e_date = st.date_input("End Date", value=datetime.date.today())
            end_date_str = e_date.isoformat()
        calc_range = "custom"
    else:
        calc_range = selected_range

    with c2:
        chart_metric = st.selectbox(
            "Chart Metric",
            options=["Net Worth", "Assets vs Liabilities"],
            index=0,
            label_visibility="collapsed"
        )

    with c3:
        if st.button("🔄 Sync Market Prices", help="Fetch latest ticker closing prices via yfinance"):
            with st.spinner("Syncing latest market prices..."):
                try:
                    startup_price_sync()
                    st.toast("Market prices updated successfully!", icon="✅")
                    st.rerun()
                except Exception as e:
                    st.warning(f"Price sync warning: {e}")

    # Fetch time-series analytics
    analytics = reconstruct_time_series(calc_range, start_date_str, end_date_str)
    summary = analytics.get("summary", {})
    daily_history = analytics.get("daily_history", [])
    attribution = analytics.get("attribution", {})
    accounts = analytics.get("accounts", [])

    current_nw = summary.get("current_net_worth", 0.0)
    start_nw = summary.get("start_net_worth", 0.0)
    chg_dollars = summary.get("period_change_dollars", 0.0)
    chg_pct = summary.get("period_change_percent", 0.0)
    total_assets = summary.get("total_assets", 0.0)
    total_liabilities = summary.get("total_liabilities", 0.0)
    asset_allocation = summary.get("asset_allocation", {})

    # 2. Key Metrics Row
    m1, m2, m3, m4 = st.columns(4)
    with m1:
        st.metric(
            label="Current Net Worth",
            value=format_currency(current_nw, 0),
            delta=f"{format_currency(chg_dollars, 0)} ({format_percent(chg_pct)})"
        )
    with m2:
        st.metric(
            label="Total Assets",
            value=format_currency(total_assets, 0)
        )
    with m3:
        st.metric(
            label="Total Liabilities",
            value=format_currency(total_liabilities, 0),
            delta="Debts / Balances",
            delta_color="inverse"
        )
    with m4:
        st.metric(
            label=f"Period Start ({calc_range})",
            value=format_currency(start_nw, 0),
            delta=f"{len(daily_history)} days calculated"
        )

    st.markdown("---")

    # 3. Main Interactive Chart
    metric_key = "net_worth" if chart_metric == "Net Worth" else "assets_liabilities"
    fig_nw = create_net_worth_chart(daily_history, metric=metric_key)
    st.plotly_chart(fig_nw, use_container_width=True)

    # 4. Middle Section: Asset Allocation & Mathematical Attribution
    col_alloc, col_attr = st.columns([1, 1])

    with col_alloc:
        st.subheader("🥧 Asset Allocation")
        fig_pie = create_asset_allocation_chart(asset_allocation)
        st.plotly_chart(fig_pie, use_container_width=True)

        cash_info = asset_allocation.get("cash", {})
        eq_info = asset_allocation.get("equities", {})
        debt_info = asset_allocation.get("debt", {})

        st.markdown(f"""
        - 🔵 **Cash & Savings:** `{format_currency(cash_info.get('amount', 0))}` ({cash_info.get('percent', 0):.1f}%)
        - 🟢 **Equities & Investments:** `{format_currency(eq_info.get('amount', 0))}` ({eq_info.get('percent', 0):.1f}%)
        - 🔴 **Credit & Liabilities:** `{format_currency(abs(debt_info.get('amount', 0)))}` ({debt_info.get('percent', 0):.1f}%)
        """)

    with col_attr:
        st.subheader("📐 Period Change Attribution")
        with st.expander("ℹ️ How Attribution Is Calculated", expanded=False):
            st.markdown("""
            Net worth movement is mathematically decomposed into 4 orthogonal drivers:
            - **Market Movement:** $S_0 \\cdot \\Delta P$ (price appreciation of held shares)
            - **Net Share Inflows:** $\\Delta S \\cdot P_1$ (added or sold shares)
            - **Cash Balance Flow:** $\\Delta \\text{Cash}$ (savings / checking drift)
            - **Credit Debt Changes:** $\\Delta \\text{Credit}$ (debt reduction / growth)
            """)

        fig_attr = create_attribution_chart(attribution)
        st.plotly_chart(fig_attr, use_container_width=True)

        mkt = attribution.get("market_movement_dollars", 0.0)
        inf = attribution.get("net_share_additions_dollars", 0.0)
        cfl = attribution.get("cash_flow_dollars", 0.0)
        crd = attribution.get("credit_debt_change_dollars", 0.0)

        st.caption(f"**Reconciled Period Change:** `{format_currency(chg_dollars)}` = Market `{format_currency(mkt)}` + Inflows `{format_currency(inf)}` + Cash `{format_currency(cfl)}` + Debt `{format_currency(crd)}`")

    st.markdown("---")

    # 5. Accounts Breakdown Section
    st.subheader("🏦 Accounts Breakdown")

    # Group accounts
    latest_acc_balances = daily_history[-1].get("account_balances", {}) if daily_history else {}
    cash_accs = [a for a in accounts if a["type"] == "CASH"]
    brok_accs = [a for a in accounts if a["type"] == "BROKERAGE"]
    cred_accs = [a for a in accounts if a["type"] == "CREDIT"]

    acc_tab1, acc_tab2, acc_tab3 = st.tabs([
        f"Cash Accounts ({len(cash_accs)})",
        f"Brokerage ({len(brok_accs)})",
        f"Credit Cards ({len(cred_accs)})"
    ])

    with acc_tab1:
        if not cash_accs:
            st.info("No cash accounts added yet. Add one in the Account Manager!")
        else:
            for a in cash_accs:
                bal = latest_acc_balances.get(a["id"], 0.0)
                ac1, ac2, ac3 = st.columns([3, 2, 2])
                with ac1:
                    st.markdown(f"**{a['name']}**  \n`{a['institution']}`")
                with ac2:
                    st.markdown(f"### {format_currency(bal, 2)}")
                with ac3:
                    if st.button("Update Balance", key=f"btn_cash_{a['id']}"):
                        st.session_state["nav_page"] = "✍️ Data Entry"
                        st.session_state["target_account_id"] = a["id"]
                        st.rerun()
                st.markdown("<hr style='margin: 4px 0;'/>", unsafe_allow_html=True)

    with acc_tab2:
        if not brok_accs:
            st.info("No brokerage accounts added yet.")
        else:
            for a in brok_accs:
                bal = latest_acc_balances.get(a["id"], 0.0)
                ac1, ac2, ac3 = st.columns([3, 2, 2])
                with ac1:
                    st.markdown(f"**{a['name']}**  \n`{a['institution']}`")
                with ac2:
                    st.markdown(f"### {format_currency(bal, 2)}")
                with ac3:
                    if st.button("Update Holdings", key=f"btn_brok_{a['id']}"):
                        st.session_state["nav_page"] = "✍️ Data Entry"
                        st.session_state["target_account_id"] = a["id"]
                        st.rerun()
                st.markdown("<hr style='margin: 4px 0;'/>", unsafe_allow_html=True)

    with acc_tab3:
        if not cred_accs:
            st.info("No credit accounts added yet.")
        else:
            for a in cred_accs:
                bal = latest_acc_balances.get(a["id"], 0.0)
                ac1, ac2, ac3 = st.columns([3, 2, 2])
                with ac1:
                    st.markdown(f"**{a['name']}**  \n`{a['institution']}`")
                with ac2:
                    st.markdown(f"<h3 style='color: #e11d48;'>{format_currency(bal, 2)}</h3>", unsafe_allow_html=True)
                with ac3:
                    if st.button("Update Balance", key=f"btn_cred_{a['id']}"):
                        st.session_state["nav_page"] = "✍️ Data Entry"
                        st.session_state["target_account_id"] = a["id"]
                        st.rerun()
                st.markdown("<hr style='margin: 4px 0;'/>", unsafe_allow_html=True)
