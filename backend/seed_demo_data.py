"""
Demo Data Seeder for Local-First Personal Finance Tracker
Creates realistic accounts, historical snapshots, and holdings.
"""
import datetime
from app.database import get_db, init_db
from app.price_service import fetch_and_cache_ticker_prices, ensure_cash_price

def seed_demo_data():
    init_db()
    ensure_cash_price()

    with get_db(is_write=False) as conn:
        existing = conn.execute("SELECT COUNT(*) as count FROM accounts").fetchone()["count"]
        if existing > 0:
            print(f"[Seed] Database already has {existing} accounts. Skipping demo seed.")
            return

    print("[Seed] Creating demo accounts...")
    accounts_data = [
        ("Primary Checking", "CASH", "Chase Bank"),
        ("High Yield Savings", "CASH", "Marcus by Goldman"),
        ("Taxable Brokerage", "BROKERAGE", "Vanguard"),
        ("Sapphire Preferred", "CREDIT", "Chase Bank"),
    ]

    with get_db(is_write=True) as conn:
        cursor = conn.cursor()
        created_at = (datetime.date.today() - datetime.timedelta(days=180)).isoformat()
        acc_ids = {}
        for name, acc_type, inst in accounts_data:
            cursor.execute(
                "INSERT INTO accounts (name, type, institution, is_active, created_at) VALUES (?, ?, ?, 1, ?)",
                (name, acc_type, inst, created_at)
            )
            acc_ids[name] = cursor.lastrowid

    # Historical dates (e.g. 5 months ago, 4 months ago, 3 months ago, 2 months ago, 1 month ago, today)
    today = datetime.date.today()
    dates = [
        (today - datetime.timedelta(days=150)).isoformat(),
        (today - datetime.timedelta(days=120)).isoformat(),
        (today - datetime.timedelta(days=90)).isoformat(),
        (today - datetime.timedelta(days=60)).isoformat(),
        (today - datetime.timedelta(days=30)).isoformat(),
        today.isoformat(),
    ]

    print("[Seed] Populating historical snapshots...")
    checking_id = acc_ids["Primary Checking"]
    savings_id = acc_ids["High Yield Savings"]
    brokerage_id = acc_ids["Taxable Brokerage"]
    credit_id = acc_ids["Sapphire Preferred"]

    checking_balances = [4200.0, 4850.0, 5100.0, 4600.0, 5300.0, 5800.0]
    savings_balances = [20000.0, 20500.0, 21000.0, 22000.0, 23000.0, 24500.0]
    credit_balances = [-1850.0, -2100.0, -1450.0, -1900.0, -1200.0, -950.0]

    # Brokerage holdings: uninvested cash + VT & VTI shares
    brokerage_snapshots = [
        [("CASH", "CASH", 1500.0), ("EQUITY", "VT", 120.0), ("EQUITY", "VTI", 60.0)],
        [("CASH", "CASH", 1800.0), ("EQUITY", "VT", 125.0), ("EQUITY", "VTI", 62.0)],
        [("CASH", "CASH", 2200.0), ("EQUITY", "VT", 130.0), ("EQUITY", "VTI", 65.0)],
        [("CASH", "CASH", 1600.0), ("EQUITY", "VT", 140.0), ("EQUITY", "VTI", 70.0)],
        [("CASH", "CASH", 2000.0), ("EQUITY", "VT", 150.0), ("EQUITY", "VTI", 75.0)],
        [("CASH", "CASH", 2500.0), ("EQUITY", "VT", 160.0), ("EQUITY", "VTI", 80.0)],
    ]

    with get_db(is_write=True) as conn:
        for idx, d in enumerate(dates):
            # Checking
            conn.execute(
                "INSERT INTO balance_snapshots (account_id, as_of_date, balance, note) VALUES (?, ?, ?, ?)",
                (checking_id, d, checking_balances[idx], "Monthly check-in")
            )
            # Savings
            conn.execute(
                "INSERT INTO balance_snapshots (account_id, as_of_date, balance, note) VALUES (?, ?, ?, ?)",
                (savings_id, d, savings_balances[idx], "Monthly deposit + interest")
            )
            # Credit
            conn.execute(
                "INSERT INTO balance_snapshots (account_id, as_of_date, balance, note) VALUES (?, ?, ?, ?)",
                (credit_id, d, credit_balances[idx], "Statement balance")
            )
            # Brokerage holdings
            for atype, ticker, shares in brokerage_snapshots[idx]:
                conn.execute(
                    "INSERT INTO brokerage_holdings (account_id, as_of_date, asset_type, ticker, shares) VALUES (?, ?, ?, ?, ?)",
                    (brokerage_id, d, atype, ticker, shares)
                )

    print("[Seed] Syncing prices for VT and VTI...")
    fetch_and_cache_ticker_prices(["VT", "VTI"], start_date=(today - datetime.timedelta(days=180)).isoformat())

    print("[Seed] Demo data seeding complete!")

if __name__ == "__main__":
    seed_demo_data()
