"""
Backups & Database View: Storage health, automated WAL snapshot management, and disaster recovery.
"""
import os
import shutil
from pathlib import Path
import pandas as pd
import streamlit as st
from app.config import DB_PATH, BACKUP_DIR, MAX_BACKUPS
from app.database import get_db, init_db
from app.backup_service import create_backup, list_backups, restore_backup
from app.price_service import ensure_cash_price
from backend.seed_demo_data import seed_demo_data
from frontend.utils.formatters import format_currency

def render_backups():
    st.markdown("### 💾 Database & Backup Center")

    # 1. System Health Status Card
    c1, c2, c3, c4 = st.columns(4)

    # Check live WAL mode
    with get_db(is_write=False) as conn:
        wal_mode = conn.execute("PRAGMA journal_mode;").fetchone()[0]
        acc_count = conn.execute("SELECT COUNT(*) FROM accounts").fetchone()[0]
        snap_count = conn.execute("SELECT COUNT(*) FROM balance_snapshots").fetchone()[0]
        tx_count = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]

    db_size = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0

    with c1:
        st.metric("Database Storage", f"{db_size / 1024:.1f} KB", "SQLite WAL")
    with c2:
        st.metric("Journal Mode", wal_mode.upper(), "High Concurrency")
    with c3:
        st.metric("Total Accounts", acc_count)
    with c4:
        st.metric("Total Snapshots / Txs", f"{snap_count} / {tx_count}")

    st.markdown("---")

    # Storage Paths Info
    st.markdown("##### 📁 Storage Locations")
    st.code(f"""Database File:    {DB_PATH}
Backups Directory: {BACKUP_DIR}
Retention Policy:  Keeps last {MAX_BACKUPS} automated pre-write snapshots""")

    st.markdown("---")

    # 2. Backup Actions
    col_act1, col_act2 = st.columns([1, 1])

    with col_act1:
        st.markdown("#### 🛡️ Manual Snapshot Backup")
        st.write("Trigger an instant timestamped snapshot of your SQLite database.")
        if st.button("💾 Create Backup Now", type="primary", use_container_width=True):
            bf = create_backup(force=True)
            if bf:
                st.toast(f"Created backup: {Path(bf).name}", icon="✅")
                st.rerun()
            else:
                st.error("Could not create backup.")

    with col_act2:
        st.markdown("#### 🌱 Demo Data Seeder")
        st.write("Populate realistic checking, savings, brokerage, and credit card accounts for testing.")
        if st.button("Seed Realistic Demo Data", use_container_width=True):
            try:
                seed_demo_data()
                st.toast("Seeded demo financial accounts!", icon="✅")
                st.rerun()
            except Exception as e:
                st.error(f"Seeder failed: {e}")

    st.markdown("---")

    # 3. Available Backups Table & Restore
    st.markdown("#### 📜 Available Backups")
    backups = list_backups()

    if not backups:
        st.info("No backups found yet. Backups are created automatically before any data change.")
    else:
        backup_df = pd.DataFrame([
            {
                "Filename": b["filename"],
                "Created At": b["created_at"],
                "Size (KB)": f"{b['size_bytes'] / 1024:.1f} KB",
                "Path": b["path"]
            }
            for b in backups
        ])
        st.dataframe(backup_df[["Filename", "Created At", "Size (KB)"]], use_container_width=True, hide_index=True)

        st.markdown("##### 🔄 Disaster Recovery / Restore")
        c_res1, c_res2 = st.columns([2, 1])
        with c_res1:
            restore_file = st.selectbox(
                "Select Backup Snapshot to Restore",
                options=[b["path"] for b in backups],
                format_func=lambda x: Path(x).name
            )
        with c_res2:
            st.write("")
            st.write("")
            if st.button("⚠️ Restore Selected Backup", type="secondary", use_container_width=True):
                success = restore_backup(restore_file)
                if success:
                    st.toast("Database restored successfully!", icon="✅")
                    st.rerun()
                else:
                    st.error("Failed to restore backup.")
