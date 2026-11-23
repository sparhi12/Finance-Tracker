import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.database import get_db
from app.models import (
    BalanceSnapshotCreate,
    BalanceSnapshotResponse,
    BrokerageHoldingsSnapshotCreate,
    QuickReviewBatchSubmit
)
from app.engine import get_price_map, lookup_forward_filled_price
from app.price_service import fetch_and_cache_ticker_prices

router = APIRouter(prefix="/api/snapshots", tags=["Snapshots"])

@router.get("/review-template")
def get_review_template():
    """
    Returns all active accounts grouped by Cash, Brokerage, and Credit,
    pre-filled with their latest known balances/holdings and default today's date.
    """
    today_iso = datetime.date.today().isoformat()

    with get_db(is_write=False) as conn:
        accounts = conn.execute(
            "SELECT id, name, type, institution FROM accounts WHERE is_active = 1 ORDER BY id ASC"
        ).fetchall()

        # Latest cash/credit snapshots
        latest_snaps = conn.execute("""
            SELECT bs.account_id, bs.as_of_date, bs.balance, bs.note
            FROM balance_snapshots bs
            JOIN (
                SELECT account_id, MAX(as_of_date) as max_date
                FROM balance_snapshots
                GROUP BY account_id
            ) latest ON bs.account_id = latest.account_id AND bs.as_of_date = latest.max_date
        """).fetchall()
        snap_map = {r["account_id"]: dict(r) for r in latest_snaps}

        # Latest brokerage holdings
        latest_holdings_rows = conn.execute("""
            SELECT bh.account_id, bh.as_of_date, bh.asset_type, bh.ticker, bh.shares
            FROM brokerage_holdings bh
            JOIN (
                SELECT account_id, MAX(as_of_date) as max_date
                FROM brokerage_holdings
                GROUP BY account_id
            ) latest ON bh.account_id = latest.account_id AND bh.as_of_date = latest.max_date
            ORDER BY bh.asset_type DESC, bh.ticker ASC
        """).fetchall()

        tickers = {h["ticker"].upper() for h in latest_holdings_rows if h["asset_type"] == "EQUITY" and h["ticker"] != "CASH"}
        price_map = get_price_map(list(tickers), today_iso)

        holdings_map: Dict[int, Dict[str, Any]] = {}
        for h in latest_holdings_rows:
            acc_id = h["account_id"]
            if acc_id not in holdings_map:
                holdings_map[acc_id] = {
                    "as_of_date": h["as_of_date"],
                    "items": []
                }
            t = h["ticker"].upper()
            sh = float(h["shares"])
            pr = 1.0 if (h["asset_type"] == "CASH" or t == "CASH") else lookup_forward_filled_price(t, today_iso, price_map.get(t, {}))
            mv = sh * pr
            holdings_map[acc_id]["items"].append({
                "ticker": t,
                "asset_type": h["asset_type"],
                "shares": sh,
                "price": round(pr, 4),
                "market_value": round(mv, 2)
            })

    grouped = {
        "today_date": today_iso,
        "cash": [],
        "brokerage": [],
        "credit": []
    }

    for acc in accounts:
        acc_id = acc["id"]
        acc_type = acc["type"]
        entry = {
            "id": acc_id,
            "name": acc["name"],
            "type": acc_type,
            "institution": acc["institution"],
            "default_date": today_iso,
        }

        if acc_type in ("CASH", "CREDIT"):
            snap = snap_map.get(acc_id)
            if snap:
                raw_bal = float(snap["balance"])
                # For credit accounts, expose positive magnitude for user editing convenience
                entry["latest_balance"] = abs(raw_bal) if acc_type == "CREDIT" else raw_bal
                entry["raw_balance"] = raw_bal
                entry["latest_as_of_date"] = snap["as_of_date"]
                entry["note"] = snap["note"] or ""
            else:
                entry["latest_balance"] = 0.0
                entry["raw_balance"] = 0.0
                entry["latest_as_of_date"] = None
                entry["note"] = ""

            if acc_type == "CASH":
                grouped["cash"].append(entry)
            else:
                grouped["credit"].append(entry)

        elif acc_type == "BROKERAGE":
            data = holdings_map.get(acc_id)
            if data:
                entry["latest_as_of_date"] = data["as_of_date"]
                entry["holdings"] = data["items"]
                entry["total_value"] = round(sum(i["market_value"] for i in data["items"]), 2)
            else:
                entry["latest_as_of_date"] = None
                # Default starter holding of CASH 0.0
                entry["holdings"] = [{"ticker": "CASH", "asset_type": "CASH", "shares": 0.0, "price": 1.0, "market_value": 0.0}]
                entry["total_value"] = 0.0

            grouped["brokerage"].append(entry)

    return grouped

@router.post("/balance")
def save_balance_snapshot(payload: BalanceSnapshotCreate):
    with get_db(is_write=False) as conn:
        acc = conn.execute("SELECT id, type FROM accounts WHERE id = ?", (payload.account_id,)).fetchone()
        if not acc:
            raise HTTPException(status_code=404, detail="Account not found")
        acc_type = acc["type"]

    # Credit debt is stored as negative number. If user supplies positive, auto-negate!
    bal = payload.balance
    if acc_type == "CREDIT" and bal > 0:
        bal = -bal

    with get_db(is_write=True) as conn:
        conn.execute("""
            INSERT INTO balance_snapshots (account_id, as_of_date, balance, note)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(account_id, as_of_date) DO UPDATE SET
                balance = excluded.balance,
                note = excluded.note
        """, (payload.account_id, payload.as_of_date, round(bal, 2), payload.note))

    return {"message": "Balance snapshot saved", "account_id": payload.account_id, "as_of_date": payload.as_of_date, "balance": bal}

@router.post("/holdings")
def save_brokerage_holdings(payload: BrokerageHoldingsSnapshotCreate, background_tasks: BackgroundTasks):
    with get_db(is_write=False) as conn:
        acc = conn.execute("SELECT id, type FROM accounts WHERE id = ?", (payload.account_id,)).fetchone()
        if not acc:
            raise HTTPException(status_code=404, detail="Account not found")
        if acc["type"] != "BROKERAGE":
            raise HTTPException(status_code=400, detail="Holdings can only be saved for BROKERAGE accounts")

    tickers_to_sync = []
    with get_db(is_write=True) as conn:
        # Clear existing holdings for this date
        conn.execute(
            "DELETE FROM brokerage_holdings WHERE account_id = ? AND as_of_date = ?",
            (payload.account_id, payload.as_of_date)
        )
        for h in payload.holdings:
            ticker = h.ticker.strip().upper()
            asset_type = "CASH" if ticker == "CASH" else h.asset_type
            if asset_type == "EQUITY" and ticker != "CASH":
                tickers_to_sync.append(ticker)
            conn.execute("""
                INSERT INTO brokerage_holdings (account_id, as_of_date, asset_type, ticker, shares)
                VALUES (?, ?, ?, ?, ?)
            """, (payload.account_id, payload.as_of_date, asset_type, ticker, round(h.shares, 6)))

    if tickers_to_sync:
        background_tasks.add_task(fetch_and_cache_ticker_prices, tickers_to_sync)

    return {"message": "Holdings saved successfully", "account_id": payload.account_id, "as_of_date": payload.as_of_date}

@router.post("/bulk-review")
def submit_bulk_review(payload: QuickReviewBatchSubmit, background_tasks: BackgroundTasks):
    """
    Submits multiple reviewed balances/holdings at once.
    """
    equity_tickers_to_sync = []
    updated_count = 0

    with get_db(is_write=False) as conn:
        all_accounts = {a["id"]: a["type"] for a in conn.execute("SELECT id, type FROM accounts").fetchall()}

    with get_db(is_write=True) as conn:
        for item in payload.items:
            acc_id = item.account_id
            if acc_id not in all_accounts:
                continue
            acc_type = all_accounts[acc_id]
            date_str = item.as_of_date

            if acc_type in ("CASH", "CREDIT") and item.balance is not None:
                bal = float(item.balance)
                if acc_type == "CREDIT" and bal > 0:
                    bal = -bal
                conn.execute("""
                    INSERT INTO balance_snapshots (account_id, as_of_date, balance, note)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(account_id, as_of_date) DO UPDATE SET
                        balance = excluded.balance,
                        note = excluded.note
                """, (acc_id, date_str, round(bal, 2), item.note or ""))
                updated_count += 1

            elif acc_type == "BROKERAGE" and item.holdings is not None:
                conn.execute(
                    "DELETE FROM brokerage_holdings WHERE account_id = ? AND as_of_date = ?",
                    (acc_id, date_str)
                )
                for h in item.holdings:
                    t = h.ticker.strip().upper()
                    atype = "CASH" if t == "CASH" else h.asset_type
                    if atype == "EQUITY" and t != "CASH":
                        equity_tickers_to_sync.append(t)
                    conn.execute("""
                        INSERT INTO brokerage_holdings (account_id, as_of_date, asset_type, ticker, shares)
                        VALUES (?, ?, ?, ?, ?)
                    """, (acc_id, date_str, atype, t, round(h.shares, 6)))
                updated_count += 1

    if equity_tickers_to_sync:
        background_tasks.add_task(fetch_and_cache_ticker_prices, list(set(equity_tickers_to_sync)))

    return {"message": f"Successfully updated {updated_count} accounts", "updated_count": updated_count}

@router.get("/history/{account_id}")
def get_account_snapshot_history(account_id: int):
    with get_db(is_write=False) as conn:
        acc = conn.execute("SELECT id, name, type FROM accounts WHERE id = ?", (account_id,)).fetchone()
        if not acc:
            raise HTTPException(status_code=404, detail="Account not found")
        acc_type = acc["type"]

        if acc_type in ("CASH", "CREDIT"):
            rows = conn.execute("""
                SELECT id, account_id, as_of_date, balance, note
                FROM balance_snapshots
                WHERE account_id = ?
                ORDER BY as_of_date DESC
            """, (account_id,)).fetchall()
            return {"account_id": account_id, "type": acc_type, "snapshots": [dict(r) for r in rows]}
        else:
            rows = conn.execute("""
                SELECT id, account_id, as_of_date, asset_type, ticker, shares
                FROM brokerage_holdings
                WHERE account_id = ?
                ORDER BY as_of_date DESC, ticker ASC
            """, (account_id,)).fetchall()
            # Group by as_of_date
            grouped = {}
            for r in rows:
                d = r["as_of_date"]
                grouped.setdefault(d, []).append({
                    "id": r["id"],
                    "asset_type": r["asset_type"],
                    "ticker": r["ticker"],
                    "shares": r["shares"]
                })
            res = [{"as_of_date": d, "holdings": h} for d, h in grouped.items()]
            return {"account_id": account_id, "type": acc_type, "snapshots": res}

@router.delete("/{account_id}/{as_of_date}")
def delete_snapshot_for_date(account_id: int, as_of_date: str):
    with get_db(is_write=True) as conn:
        conn.execute("DELETE FROM balance_snapshots WHERE account_id = ? AND as_of_date = ?", (account_id, as_of_date))
        conn.execute("DELETE FROM brokerage_holdings WHERE account_id = ? AND as_of_date = ?", (account_id, as_of_date))
    return {"message": f"Snapshot deleted for {as_of_date}"}
