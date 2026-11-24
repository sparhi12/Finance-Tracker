# 💰 Finance Tracker

A clean, responsive, 100% Python local-first and offline-capable personal finance tracker. Built with **Streamlit**, **Plotly**, and **SQLite with WAL mode**. Persists data locally (`D:\finance\` with automatic fallback to `./data/`), runs with zero cloud dependency, and requires **no Node.js or JavaScript build tools**.

---

## 🌟 Highlights & Architecture

- **100% Pure Python Stack:** No Node.js, no npm, no JavaScript build pipeline. The frontend is written in Streamlit with interactive Plotly charts, running seamlessly with the backend Python engine in a single process.
- **Local-First & Offline Capable:** Runs 100% locally on your machine with zero cloud dependency.
- **SQLite with WAL Mode (`D:\finance\finance.db` or `./data/finance.db`):** High-concurrency Write-Ahead Logging mode enabled. Auto-creates directories on first launch.
- **Automated Pre-Write Snapshots:** Automatically triggers database backups before mutating writes and CSV imports (`D:\finance\backups\finance_YYYY-MM-DD_HHMMSS.db`), retaining the last 30 backups with automatic pruning.
- **Cadence-Agnostic Time-Series Engine:** Forward-fills account balances and equity holdings across any date interval (`1M`, `3M`, `YTD`, `1Y`, `ALL`, or custom date ranges), with weekend and holiday market forward-filling.
- **Mathematical Period Change Attribution:** Exact decomposition of net worth movement into:
  - **Market Price Movement** ($S_0 \cdot \Delta P$)
  - **Net Share Additions / Inflows** ($\Delta S \cdot P_1$)
  - **Cash Balance Changes** ($\Delta \text{Cash}$)
  - **Credit Debt Changes** ($\Delta \text{Credit}$)
- **Frictionless Data Entry:** Review template pre-filled with your latest known account balances and ticker share counts. Defaults to today's date with editable date pickers.
- **Bank CSV Statement Import:** Upload and parse bank/credit card CSV exports directly into your local database.

---

## 🚀 Easy Access & One-Click Launch

### Option 1: Create a Desktop Icon (Easiest & Recommended)

#### Windows
1. Double-click `create_desktop_shortcut.bat` in the project folder.
2. A **Finance Tracker** shortcut with an icon will appear on your Desktop!
3. Double-click that desktop icon anytime to start the app and open your browser automatically.

#### macOS / Linux
1. Run `./create_desktop_shortcut.sh` in the terminal:
   ```bash
   ./create_desktop_shortcut.sh
   ```
2. A **Finance Tracker.command** launcher will appear on your Desktop! Double-click it anytime.

---

### Option 2: Run Directly from Folder

#### Windows
Double-click `run.bat` (or `start.bat`) in the project root.
- It will automatically set up the Python virtual environment, install requirements if needed, launch the app, and open your browser.

#### macOS / Linux
Run:
```bash
./run.sh
```

#### Any OS (Manual Python Command)
```bash
# 1. (Optional) Activate virtual environment
python -m venv venv
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Launch the application
python run.py
```
Your browser will automatically open to `http://localhost:8501`.

---

## 🔍 Why Did the Old Setup Show "No Connection"?

In the previous project configuration:
1. The frontend was built with Node.js/React/Vite (`port 5173`) and the backend was FastAPI (`port 8000`).
2. The launcher script ran with hidden window mode (`-WindowStyle Hidden`) and silenced errors (`$ErrorActionPreference = "SilentlyContinue"`).
3. If Node.js wasn't installed, npm failed, or dependencies were missing, both servers silently crashed in the background.
4. When Microsoft Edge was opened to `http://localhost:5173`, nothing was listening on that port, resulting in the **"Can't reach this page / connection refused"** error.

### How the New Version Fixes This:
- **Single Runtime:** Everything is 100% Python. There is no second server, no Node.js requirement, and no port mismatch.
- **Self-Healing Launcher:** `run.bat` and `run.sh` detect your Python environment, auto-create the virtual environment, install any missing dependencies, and launch the app in one smooth operation.
- **Visible Diagnostic Output:** If an issue ever occurs, the launcher displays clear, readable messages instead of silently vanishing.

---

## 📂 Configuration (`.env`)

Configure storage paths via the `.env` file in the root directory:
```ini
# Primary SQLite Database Path (default: D:\finance\finance.db)
DB_PATH=D:\finance\finance.db

# Automatic Backups Directory (default: D:\finance\backups)
BACKUP_DIR=D:\finance\backups

# Maximum backups retained (default: 30)
MAX_BACKUPS=30
```
*Note: If `D:\finance\` cannot be accessed (e.g. on a computer without a D: drive or on macOS/Linux), the application gracefully falls back to `./data/finance.db`.*

---

## 🧪 Testing

To run the comprehensive test suite verifying the database, WAL mode, time-series calculations, attribution reconciliation, and CSV imports:
```bash
python backend/test_app.py
```
