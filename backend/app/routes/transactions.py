import csv
import io
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from app.database import get_db
from app.models import TransactionCreate, TransactionResponse

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])

@router.get("", response_model=List[TransactionResponse])
def list_transactions(
    account_id: Optional[int] = None,
    category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(100, le=500),
    offset: int = 0
):
    query = "SELECT id, account_id, date, merchant, amount, category, is_transfer, note FROM transactions WHERE 1=1"
    params = []

    if account_id:
        query += " AND account_id = ?"
        params.append(account_id)
    if category:
        query += " AND category = ?"
        params.append(category)
    if start_date:
        query += " AND date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND date <= ?"
        params.append(end_date)
    if search:
        query += " AND (merchant LIKE ? OR note LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])

    query += " ORDER BY date DESC, id DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with get_db(is_write=False) as conn:
        rows = conn.execute(query, params).fetchall()
        return [
            TransactionResponse(
                id=r["id"],
                account_id=r["account_id"],
                date=r["date"],
                merchant=r["merchant"],
                amount=float(r["amount"]),
                category=r["category"] or "Uncategorized",
                is_transfer=bool(r["is_transfer"]),
                note=r["note"]
            )
            for r in rows
        ]

@router.post("", response_model=TransactionResponse, status_code=201)
def create_transaction(payload: TransactionCreate):
    with get_db(is_write=True) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO transactions (account_id, date, merchant, amount, category, is_transfer, note)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            payload.account_id,
            payload.date,
            payload.merchant.strip(),
            round(payload.amount, 2),
            payload.category.strip() if payload.category else "Uncategorized",
            int(payload.is_transfer),
            payload.note
        ))
        new_id = cursor.lastrowid

    return TransactionResponse(
        id=new_id,
        account_id=payload.account_id,
        date=payload.date,
        merchant=payload.merchant.strip(),
        amount=round(payload.amount, 2),
        category=payload.category.strip() if payload.category else "Uncategorized",
        is_transfer=payload.is_transfer,
        note=payload.note
    )

@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: int):
    with get_db(is_write=True) as conn:
        res = conn.execute("DELETE FROM transactions WHERE id = ?", (transaction_id,))
        if res.rowcount == 0:
            raise HTTPException(status_code=404, detail="Transaction not found")
    return {"message": "Transaction deleted", "id": transaction_id}

@router.post("/import-csv/{account_id}")
async def import_transactions_csv(account_id: int, file: UploadFile = File(...)):
    """
    CSV importer supporting common formats (Date, Merchant, Amount, Category).
    """
    with get_db(is_write=False) as conn:
        acc = conn.execute("SELECT id FROM accounts WHERE id = ?", (account_id,)).fetchone()
        if not acc:
            raise HTTPException(status_code=404, detail="Account not found")

    content = await file.read()
    text = content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    records = []
    for row in reader:
        # Normalize column keys
        row_lower = {k.strip().lower(): v.strip() for k, v in row.items() if k}
        
        date_val = row_lower.get("date") or row_lower.get("posted date") or row_lower.get("transaction date")
        merchant_val = row_lower.get("merchant") or row_lower.get("payee") or row_lower.get("description") or "Unknown"
        amount_val = row_lower.get("amount") or row_lower.get("value")
        category_val = row_lower.get("category") or "Uncategorized"
        note_val = row_lower.get("note") or row_lower.get("memo")

        if date_val and amount_val:
            try:
                amt = float(amount_val.replace("$", "").replace(",", ""))
                records.append((account_id, date_val, merchant_val, amt, category_val, 0, note_val))
            except ValueError:
                continue

    if records:
        with get_db(is_write=True) as conn:
            conn.executemany("""
                INSERT INTO transactions (account_id, date, merchant, amount, category, is_transfer, note)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, records)

    return {"message": f"Successfully imported {len(records)} transactions", "imported_count": len(records)}
