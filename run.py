"""
Finance Tracker - Master Application Launcher
Cross-platform entry point to run Finance Tracker cleanly in one command.
"""
import os
import sys
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_APP = ROOT_DIR / "frontend" / "app.py"

# Add paths to sys.path
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

def main():
    print("=" * 60)
    print("  💰 FINANCE TRACKER - LOCAL-FIRST NET WORTH MANAGER")
    print("=" * 60)
    print()

    # 1. Verify / Initialize Database
    try:
        from app.database import init_db
        from app.price_service import ensure_cash_price
        from app.config import DB_PATH
        print(f"[1/2] Initializing SQLite database (WAL Mode)...")
        init_db()
        ensure_cash_price()
        print(f"      -> Database verified at: {DB_PATH}")
    except Exception as e:
        print(f"[Warning] Database initialization error: {e}")

    # 2. Launch Streamlit Frontend
    print(f"[2/2] Launching Python Streamlit Interface...")
    print(f"      -> Opening browser to http://localhost:8501 ...")
    print()
    print("Press Ctrl+C in this terminal window to stop the application.")
    print("=" * 60)
    print()

    try:
        from streamlit.web import cli as stcli
        # On Linux server, default to headless=true so it doesn't fail trying to open a desktop browser
        is_headless = "true" if sys.platform.startswith("linux") else "false"
        sys.argv = [
            "streamlit",
            "run",
            str(FRONTEND_APP),
            "--server.address=0.0.0.0",
            "--server.port=8501",
            f"--server.headless={is_headless}",
            "--browser.gatherUsageStats=false",
            "--theme.base=light",
            "--theme.primaryColor=#0d9488",
            "--theme.backgroundColor=#ffffff",
            "--theme.secondaryBackgroundColor=#f8fafc"
        ]
        sys.exit(stcli.main())
    except ImportError:
        print("[Error] Streamlit is not installed in the current environment.")
        print("Please install requirements: pip install -r requirements.txt")
        sys.exit(1)

if __name__ == "__main__":
    main()
