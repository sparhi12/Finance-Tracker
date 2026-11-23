import datetime
from typing import List, Dict, Optional, Set
import yfinance as yf
from app.database import get_db

def ensure_cash_price():
    """Ensure CASH price is recorded as 1.0 for reference."""
    today = datetime.date.today().isoformat()
    with get_db(is_write=True) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO ticker_prices (ticker, date, close_price) VALUES (?, ?, ?)",
            ("CASH", today, 1.0)
        )

def get_distinct_brokerage_tickers() -> List[str]:
    with get_db(is_write=False) as conn:
        rows = conn.execute("""
            SELECT DISTINCT bh.ticker 
            FROM brokerage_holdings bh
            JOIN accounts a ON a.id = bh.account_id
            WHERE a.is_active = 1 AND bh.ticker != 'CASH' AND bh.asset_type = 'EQUITY'
        """).fetchall()
        return [r["ticker"].upper() for r in rows if r["ticker"]]

def fetch_and_cache_ticker_prices(
    tickers: List[str], 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None
) -> Dict[str, int]:
    """
    Downloads historical close prices from yfinance and stores them in ticker_prices.
    Offline-resilient: if internet is unavailable, logs warning and uses cached prices.
    """
    ensure_cash_price()
    clean_tickers = list({t.strip().upper() for t in tickers if t and t.strip().upper() != "CASH"})
    if not clean_tickers:
        return {"synced": 0, "errors": 0}

    # If start_date not provided, default to 2 years ago or min holding date
    today = datetime.date.today()
    if not start_date:
        start_date = (today - datetime.timedelta(days=730)).isoformat()
    if not end_date:
        end_date = (today + datetime.timedelta(days=1)).isoformat()

    synced_records = 0
    errors = 0

    for ticker in clean_tickers:
        try:
            # Download ticker data with auto_adjust=True for accurate split/dividend adjusted closes
            yf_ticker = yf.Ticker(ticker)
            hist = yf_ticker.history(start=start_date, end=end_date, auto_adjust=True)
            
            if hist.empty:
                # Try download fallback
                hist = yf.download(ticker, start=start_date, end=end_date, auto_adjust=True, progress=False)

            if hist is not None and not hist.empty:
                records = []
                for idx, row in hist.iterrows():
                    # idx can be a Timestamp
                    date_str = idx.strftime("%Y-%m-%d")
                    # Handle Series vs scalar in close
                    close_val = row["Close"]
                    if hasattr(close_val, "iloc"):
                        close_val = close_val.iloc[0]
                    close_val = float(close_val)
                    records.append((ticker, date_str, round(close_val, 4)))
                
                if records:
                    with get_db(is_write=True) as conn:
                        conn.executemany(
                            "INSERT OR REPLACE INTO ticker_prices (ticker, date, close_price) VALUES (?, ?, ?)",
                            records
                        )
                        synced_records += len(records)
            else:
                print(f"[Price Sync] No historical data returned for ticker: {ticker}")
        except Exception as e:
            errors += 1
            print(f"[Price Sync Warning] Could not fetch prices for {ticker} (might be offline): {e}")

    return {"synced": synced_records, "errors": errors}

def get_latest_cached_prices(tickers: Optional[List[str]] = None) -> Dict[str, Dict]:
    """
    Returns the latest known cached price and date for each requested ticker (or all cached tickers).
    """
    ensure_cash_price()
    query = """
        SELECT ticker, date, close_price
        FROM ticker_prices
        WHERE (ticker, date) IN (
            SELECT ticker, MAX(date)
            FROM ticker_prices
            GROUP BY ticker
        )
    """
    with get_db(is_write=False) as conn:
        rows = conn.execute(query).fetchall()
        result = {}
        for r in rows:
            t = r["ticker"].upper()
            if tickers is None or t in tickers:
                result[t] = {
                    "price": float(r["close_price"]),
                    "as_of_date": r["date"]
                }
        if "CASH" not in result:
            result["CASH"] = {"price": 1.0, "as_of_date": datetime.date.today().isoformat()}
        return result

def startup_price_sync():
    """
    Runs on FastAPI startup to fetch recent prices for all active equity tickers.
    """
    tickers = get_distinct_brokerage_tickers()
    if tickers:
        print(f"[Startup Price Sync] Syncing prices for {len(tickers)} active tickers: {tickers}...")
        fetch_and_cache_ticker_prices(tickers)
    else:
        print("[Startup Price Sync] No active equity tickers found.")
