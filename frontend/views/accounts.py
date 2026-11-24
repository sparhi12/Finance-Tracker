"""
Account Manager View: Add, edit, manage accounts, and view detailed account performance.
"""
import datetime
import pandas as pd
import streamlit as st
from app.database import get_db
from app.engine import get_account_detail_analytics
from frontend.utils.formatters import format_currency, format_percent
from frontend.utils.charts import create_account_history_chart

def render_accounts():
    tab_list, tab_add, tab_detail = st.tabs(["📋 Accounts Overview", "➕ Add New Account", "🔍 Account Drilldown"])

    # =========================================================================
    # TAB 1: ACCOUNTS OVERVIEW
    # =========================================================================
    with tab_list:
        with get_db(is_write=False) as conn:
            accounts = conn.execute(
                "SELECT id, name, type, institution, is_active, created_at FROM accounts ORDER BY type ASC, name ASC"
            ).fetchall()

            # Latest cash/credit snapshot balances
            snap_rows = conn.execute("""
                SELECT bs.account_id, bs.balance, bs.as_of_date
                FROM balance_snapshots bs
                JOIN (
                    SELECT account_id, MAX(as_of_date) as max_date
                    FROM balance_snapshots
                    GROUP BY account_id
                ) latest ON bs.account_id = latest.account_id AND bs.as_of_date = latest.max_date
            """).fetchall()
            snap_map = {r["account_id"]: (float(r["balance"]), r["as_of_date"]) for r in snap_rows}

            # Brokerage holdings sum
            brok_rows = conn.execute("""
                SELECT bh.account_id, bh.as_of_date, bh.asset_type, bh.ticker, bh.shares
                FROM brokerage_holdings bh
                JOIN (
                    SELECT account_id, MAX(as_of_date) as max_date
                    FROM brokerage_holdings
                    GROUP BY account_id
                ) latest ON bh.account_id = latest.account_id AND bh.as_of_date = latest.max_date
            """).fetchall()

            # Cached prices for brokerage calculations
            from app.engine import get_price_map, lookup_forward_filled_price
            today_iso = datetime.date.today().isoformat()
            tickers = {h["ticker"].upper() for h in brok_rows if h["asset_type"] == "EQUITY" and h["ticker"] != "CASH"}
            price_map = get_price_map(list(tickers), today_iso)

            brok_totals = {}
            for h in brok_rows:
                acc_id = h["account_id"]
                t = h["ticker"].upper()
                sh = float(h["shares"])
                val = sh if (h["asset_type"] == "CASH" or t == "CASH") else sh * lookup_forward_filled_price(t, today_iso, price_map.get(t, {}))
                brok_totals[acc_id] = brok_totals.get(acc_id, 0.0) + val

        if not accounts:
            st.info("No accounts found. Use the 'Add New Account' tab to get started!")
            return

        acc_display = []
        for a in accounts:
            a_id = a["id"]
            a_type = a["type"]
            bal = 0.0
            if a_type in ("CASH", "CREDIT"):
                bal = snap_map.get(a_id, (0.0, None))[0]
            elif a_type == "BROKERAGE":
                bal = brok_totals.get(a_id, 0.0)

            acc_display.append({
                "ID": a_id,
                "Name": a["name"],
                "Type": a_type,
                "Institution": a["institution"],
                "Current Balance": format_currency(bal, 2),
                "Status": "Active" if a["is_active"] else "Inactive",
                "Created": a["created_at"]
            })

        st.dataframe(pd.DataFrame(acc_display), use_container_width=True, hide_index=True)

        st.markdown("---")
        st.markdown("#### ⚙️ Quick Actions")
        c_sel, c_act = st.columns([2, 1])
        with c_sel:
            edit_acc_id = st.selectbox(
                "Select Account to Manage",
                options=[a["id"] for a in accounts],
                format_func=lambda x: next(f"{a['name']} ({a['institution']})" for a in accounts if a["id"] == x)
            )
        
        target_acc = next(a for a in accounts if a["id"] == edit_acc_id)

        with c_act:
            st.write("")
            st.write("")
            col_tgl, col_del = st.columns(2)
            with col_tgl:
                new_status = 0 if target_acc["is_active"] else 1
                label = "Deactivate" if target_acc["is_active"] else "Activate"
                if st.button(label, use_container_width=True):
                    with get_db(is_write=True) as conn:
                        conn.execute("UPDATE accounts SET is_active = ? WHERE id = ?", (new_status, edit_acc_id))
                    st.toast(f"Account {label.lower()}d!", icon="ℹ️")
                    st.rerun()

            with col_del:
                if st.button("🗑️ Delete", type="secondary", use_container_width=True):
                    with get_db(is_write=True) as conn:
                        conn.execute("DELETE FROM accounts WHERE id = ?", (edit_acc_id,))
                    st.toast("Account deleted.", icon="🗑️")
                    st.rerun()

    # =========================================================================
    # TAB 2: ADD NEW ACCOUNT
    # =========================================================================
    with tab_add:
        st.markdown("### ➕ Add a New Account")
        with st.form("form_create_account"):
            col_name, col_type = st.columns([2, 1])
            with col_name:
                acc_name = st.text_input("Account Name", placeholder="e.g. Primary Checking, Roth IRA, Sapphire Preferred")
            with col_type:
                acc_type = st.selectbox("Account Type", options=["CASH", "BROKERAGE", "CREDIT"])

            acc_institution = st.text_input("Financial Institution", placeholder="e.g. Chase Bank, Vanguard, Marcus, Fidelity")
            
            st.markdown("##### Initial Balance (Optional)")
            col_init_bal, col_init_date = st.columns(2)
            with col_init_bal:
                init_balance = st.number_input(
                    "Initial Balance ($)",
                    value=0.0,
                    step=100.0,
                    format="%.2f",
                    help="For credit accounts, enter positive balance owed."
                )
            with col_init_date:
                init_date = st.date_input("Initial Date", value=datetime.date.today())

            submit_btn = st.form_submit_button("Create Account", type="primary", use_container_width=True)

            if submit_btn:
                if not acc_name or not acc_institution:
                    st.error("Please enter both an account name and institution.")
                else:
                    today_iso = datetime.date.today().isoformat()
                    with get_db(is_write=True) as conn:
                        cursor = conn.cursor()
                        cursor.execute("""
                            INSERT INTO accounts (name, type, institution, is_active, created_at)
                            VALUES (?, ?, ?, 1, ?)
                        """, (acc_name, acc_type, acc_institution, today_iso))
                        new_id = cursor.lastrowid

                        # Create initial snapshot if provided
                        if init_balance > 0 or init_balance < 0:
                            if acc_type in ("CASH", "CREDIT"):
                                final_bal = -abs(init_balance) if acc_type == "CREDIT" else init_balance
                                cursor.execute("""
                                    INSERT INTO balance_snapshots (account_id, as_of_date, balance, note)
                                    VALUES (?, ?, ?, 'Initial balance setup')
                                """, (new_id, init_date.isoformat(), final_bal))
                            elif acc_type == "BROKERAGE":
                                cursor.execute("""
                                    INSERT INTO brokerage_holdings (account_id, as_of_date, asset_type, ticker, shares)
                                    VALUES (?, ?, 'CASH', 'CASH', ?)
                                """, (new_id, init_date.isoformat(), init_balance))

                    st.toast(f"Created account '{acc_name}'!", icon="✅")
                    st.session_state["nav_page"] = "✍️ Data Entry"
                    st.session_state["target_account_id"] = new_id
                    st.rerun()

    # =========================================================================
    # TAB 3: ACCOUNT DRILLDOWN
    # =========================================================================
    with tab_detail:
        if not accounts:
            st.info("No accounts available.")
            return

        detail_acc_id = st.selectbox(
            "Select Account to Inspect",
            options=[a["id"] for a in accounts],
            format_func=lambda x: next(f"{a['name']} ({a['institution']})" for a in accounts if a["id"] == x),
            key="drilldown_acc_select"
        )
        
        detail_acc = next(a for a in accounts if a["id"] == detail_acc_id)
        
        col_rg, _ = st.columns([2, 2])
        with col_rg:
            d_range = st.segmented_control(
                "Range",
                options=["1M", "3M", "YTD", "1Y", "ALL"],
                default="3M",
                key="drill_range"
            ) if hasattr(st, "segmented_control") else st.radio(
                "Range",
                options=["1M", "3M", "YTD", "1Y", "ALL"],
                index=1,
                horizontal=True,
                key="drill_range"
            )

        try:
            detail_data = get_account_detail_analytics(detail_acc_id, d_range)
            acc_info = detail_data.get("account", {})
            curr_b = detail_data.get("current_balance", 0.0)
            start_b = detail_data.get("start_balance", 0.0)
            chg_b = detail_data.get("period_change_dollars", 0.0)
            chg_p = detail_data.get("period_change_percent", 0.0)

            c1, c2, c3 = st.columns(3)
            with c1:
                st.metric("Current Valuation", format_currency(curr_b, 2), f"{format_currency(chg_b, 2)} ({format_percent(chg_p)})")
            with c2:
                st.metric("Period Starting Balance", format_currency(start_b, 2))
            with c3:
                st.metric("Account Type", acc_info.get("type", "N/A"), acc_info.get("institution", "N/A"))

            # History Chart
            hist = detail_data.get("daily_history", [])
            dates = [d["date"] for d in hist]
            vals = [d["balance"] for d in hist]
            fig_hist = create_account_history_chart(dates, vals, acc_info.get("name", "Account"))
            st.plotly_chart(fig_hist, use_container_width=True)

            # Brokerage specific breakdown
            if acc_info.get("type") == "BROKERAGE":
                holdings = detail_data.get("holdings_breakdown", [])
                if holdings:
                    st.markdown("##### Portfolio Holdings & Asset Weights")
                    h_df = pd.DataFrame([
                        {
                            "Ticker": h["ticker"],
                            "Type": h["asset_type"],
                            "Shares": f"{h['shares']:,.4f}",
                            "Price": format_currency(h["price"], 2),
                            "Market Value": format_currency(h["market_value"], 2),
                            "Weight": f"{h['weight_percent']:.1f}%"
                        }
                        for h in holdings
                    ])
                    st.dataframe(h_df, use_container_width=True, hide_index=True)

        except Exception as e:
            st.warning(f"Could not load account details: {e}")
