import sqlite3
from contextlib import contextmanager
from typing import Generator
from app.config import DB_PATH
from app.backup_service import create_backup

def get_raw_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    # Enable WAL mode and foreign keys
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    return conn

@contextmanager
def get_db(is_write: bool = False) -> Generator[sqlite3.Connection, None, None]:
    if is_write:
        create_backup()
    conn = get_raw_connection()
    try:
        yield conn
        if is_write:
            conn.commit()
    except Exception:
        if is_write:
            conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with get_db(is_write=True) as conn:
        cursor = conn.cursor()
        
        # 1. Accounts
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('CASH', 'BROKERAGE', 'CREDIT')),
            institution TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );
        """)

        # 2. Balance Snapshots (for CASH & CREDIT accounts)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS balance_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            as_of_date TEXT NOT NULL,
            balance REAL NOT NULL,
            note TEXT,
            UNIQUE(account_id, as_of_date)
        );
        """)

        # 3. Brokerage Holdings (snapshot of holdings per as_of_date)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS brokerage_holdings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            as_of_date TEXT NOT NULL,
            asset_type TEXT NOT NULL CHECK(asset_type IN ('EQUITY', 'CASH')),
            ticker TEXT NOT NULL,
            shares REAL NOT NULL,
            UNIQUE(account_id, as_of_date, ticker)
        );
        """)

        # 4. Ticker Prices (cached daily closing prices, CASH is always 1.0)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS ticker_prices (
            ticker TEXT NOT NULL,
            date TEXT NOT NULL,
            close_price REAL NOT NULL,
            PRIMARY KEY (ticker, date)
        );
        """)

        # 5. Transactions (ready for P1 imports & entries)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            date TEXT NOT NULL,
            merchant TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT,
            is_transfer INTEGER NOT NULL DEFAULT 0,
            note TEXT
        );
        """)

        # Indices for efficient date filtering and foreign keys
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_snapshots_date ON balance_snapshots(as_of_date);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_snapshots_acc ON balance_snapshots(account_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_holdings_date ON brokerage_holdings(as_of_date);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_holdings_acc ON brokerage_holdings(account_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_acc_date ON transactions(account_id, date);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_ticker_prices_ticker ON ticker_prices(ticker);")
