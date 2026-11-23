"""
Comprehensive End-to-End Test Suite for Simplifi Local
"""
import os
import sys
import tempfile
from pathlib import Path

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from main import app
from app.database import get_db, init_db
from app.config import DB_PATH, BACKUP_DIR
from app.backup_service import create_backup, list_backups
from app.engine import reconstruct_time_series, get_account_detail_analytics

client = TestClient(app)

def test_health():
    print("[Test] Checking API health...")
    res = client.get("/api/health")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["status"] == "ok"
    print(" -> Health check passed.")

def test_database_wal_mode():
    print("[Test] Verifying SQLite WAL mode...")
    with get_db(is_write=False) as conn:
        mode = conn.execute("PRAGMA journal_mode;").fetchone()[0]
        assert mode.lower() == "wal", f"Expected WAL mode, got {mode}"
    print(f" -> Journal mode verified: {mode.upper()}")

def test_backup_service():
    print("[Test] Testing automated backup creation and retention...")
    backup_file = create_backup(force=True)
    assert backup_file is not None
    assert Path(backup_file).exists()
    
    backups = list_backups()
    assert len(backups) >= 1
    print(f" -> Backup verified! Latest: {backups[0]['filename']} ({backups[0]['size_bytes']} bytes)")

def test_accounts_api():
    print("[Test] Testing Accounts API...")
    # List existing accounts
    res = client.get("/api/accounts")
    assert res.status_code == 200
    initial_count = len(res.json())

    # Create new Cash account
    create_payload = {
        "name": "Test Emergency Fund",
        "type": "CASH",
        "institution": "Ally Bank",
        "is_active": True
    }
    res = client.post("/api/accounts", json=create_payload)
    assert res.status_code == 201, res.text
    created = res.json()
    acc_id = created["id"]
    assert created["name"] == "Test Emergency Fund"
    assert created["type"] == "CASH"

    # Update account
    res = client.put(f"/api/accounts/{acc_id}", json={"name": "Ally Savings"})
    assert res.status_code == 200
    assert res.json()["name"] == "Ally Savings"

    # Delete test account
    res = client.delete(f"/api/accounts/{acc_id}")
    assert res.status_code == 200
    print(f" -> Accounts API CRUD verified (tested create, update, delete).")

def test_snapshots_review_template():
    print("[Test] Testing Review Template API...")
    res = client.get("/api/snapshots/review-template")
    assert res.status_code == 200
    template = res.json()
    assert "cash" in template
    assert "brokerage" in template
    assert "credit" in template
    assert "today_date" in template
    print(f" -> Review template verified: {len(template['cash'])} Cash, {len(template['brokerage'])} Brokerage, {len(template['credit'])} Credit.")

def test_credit_auto_negation():
    print("[Test] Testing credit balance auto-negation...")
    with get_db(is_write=False) as conn:
        credit_acc = conn.execute("SELECT id FROM accounts WHERE type = 'CREDIT' LIMIT 1").fetchone()
    
    if credit_acc:
        acc_id = credit_acc["id"]
        # Save snapshot with positive 1500 (user enters 1500 debt)
        res = client.post("/api/snapshots/balance", json={
            "account_id": acc_id,
            "as_of_date": "2026-11-20",
            "balance": 1500.0,
            "note": "Test positive debt input"
        })
        assert res.status_code == 200
        # Check DB that balance is -1500.0
        with get_db(is_write=False) as conn:
            snap = conn.execute(
                "SELECT balance FROM balance_snapshots WHERE account_id = ? AND as_of_date = '2026-11-20'",
                (acc_id,)
            ).fetchone()
            assert snap["balance"] == -1500.0, f"Expected -1500.0, got {snap['balance']}"
        print(" -> Credit auto-negation verified (1500 input stored as -1500.0).")

def test_time_series_attribution_reconciliation():
    print("[Test] Testing Time-Series Engine and Exact Attribution Reconciliation...")
    ranges = ["1M", "3M", "YTD", "ALL"]
    for r in ranges:
        res = client.get(f"/api/analytics/net-worth?range={r}")
        assert res.status_code == 200, res.text
        data = res.json()
        summary = data["summary"]
        attribution = data["attribution"]

        nw_chg = summary["period_change_dollars"]
        total_attributed = attribution["total_attributed"]
        
        diff = round(abs(nw_chg - total_attributed), 2)
        assert diff <= 0.01, f"Range {r}: NW Change {nw_chg} does not match Attributed {total_attributed} (diff: {diff})"

        # Check Asset Allocation
        alloc = summary["asset_allocation"]
        assert "cash" in alloc
        assert "equities" in alloc
        assert "debt" in alloc
        
        print(f" -> Range {r:4s}: Net Worth ${summary['current_net_worth']:,.2f} | Change: ${nw_chg:,.2f} | Attributed: ${total_attributed:,.2f} [MATCH]")

def test_brokerage_account_detail():
    print("[Test] Testing Brokerage Holdings breakdown & weights...")
    with get_db(is_write=False) as conn:
        brok = conn.execute("SELECT id, name FROM accounts WHERE type = 'BROKERAGE' LIMIT 1").fetchone()

    if brok:
        acc_id = brok["id"]
        res = client.get(f"/api/analytics/account/{acc_id}?range=3M")
        assert res.status_code == 200
        data = res.json()
        assert "holdings_breakdown" in data
        assert "cash_equity_split" in data
        assert "daily_history" in data
        holdings = data["holdings_breakdown"]
        weights = sum(h["weight_percent"] for h in holdings)
        if holdings:
            assert abs(weights - 100.0) <= 0.5, f"Weights sum to {weights}, expected ~100%"
        print(f" -> Brokerage '{brok['name']}': {len(holdings)} holdings, Split: Cash {data['cash_equity_split']['cash_percent']}%, Equities {data['cash_equity_split']['equity_percent']}%.")

def test_transactions_and_csv_import():
    print("[Test] Testing Transactions API & CSV statement import...")
    with get_db(is_write=False) as conn:
        acc = conn.execute("SELECT id FROM accounts LIMIT 1").fetchone()
    acc_id = acc["id"]

    # Create transaction
    tx_payload = {
        "account_id": acc_id,
        "date": "2026-11-21",
        "merchant": "Whole Foods Market",
        "amount": -84.32,
        "category": "Groceries",
        "is_transfer": False,
        "note": "Weekly grocery shopping"
    }
    res = client.post("/api/transactions", json=tx_payload)
    assert res.status_code == 201
    created_tx = res.json()
    tx_id = created_tx["id"]

    # List transactions
    res = client.get(f"/api/transactions?account_id={acc_id}&search=Whole Foods")
    assert res.status_code == 200
    tx_list = res.json()
    assert any(t["id"] == tx_id for t in tx_list)

    # Test CSV import
    csv_content = """Date,Merchant,Amount,Category,Note
2026-11-18,Netflix Subscription,-15.99,Entertainment,Monthly plan
2026-11-19,Employer Payroll,3250.00,Income,Direct deposit
2026-11-20,Trader Joes,-45.80,Groceries,Snacks
"""
    files = {"file": ("statement.csv", csv_content, "text/csv")}
    res = client.post(f"/api/transactions/import-csv/{acc_id}", files=files)
    assert res.status_code == 200
    import_res = res.json()
    assert import_res["imported_count"] == 3

    print(f" -> Transactions & CSV Import verified (created, searched, imported 3 items).")

if __name__ == "__main__":
    print("\n==================================================")
    print("  SIMPLIFI LOCAL - COMPREHENSIVE TEST SUITE")
    print("==================================================\n")
    test_health()
    test_database_wal_mode()
    test_backup_service()
    test_accounts_api()
    test_snapshots_review_template()
    test_credit_auto_negation()
    test_time_series_attribution_reconciliation()
    test_brokerage_account_detail()
    test_transactions_and_csv_import()
    print("\n==================================================")
    print("  ALL TESTS PASSED WITH 100% SUCCESS!")
    print("==================================================\n")
