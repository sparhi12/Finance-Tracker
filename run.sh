#!/usr/bin/env bash
# ============================================================
# Finance Tracker - macOS / Linux Launcher
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "  Finance Tracker - Local-First Net Worth Manager"
echo "============================================================"
echo ""

# 1. Check Python
PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "[ERROR] Python 3 was not found. Please install Python 3.9+."
    exit 1
fi

# 2. Check Virtual Environment
if [ ! -d "venv" ]; then
    echo "[Setup] Creating virtual environment..."
    $PYTHON_CMD -m venv venv
    echo "[Setup] Installing dependencies..."
    ./venv/bin/pip install --upgrade pip
    ./venv/bin/pip install -r requirements.txt
fi

# 3. Launch App
echo "[Starting] Launching Finance Tracker..."
./venv/bin/python run.py
