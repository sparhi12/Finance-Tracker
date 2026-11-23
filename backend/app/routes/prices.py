from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter
from app.price_service import (
    fetch_and_cache_ticker_prices,
    get_distinct_brokerage_tickers,
    get_latest_cached_prices,
    ensure_cash_price
)
from app.database import get_db

router = APIRouter(prefix="/api/prices", tags=["Prices"])

class RefreshPricesRequest(BaseModel):
    tickers: Optional[List[str]] = None

@router.post("/refresh")
def refresh_prices(payload: Optional[RefreshPricesRequest] = None):
    ensure_cash_price()
    if payload and payload.tickers:
        tickers = [t.strip().upper() for t in payload.tickers if t and t.strip().upper() != "CASH"]
    else:
        tickers = get_distinct_brokerage_tickers()

    if not tickers:
        return {"message": "No active equity tickers to refresh", "synced": 0, "tickers": []}

    res = fetch_and_cache_ticker_prices(tickers)
    return {
        "message": f"Price sync complete for {len(tickers)} tickers",
        "synced_records": res["synced"],
        "errors": res["errors"],
        "tickers": tickers
    }

@router.get("/latest")
def get_latest_prices():
    prices = get_latest_cached_prices()
    return prices

@router.get("/status")
def get_prices_status():
    with get_db(is_write=False) as conn:
        count = conn.execute("SELECT COUNT(DISTINCT ticker) as count FROM ticker_prices WHERE ticker != 'CASH'").fetchone()["count"]
        latest_date = conn.execute("SELECT MAX(date) as max_date FROM ticker_prices WHERE ticker != 'CASH'").fetchone()["max_date"]
    return {
        "cached_tickers_count": count,
        "latest_price_date": latest_date
    }
