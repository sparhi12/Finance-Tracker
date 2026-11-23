import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.database import get_db
from app.models import AccountCreate, AccountUpdate, AccountResponse
from app.engine import get_price_map, lookup_forward_filled_price

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])

@router.get("", response_model=List[AccountResponse])
def list_accounts(include_inactive: bool = False):
    query = "SELECT id, name, type, institution, is_active, created_at FROM accounts"
    if not include_inactive:
        query += " WHERE is_active = 1"
    query += " ORDER BY type ASC, name ASC"

    with get_db(is_write=False) as conn:
        accounts = conn.execute(query).fetchall()
        result = []
        today_iso = datetime.date.today().isoformat()

        # For brokerage accounts, pre-fetch needed ticker prices
        brokerage_holdings = conn.execute("""
            SELECT bh.account_id, bh.as_of_date, bh.asset_type, bh.ticker, bh.shares
            FROM brokerage_holdings bh
            JOIN (
                SELECT account_id, MAX(as_of_date) as max_date
                FROM brokerage_holdings
                GROUP BY account_id
            ) latest ON bh.account_id = latest.account_id AND bh.as_of_date = latest.max_date
        """).fetchall()

        tickers = {h["ticker"].upper() for h in brokerage_holdings if h["asset_type"] == "EQUITY" and h["ticker"] != "CASH"}
        price_map = get_price_map(list(tickers), today_iso)

        # Brokerage balances by account_id
        brokerage_totals = {}
        brokerage_dates = {}
        for h in brokerage_holdings:
            acc_id = h["account_id"]
            brokerage_dates[acc_id] = h["as_of_date"]
            t = h["ticker"].upper()
            sh = float(h["shares"])
            if h["asset_type"] == "CASH" or t == "CASH":
                val = sh
            else:
                p = lookup_forward_filled_price(t, today_iso, price_map.get(t, {}))
                val = sh * p
            brokerage_totals[acc_id] = brokerage_totals.get(acc_id, 0.0) + val

        # Cash & Credit balances
        snap_rows = conn.execute("""
            SELECT bs.account_id, bs.as_of_date, bs.balance
            FROM balance_snapshots bs
            JOIN (
                SELECT account_id, MAX(as_of_date) as max_date
                FROM balance_snapshots
                GROUP BY account_id
            ) latest ON bs.account_id = latest.account_id AND bs.as_of_date = latest.max_date
        """).fetchall()
        snapshot_map = {r["account_id"]: (float(r["balance"]), r["as_of_date"]) for r in snap_rows}

        for acc in accounts:
            acc_id = acc["id"]
            acc_type = acc["type"]
            latest_bal = None
            latest_date = None

            if acc_type in ("CASH", "CREDIT"):
                if acc_id in snapshot_map:
                    latest_bal, latest_date = snapshot_map[acc_id]
            elif acc_type == "BROKERAGE":
                if acc_id in brokerage_totals:
                    latest_bal = round(brokerage_totals[acc_id], 2)
                    latest_date = brokerage_dates.get(acc_id)

            result.append(AccountResponse(
                id=acc["id"],
                name=acc["name"],
                type=acc["type"],
                institution=acc["institution"],
                is_active=bool(acc["is_active"]),
                created_at=acc["created_at"],
                latest_balance=latest_bal,
                latest_as_of_date=latest_date
            ))

        return result

@router.post("", response_model=AccountResponse, status_code=201)
def create_account(payload: AccountCreate):
    created_at = datetime.datetime.now().isoformat()
    with get_db(is_write=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO accounts (name, type, institution, is_active, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (payload.name.strip(), payload.type, payload.institution.strip(), int(payload.is_active), created_at)
        )
        new_id = cursor.lastrowid

    return AccountResponse(
        id=new_id,
        name=payload.name.strip(),
        type=payload.type,
        institution=payload.institution.strip(),
        is_active=payload.is_active,
        created_at=created_at,
        latest_balance=0.0,
        latest_as_of_date=None
    )

@router.get("/{account_id}", response_model=AccountResponse)
def get_account(account_id: int):
    with get_db(is_write=False) as conn:
        row = conn.execute("SELECT id, name, type, institution, is_active, created_at FROM accounts WHERE id = ?", (account_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Account not found")
        return AccountResponse(
            id=row["id"],
            name=row["name"],
            type=row["type"],
            institution=row["institution"],
            is_active=bool(row["is_active"]),
            created_at=row["created_at"]
        )

@router.put("/{account_id}", response_model=AccountResponse)
def update_account(account_id: int, payload: AccountUpdate):
    with get_db(is_write=True) as conn:
        row = conn.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Account not found")
        
        name = payload.name.strip() if payload.name is not None else row["name"]
        acc_type = payload.type if payload.type is not None else row["type"]
        institution = payload.institution.strip() if payload.institution is not None else row["institution"]
        is_active = int(payload.is_active) if payload.is_active is not None else row["is_active"]

        conn.execute("""
            UPDATE accounts 
            SET name = ?, type = ?, institution = ?, is_active = ?
            WHERE id = ?
        """, (name, acc_type, institution, is_active, account_id))

    return get_account(account_id)

@router.delete("/{account_id}")
def delete_account(account_id: int):
    with get_db(is_write=True) as conn:
        row = conn.execute("SELECT id FROM accounts WHERE id = ?", (account_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Account not found")
        conn.execute("DELETE FROM accounts WHERE id = ?", (account_id,))
    return {"message": "Account deleted successfully", "id": account_id}
