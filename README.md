# Finance Tracker

A clean, responsive, local-first and offline-capable personal finance web application. Runs locally on Windows (`localhost`), persists data to a secondary drive (`D:\finance\`), and can later be deployed to a Linux VM for mobile access without rewriting the frontend or API.

---

## 🌟 Highlights & Architecture

- **Local-First & Offline Capable:** Runs 100% locally on your machine with zero cloud dependency.
- **SQLite with WAL Mode (`D:\finance\finance.db`):** High-concurrency Write-Ahead Logging mode enabled. Auto-creates directories on first launch.
- **Automated Pre-Write Snapshots:** Automatically triggers database backups before mutating writes and CSV imports (`D:\finance\backups\finance_YYYY-MM-DD_HHMMSS.db`), retaining the last 30 backups with automatic pruning.
- **Cadence-Agnostic Time-Series Engine:** Forward-fills account balances and equity holdings across any date interval (`1M`, `3M`, `YTD`, `1Y`, `ALL`, or custom date ranges), with weekend and holiday market forward-filling.
- **Mathematical Period Change Attribution:** Exact decomposition of net worth movement into:
  - **Market Price Movement** ($S_0 \cdot \Delta P$)
  - **Net Share Additions / Inflows** ($\Delta S \cdot P_1$)
  - **Cash Balance Changes** ($\Delta \text{Cash}$)
  - **Credit Debt Changes** ($\Delta \text{Credit}$)
- **Frictionless Data Entry:** Review template pre-filled with your latest known account balances and ticker share counts. Defaults to today's date with editable date pickers.
- **Quicken Simplifi Responsive Design:** Desktop-first layout with collapsible/responsive controls that adapt cleanly to tablets and mobile devices.

---

## 🚀 Quick Start (Windows)

### 1. Fast Start
Double-click `start.bat` in the repository root or run:
```cmd
start.bat
```
This automatically initializes the Python virtual environment, installs npm dependencies, starts the FastAPI backend (`http://localhost:8000`), starts the Vite frontend (`http://localhost:5173`), and opens your browser.

### 2. Fast Update
To pull the latest Git changes and update dependencies:
```cmd
update.bat
```

---

## ⚙️ Manual Setup & Development

### Backend (Python 3.11+)
```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Seed realistic demo data
python seed_demo_data.py

# Run FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (React + Vite + Tailwind CSS)
```bash
# Navigate to frontend directory
cd frontend

# Install packages
npm install

# Start Vite development server
npm run dev
```

---

## 📂 Configuration (`.env`)

Configure storage paths via the `.env` file in the root directory:
```ini
# Primary SQLite Database Path
DB_PATH=D:\finance\finance.db

# Automatic Backups Directory
BACKUP_DIR=D:\finance\backups

# Maximum backups retained
MAX_BACKUPS=30

# Server Bind Settings
HOST=0.0.0.0
PORT=8000
```
*Note: If `D:\finance\` cannot be accessed (e.g. machine without a D: drive), the application gracefully falls back to a local `data/` directory.*

---

## 📊 Data Model & Account Types

1. **`accounts`**: `id`, `name`, `type` (`CASH` | `BROKERAGE` | `CREDIT`), `institution`, `is_active`, `created_at`
2. **`balance_snapshots`**: `id`, `account_id`, `as_of_date` (YYYY-MM-DD), `balance` (stored as negative for `CREDIT`), `note`
3. **`brokerage_holdings`**: `id`, `account_id`, `as_of_date` (YYYY-MM-DD), `asset_type` (`EQUITY` | `CASH`), `ticker`, `shares`
4. **`ticker_prices`**: `ticker`, `date` (YYYY-MM-DD), `close_price` (cached from `yfinance`; `CASH` is always `1.0`)
5. **`transactions`**: `id`, `account_id`, `date`, `merchant`, `amount`, `category`, `is_transfer`, `note`

---

## 🐧 Later Linux VM / Docker Hosting

The frontend Vite config proxies `/api` to the backend and binds to `0.0.0.0`. To deploy on a Linux VM:
1. Copy or clone the repository to your Linux server.
2. In `.env`, set `DB_PATH=/var/finance/finance.db` and `BACKUP_DIR=/var/finance/backups`.
3. Build the frontend (`npm run build`) and serve static files with Nginx or Caddy, reverse-proxying `/api` to Uvicorn running on port 8000.
4. Access via your mobile device or desktop browser over your local network or Wireguard/Tailscale VPN.
