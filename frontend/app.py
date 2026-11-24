"""
Finance Tracker - Streamlit Application Entrypoint
100% Python Frontend for Local-First Personal Finance Tracking.
"""
import sys
from pathlib import Path

# Ensure project root and backend dir are in sys.path
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import streamlit as st
from app.database import init_db
from app.price_service import ensure_cash_price
from frontend.views.dashboard import render_dashboard
from frontend.views.data_entry import render_data_entry
from frontend.views.accounts import render_accounts
from frontend.views.backups import render_backups
from app.config import DB_PATH

# 1. Page Configuration
st.set_page_config(
    page_title="Finance Tracker",
    page_icon="💰",
    layout="wide",
    initial_sidebar_state="expanded"
)

# 2. Initialize Database & Cash Price
init_db()
ensure_cash_price()

# 3. Custom Modern CSS Styling
st.markdown("""
<style>
    /* Clean font styling */
    html, body, [class*="css"] {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    /* Top padding reduction */
    .block-container {
        padding-top: 1.8rem;
        padding-bottom: 2.5rem;
    }

    /* Metric cards styling */
    [data-testid="stMetric"] {
        background-color: rgba(248, 250, 252, 0.9);
        border: 1px solid rgba(226, 232, 240, 0.9);
        padding: 14px 18px;
        border-radius: 12px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }

    /* Sidebar tweaks */
    [data-testid="stSidebar"] {
        background-color: #f8fafc;
        border-right: 1px solid #e2e8f0;
    }

    /* Header title */
    .main-title {
        font-size: 1.7rem;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 0.2rem;
    }
    .sub-title {
        font-size: 0.9rem;
        color: #64748b;
        margin-bottom: 1.2rem;
    }
</style>
""", unsafe_allow_html=True)

# 4. Sidebar Navigation
with st.sidebar:
    st.markdown("## 💰 Finance Tracker")
    st.caption("Local-First Net Worth & Portfolio Manager")
    st.markdown("---")

    nav_options = [
        "📊 Dashboard",
        "✍️ Data Entry",
        "🏦 Account Manager",
        "💾 Backups & Database"
    ]

    # Handle programmatic tab switches
    default_index = 0
    if "nav_page" in st.session_state and st.session_state["nav_page"] in nav_options:
        default_index = nav_options.index(st.session_state["nav_page"])

    selected_page = st.radio(
        "Navigation",
        options=nav_options,
        index=default_index,
        label_visibility="collapsed"
    )

    st.markdown("---")
    st.caption("🔒 **Storage Engine**")
    st.caption(f"`{DB_PATH.name}` (SQLite WAL)")
    st.caption("Zero cloud dependency. Runs 100% offline.")

# Keep session state in sync
st.session_state["nav_page"] = selected_page

# 5. Route to Active View
if selected_page == "📊 Dashboard":
    render_dashboard()
elif selected_page == "✍️ Data Entry":
    render_data_entry()
elif selected_page == "🏦 Account Manager":
    render_accounts()
elif selected_page == "💾 Backups & Database":
    render_backups()
