"""
Data Entry View: Frictionless balance entry, stock holdings snapshots, and transaction management.
"""
import datetime
import io
import csv
import pandas as pd
import streamlit as st
from app.database import get_db
from app.price_service import lookup_cached_price, startup_price_sync
from frontend.utils.formatters import format_currency

def render_data_entry():
    with get_db(is_write=False) as conn:
        accounts = conn.execute(
            "SELECT id, name, type, institution FROM accounts WHERE is_active = 1 ORDER BY type ASC, name ASC"
        ).fetchall()

    if not accounts:
        st.warning("No active accounts found. Please add an account in the Account Manager tab first.")
        return

    # Select Account
    acc_options = {a["id"]: f"{a['name']} ({a['institution']} - {a['type']})" for a in accounts}
    default_id = st.session_state.get("target_account_id", accounts[0]["id"])
    if default_id not in acc_options:
        default_id = accounts[0]["id"]

    selected_acc_id = st.selectbox(
        "Select Account",
        options=list(acc_options.keys()),
        format_func=lambda x: acc_options[x],
        index=list(acc_options.keys()).index(default_id)
    )
    # Clear after selection so it doesn't get stuck
    if "target_account_id" in st.session_state:
        del st.session_state["target_account_id"]

    account = next((a for a in accounts if a["id"] == selected_acc_id), None)
    if not account:
        return

    acc_type = account["type"]

    tab1, tab2 = st.tabs(["📝 Record Balance / Holdings", "💳 Transactions & CSV Import"])

    # =========================================================================
    # TAB 1: BALANCE / HOLDINGS ENTRY
    # =========================================================================
    with tab1:
        if acc_type in ("CASH", "CREDIT"):
            # Fetch latest snapshot for pre-filling
            with get_db(is_write=False) as conn:
                latest = conn.execute(
                    "SELECT as_of_date, balance, note FROM balance_snapshots WHERE account_id = ? ORDER BY as_of_date DESC LIMIT 1",
                    (selected_acc_id,)
                ).fetchone()

            prev_balance = float(latest["balance"]) if latest else 0.0
            prev_date = latest["as_of_date"] if latest else "None"

            c_info1, c_info2 = st.columns(2)
            with c_info1:
                st.info(f"**Latest Known Balance:** `{format_currency(prev_balance, 2)}` (as of {prev_date})")
            with c_info2:
                if acc_type == "CREDIT":
                    st.caption("ℹ️ For credit cards, enter current balance as a positive number (e.g. `$450.00` owed). It is automatically treated as a liability.")

            with st.form("form_balance_entry"):
                col_date, col_bal = st.columns([1, 2])
                with col_date:
                    as_of_date = st.date_input("As of Date", value=datetime.date.today())
                with col_bal:
                    bal_val = abs(prev_balance) if acc_type == "CREDIT" else prev_balance
                    balance_input = st.number_input(
                        "Account Balance ($)",
                        value=float(bal_val),
                        step=50.0,
                        format="%.2f"
                    )

                note_input = st.text_input("Memo / Note (optional)", placeholder="e.g. End of month statement")
                submitted = st.form_submit_button("💾 Save Balance Snapshot", use_container_width=True)

                if submitted:
                    final_bal = -abs(balance_input) if acc_type == "CREDIT" else balance_input
                    with get_db(is_write=True) as conn:
                        conn.execute("""
                            INSERT INTO balance_snapshots (account_id, as_of_date, balance, note)
                            VALUES (?, ?, ?, ?)
                            ON CONFLICT(account_id, as_of_date)
                            DO UPDATE SET balance = excluded.balance, note = excluded.note
                        """, (selected_acc_id, as_of_date.isoformat(), final_bal, note_input))

                    st.toast(f"Balance recorded for {account['name']} on {as_of_date.isoformat()}!", icon="✅")
                    st.rerun()

            # Snapshot History for this account
            st.markdown("#### 📜 Snapshot History")
            with get_db(is_write=False) as conn:
                snaps = conn.execute(
                    "SELECT id, as_of_date, balance, note FROM balance_snapshots WHERE account_id = ? ORDER BY as_of_date DESC LIMIT 50",
                    (selected_acc_id,)
                ).fetchall()

            if snaps:
                snap_df = pd.DataFrame([
                    {
                        "ID": s["id"],
                        "Date": s["as_of_date"],
                        "Balance": format_currency(s["balance"], 2),
                        "Note": s["note"] or ""
                    }
                    for s in snaps
                ])
                st.dataframe(snap_df, use_container_width=True, hide_index=True)
            else:
                st.caption("No snapshots recorded yet.")

        elif acc_type == "BROKERAGE":
            st.markdown(f"### 📈 Holdings Snapshot for {account['name']}")
            
            # Fetch latest holdings
            with get_db(is_write=False) as conn:
                latest_holdings = conn.execute("""
                    SELECT asset_type, ticker, shares 
                    FROM brokerage_holdings 
                    WHERE account_id = ? AND as_of_date = (
                        SELECT MAX(as_of_date) FROM brokerage_holdings WHERE account_id = ?
                    )
                    ORDER BY asset_type DESC, ticker ASC
                """, (selected_acc_id, selected_acc_id)).fetchall()

            # Display current holdings overview
            today_iso = datetime.date.today().isoformat()
            if latest_holdings:
                st.markdown("##### Current Portfolio Breakdown")
                portfolio_rows = []
                total_val = 0.0
                for h in latest_holdings:
                    t = h["ticker"].upper()
                    sh = float(h["shares"])
                    pr = 1.0 if (h["asset_type"] == "CASH" or t == "CASH") else lookup_cached_price(t, today_iso)
                    mv = sh * pr
                    total_val += mv
                    portfolio_rows.append({
                        "Type": h["asset_type"],
                        "Ticker": t,
                        "Shares": f"{sh:,.4f}",
                        "Price": format_currency(pr, 2),
                        "Market Value": format_currency(mv, 2)
                    })
                st.dataframe(pd.DataFrame(portfolio_rows), use_container_width=True, hide_index=True)
                st.markdown(f"**Total Portfolio Value:** `{format_currency(total_val, 2)}`")

            st.markdown("---")
            st.markdown("##### Record New Holdings Snapshot")
            holdings_date = st.date_input("Holdings Date", value=datetime.date.today(), key="brok_date")

            # Setup state for editable rows
            state_key = f"holdings_list_{selected_acc_id}"
            if state_key not in st.session_state:
                if latest_holdings:
                    st.session_state[state_key] = [
                        {"ticker": h["ticker"], "shares": float(h["shares"]), "type": h["asset_type"]}
                        for h in latest_holdings
                    ]
                else:
                    st.session_state[state_key] = [
                        {"ticker": "CASH", "shares": 1000.0, "type": "CASH"},
                        {"ticker": "VTI", "shares": 10.0, "type": "EQUITY"}
                    ]

            # Render editable table
            holdings_items = st.session_state[state_key]
            
            # Row controls
            cols_h = st.columns([2, 1, 2, 1])
            with cols_h[0]:
                st.caption("Ticker (e.g. VOO, AAPL, CASH)")
            with cols_h[1]:
                st.caption("Asset Type")
            with cols_h[2]:
                st.caption("Shares Count")
            with cols_h[3]:
                st.caption("Action")

            rows_to_remove = []
            for idx, item in enumerate(holdings_items):
                r1, r2, r3, r4 = st.columns([2, 1, 2, 1])
                with r1:
                    item["ticker"] = st.text_input(
                        f"Ticker #{idx}",
                        value=item["ticker"],
                        key=f"t_{selected_acc_id}_{idx}",
                        label_visibility="collapsed"
                    ).upper().strip()
                with r2:
                    item["type"] = st.selectbox(
                        f"Type #{idx}",
                        options=["EQUITY", "CASH"],
                        index=0 if item.get("type", "EQUITY") == "EQUITY" else 1,
                        key=f"type_{selected_acc_id}_{idx}",
                        label_visibility="collapsed"
                    )
                with r3:
                    item["shares"] = st.number_input(
                        f"Shares #{idx}",
                        value=float(item["shares"]),
                        step=1.0,
                        format="%.4f",
                        key=f"sh_{selected_acc_id}_{idx}",
                        label_visibility="collapsed"
                    )
                with r4:
                    if st.button("❌", key=f"del_{selected_acc_id}_{idx}", help="Remove holding"):
                        rows_to_remove.append(idx)

            if rows_to_remove:
                for idx in sorted(rows_to_remove, reverse=True):
                    holdings_items.pop(idx)
                st.rerun()

            btn_col1, btn_col2 = st.columns([1, 2])
            with btn_col1:
                if st.button("➕ Add Ticker Row"):
                    holdings_items.append({"ticker": "", "shares": 0.0, "type": "EQUITY"})
                    st.rerun()

            with btn_col2:
                if st.button("💾 Save Holdings Snapshot", type="primary", use_container_width=True):
                    clean_items = [h for h in holdings_items if h["ticker"] and h["shares"] >= 0]
                    if not clean_items:
                        st.error("Please add at least one holding with a ticker and share count.")
                    else:
                        with get_db(is_write=True) as conn:
                            # Delete existing for this date if overwriting
                            conn.execute(
                                "DELETE FROM brokerage_holdings WHERE account_id = ? AND as_of_date = ?",
                                (selected_acc_id, holdings_date.isoformat())
                            )
                            for it in clean_items:
                                t_name = it["ticker"].upper()
                                a_type = "CASH" if t_name == "CASH" else it["type"]
                                conn.execute("""
                                    INSERT INTO brokerage_holdings (account_id, as_of_date, asset_type, ticker, shares)
                                    VALUES (?, ?, ?, ?, ?)
                                """, (selected_acc_id, holdings_date.isoformat(), a_type, t_name, it["shares"]))

                        st.toast(f"Holdings snapshot saved for {holdings_date.isoformat()}!", icon="✅")
                        st.rerun()

    # =========================================================================
    # TAB 2: TRANSACTIONS & CSV IMPORT
    # =========================================================================
    with tab2:
        st.markdown(f"### 💳 Transactions for {account['name']}")

        col_t1, col_t2 = st.columns([1, 1])

        with col_t1:
            st.markdown("#### ➕ Record Manual Transaction")
            with st.form("form_add_transaction"):
                tx_date = st.date_input("Date", value=datetime.date.today(), key="tx_date_input")
                tx_merchant = st.text_input("Merchant / Description", placeholder="e.g. Trader Joe's, Salary, Rent")
                tx_amount = st.number_input(
                    "Amount ($) (negative = spending, positive = income)",
                    value=-50.0,
                    step=10.0,
                    format="%.2f"
                )
                tx_category = st.selectbox(
                    "Category",
                    options=[
                        "Income", "Groceries", "Dining & Restaurants", "Shopping",
                        "Housing & Rent", "Utilities", "Transportation", "Entertainment",
                        "Healthcare", "Investments", "Transfer", "Other"
                    ]
                )
                tx_is_transfer = st.checkbox("Is Transfer between accounts?")
                tx_note = st.text_input("Note (optional)", placeholder="Optional memo")

                tx_submit = st.form_submit_button("Record Transaction", use_container_width=True)
                if tx_submit:
                    if not tx_merchant:
                        st.error("Please enter a merchant or description.")
                    else:
                        with get_db(is_write=True) as conn:
                            conn.execute("""
                                INSERT INTO transactions (account_id, date, merchant, amount, category, is_transfer, note)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            """, (
                                selected_acc_id,
                                tx_date.isoformat(),
                                tx_merchant,
                                tx_amount,
                                tx_category,
                                1 if tx_is_transfer else 0,
                                tx_note
                            ))
                        st.toast("Transaction recorded successfully!", icon="✅")
                        st.rerun()

        with col_t2:
            st.markdown("#### 📥 Import Bank CSV Statement")
            uploaded_file = st.file_uploader(
                "Upload Bank / Credit Card CSV",
                type=["csv"],
                help="Accepts CSV exports from Chase, Marcus, Vanguard, Bank of America, Fidelity, etc."
            )

            if uploaded_file is not None:
                try:
                    df = pd.read_csv(uploaded_file)
                    st.caption(f"Loaded {len(df)} rows. Map columns below:")
                    
                    cols = list(df.columns)
                    c_date = st.selectbox("Date Column", options=cols, index=0)
                    
                    # Try smart default for merchant/description
                    desc_idx = next((i for i, c in enumerate(cols) if any(k in c.lower() for k in ["desc", "name", "merchant", "payee"])), 1 if len(cols) > 1 else 0)
                    c_desc = st.selectbox("Description / Merchant Column", options=cols, index=desc_idx)

                    # Try smart default for amount
                    amt_idx = next((i for i, c in enumerate(cols) if "amount" in c.lower()), 2 if len(cols) > 2 else 0)
                    c_amt = st.selectbox("Amount Column", options=cols, index=amt_idx)

                    if st.button("🚀 Import Into SQLite", type="primary", use_container_width=True):
                        imported_count = 0
                        with get_db(is_write=True) as conn:
                            for _, row in df.iterrows():
                                try:
                                    raw_date = str(row[c_date]).strip()
                                    parsed_date = pd.to_datetime(raw_date).strftime("%Y-%m-%d")
                                    desc = str(row[c_desc]).strip()
                                    # Clean amount
                                    raw_amt = str(row[c_amt]).replace("$", "").replace(",", "").strip()
                                    amt_float = float(raw_amt)

                                    conn.execute("""
                                        INSERT INTO transactions (account_id, date, merchant, amount, category, is_transfer, note)
                                        VALUES (?, ?, ?, ?, 'Imported', 0, 'CSV Import')
                                    """, (selected_acc_id, parsed_date, desc, amt_float))
                                    imported_count += 1
                                except Exception:
                                    continue

                        st.toast(f"Successfully imported {imported_count} transactions!", icon="✅")
                        st.rerun()

                except Exception as e:
                    st.error(f"Error parsing CSV: {e}")

        st.markdown("---")
        st.markdown("#### 📋 Recent Transactions")
        search_query = st.text_input("🔍 Search transactions", placeholder="Filter by merchant or note...")

        with get_db(is_write=False) as conn:
            query = "SELECT id, date, merchant, amount, category, is_transfer, note FROM transactions WHERE account_id = ?"
            params = [selected_acc_id]
            if search_query:
                query += " AND (merchant LIKE ? OR note LIKE ?)"
                params.extend([f"%{search_query}%", f"%{search_query}%"])
            query += " ORDER BY date DESC, id DESC LIMIT 100"

            tx_rows = conn.execute(query, params).fetchall()

        if tx_rows:
            tx_data = []
            for r in tx_rows:
                tx_data.append({
                    "Date": r["date"],
                    "Merchant": r["merchant"],
                    "Amount": format_currency(r["amount"], 2),
                    "Category": r["category"] or "Uncategorized",
                    "Transfer?": "Yes" if r["is_transfer"] else "No",
                    "Note": r["note"] or ""
                })
            st.dataframe(pd.DataFrame(tx_data), use_container_width=True, hide_index=True)
        else:
            st.caption("No transactions found for this account.")
