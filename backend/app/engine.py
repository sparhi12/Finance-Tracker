import datetime
from typing import Dict, List, Optional, Tuple, Any
from app.database import get_db

def parse_date_range(
    range_str: Optional[str] = "1M",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Tuple[datetime.date, datetime.date]:
    """
    Parses range string or custom dates into (start_date, end_date).
    Supported ranges: 1M, 3M, YTD, 1Y, ALL, custom
    """
    today = datetime.date.today()
    if end_date:
        try:
            end = datetime.date.fromisoformat(end_date)
        except Exception:
            end = today
    else:
        end = today

    if range_str == "custom" and start_date:
        try:
            start = datetime.date.fromisoformat(start_date)
        except Exception:
            start = end - datetime.timedelta(days=30)
        return start, end

    range_str = (range_str or "1M").upper()
    if range_str == "1M":
        start = end - datetime.timedelta(days=30)
    elif range_str == "3M":
        start = end - datetime.timedelta(days=90)
    elif range_str == "YTD":
        start = datetime.date(end.year, 1, 1)
    elif range_str == "1Y":
        start = end - datetime.timedelta(days=365)
    elif range_str == "ALL":
        # Find earliest snapshot date across all accounts
        with get_db(is_write=False) as conn:
            snap_min = conn.execute("SELECT MIN(as_of_date) as min_date FROM balance_snapshots").fetchone()["min_date"]
            hold_min = conn.execute("SELECT MIN(as_of_date) as min_date FROM brokerage_holdings").fetchone()["min_date"]
            all_mins = [d for d in [snap_min, hold_min] if d]
            if all_mins:
                earliest = min(all_mins)
                start = datetime.date.fromisoformat(earliest)
            else:
                start = end - datetime.timedelta(days=365)
    else:
        start = end - datetime.timedelta(days=30)

    if start > end:
        start = end - datetime.timedelta(days=30)

    return start, end

def get_price_map(tickers: List[str], end_date_str: str) -> Dict[str, Dict[str, float]]:
    """
    Returns a dict mapping ticker -> { date_str: close_price }
    including forward-filled prices for missing market days.
    """
    clean_tickers = list({t.upper() for t in tickers if t})
    price_map: Dict[str, Dict[str, float]] = {t: {} for t in clean_tickers}
    price_map["CASH"] = {}

    if not clean_tickers:
        return price_map

    placeholders = ",".join("?" for _ in clean_tickers)
    query = f"""
        SELECT ticker, date, close_price 
        FROM ticker_prices 
        WHERE ticker IN ({placeholders}) AND date <= ?
        ORDER BY ticker, date ASC
    """
    with get_db(is_write=False) as conn:
        rows = conn.execute(query, clean_tickers + [end_date_str]).fetchall()
        for r in rows:
            t = r["ticker"].upper()
            price_map[t][r["date"]] = float(r["close_price"])

    return price_map

def lookup_forward_filled_price(ticker: str, target_date_str: str, ticker_prices: Dict[str, float]) -> float:
    """
    Forward-fills the closing price for a given ticker up to target_date_str.
    """
    if ticker.upper() == "CASH":
        return 1.0
    
    if not ticker_prices:
        return 1.0

    # If exact date exists
    if target_date_str in ticker_prices:
        return ticker_prices[target_date_str]

    # Find latest date <= target_date_str
    valid_dates = [d for d in ticker_prices.keys() if d <= target_date_str]
    if valid_dates:
        latest_date = max(valid_dates)
        return ticker_prices[latest_date]

    # If target_date_str is earlier than first available price, use earliest available
    earliest_date = min(ticker_prices.keys())
    return ticker_prices[earliest_date]

def reconstruct_time_series(
    range_str: Optional[str] = "1M",
    start_date_str: Optional[str] = None,
    end_date_str: Optional[str] = None
) -> Dict[str, Any]:
    """
    Cadence-agnostic daily time-series engine.
    Reconstructs daily account valuations, total net worth, assets, liabilities,
    asset allocation, KPIs, and period-over-period change attribution.
    """
    start_date, end_date = parse_date_range(range_str, start_date_str, end_date_str)
    
    # Generate daily list
    date_list: List[datetime.date] = []
    curr = start_date
    while curr <= end_date:
        date_list.append(curr)
        curr += datetime.timedelta(days=1)

    start_iso = start_date.isoformat()
    end_iso = end_date.isoformat()

    # Load active accounts
    with get_db(is_write=False) as conn:
        accounts = conn.execute("SELECT id, name, type, institution FROM accounts WHERE is_active = 1").fetchall()
        account_map = {a["id"]: dict(a) for a in accounts}

        # Snapshots for CASH & CREDIT
        snapshots_raw = conn.execute("""
            SELECT account_id, as_of_date, balance
            FROM balance_snapshots
            WHERE as_of_date <= ?
            ORDER BY as_of_date ASC
        """, (end_iso,)).fetchall()

        # Holdings for BROKERAGE
        holdings_raw = conn.execute("""
            SELECT account_id, as_of_date, asset_type, ticker, shares
            FROM brokerage_holdings
            WHERE as_of_date <= ?
            ORDER BY as_of_date ASC
        """, (end_iso,)).fetchall()

    # Organize snapshots by account: account_id -> list of (as_of_date, balance)
    acc_snapshots: Dict[int, List[Tuple[str, float]]] = {}
    for s in snapshots_raw:
        acc_snapshots.setdefault(s["account_id"], []).append((s["as_of_date"], float(s["balance"])))

    # Organize holdings by account: account_id -> as_of_date -> list of holding dicts
    acc_holdings: Dict[int, Dict[str, List[Dict]]] = {}
    tickers_needed: Set[str] = set()
    for h in holdings_raw:
        acc_id = h["account_id"]
        d = h["as_of_date"]
        ticker = h["ticker"].upper()
        if h["asset_type"] == "EQUITY" and ticker != "CASH":
            tickers_needed.add(ticker)
        acc_holdings.setdefault(acc_id, {}).setdefault(d, []).append({
            "asset_type": h["asset_type"],
            "ticker": ticker,
            "shares": float(h["shares"])
        })

    # Pre-fetch cached prices and forward fill
    price_map = get_price_map(list(tickers_needed), end_iso)

    # Reconstruct daily valuations
    daily_records: List[Dict[str, Any]] = []
    account_series: Dict[int, List[Dict[str, Any]]] = {acc_id: [] for acc_id in account_map.keys()}

    for d in date_list:
        d_str = d.isoformat()
        day_cash_assets = 0.0
        day_equity_assets = 0.0
        day_credit_debt = 0.0
        day_account_balances: Dict[int, float] = {}

        for acc_id, acc in account_map.items():
            acc_type = acc["type"]
            acc_val = 0.0

            if acc_type in ("CASH", "CREDIT"):
                snaps = acc_snapshots.get(acc_id, [])
                # Find most recent snapshot on or before d_str
                valid_snaps = [s for s in snaps if s[0] <= d_str]
                if valid_snaps:
                    latest_snap = valid_snaps[-1]
                    bal = latest_snap[1]
                    acc_val = bal
                    if acc_type == "CASH":
                        day_cash_assets += max(0.0, bal)
                    elif acc_type == "CREDIT":
                        # Stored as negative. If bal is negative, credit debt is abs(bal)
                        if bal < 0:
                            day_credit_debt += abs(bal)
                        else:
                            # positive credit balance is cash-like credit
                            day_cash_assets += bal
                else:
                    acc_val = 0.0

            elif acc_type == "BROKERAGE":
                holdings_by_date = acc_holdings.get(acc_id, {})
                valid_dates = [snap_d for snap_d in holdings_by_date.keys() if snap_d <= d_str]
                if valid_dates:
                    latest_date = max(valid_dates)
                    holdings_list = holdings_by_date[latest_date]
                    brok_total = 0.0
                    for item in holdings_list:
                        t = item["ticker"]
                        sh = item["shares"]
                        if item["asset_type"] == "CASH" or t == "CASH":
                            item_val = sh * 1.0
                            day_cash_assets += item_val
                        else:
                            price = lookup_forward_filled_price(t, d_str, price_map.get(t, {}))
                            item_val = sh * price
                            day_equity_assets += item_val
                        brok_total += item_val
                    acc_val = brok_total
                else:
                    acc_val = 0.0

            day_account_balances[acc_id] = round(acc_val, 2)
            account_series[acc_id].append({
                "date": d_str,
                "balance": round(acc_val, 2)
            })

        total_assets = day_cash_assets + day_equity_assets
        total_liabilities = day_credit_debt
        total_net_worth = total_assets - total_liabilities

        daily_records.append({
            "date": d_str,
            "net_worth": round(total_net_worth, 2),
            "total_assets": round(total_assets, 2),
            "total_liabilities": round(total_liabilities, 2),
            "cash_assets": round(day_cash_assets, 2),
            "equity_assets": round(day_equity_assets, 2),
            "credit_debt": round(day_credit_debt, 2),
            "account_balances": day_account_balances
        })

    # Period summary KPIs
    start_point = daily_records[0] if daily_records else None
    end_point = daily_records[-1] if daily_records else None

    current_net_worth = end_point["net_worth"] if end_point else 0.0
    start_net_worth = start_point["net_worth"] if start_point else 0.0
    period_change_dollars = round(current_net_worth - start_net_worth, 2)
    period_change_percent = (
        round((period_change_dollars / abs(start_net_worth)) * 100, 2)
        if start_net_worth and abs(start_net_worth) > 0.001
        else 0.0
    )

    total_assets = end_point["total_assets"] if end_point else 0.0
    total_liabilities = end_point["total_liabilities"] if end_point else 0.0
    current_cash = end_point["cash_assets"] if end_point else 0.0
    current_equity = end_point["equity_assets"] if end_point else 0.0

    asset_allocation = {
        "cash": {
            "amount": round(current_cash, 2),
            "percent": round((current_cash / total_assets) * 100, 2) if total_assets > 0 else 0.0
        },
        "equities": {
            "amount": round(current_equity, 2),
            "percent": round((current_equity / total_assets) * 100, 2) if total_assets > 0 else 0.0
        },
        "debt": {
            "amount": round(total_liabilities, 2),
            "percent": round((total_liabilities / total_assets) * 100, 2) if total_assets > 0 else 0.0
        }
    }

    # Attribution Analysis between start_date and end_date
    attribution = compute_attribution(
        start_date_str=start_iso,
        end_date_str=end_iso,
        account_map=account_map,
        acc_snapshots=acc_snapshots,
        acc_holdings=acc_holdings,
        price_map=price_map,
        net_worth_change=period_change_dollars
    )

    return {
        "range": range_str,
        "start_date": start_iso,
        "end_date": end_iso,
        "summary": {
            "current_net_worth": current_net_worth,
            "start_net_worth": start_net_worth,
            "period_change_dollars": period_change_dollars,
            "period_change_percent": period_change_percent,
            "total_assets": round(total_assets, 2),
            "total_liabilities": round(total_liabilities, 2),
            "asset_allocation": asset_allocation
        },
        "attribution": attribution,
        "daily_history": daily_records,
        "account_series": account_series,
        "accounts": list(account_map.values())
    }

def compute_attribution(
    start_date_str: str,
    end_date_str: str,
    account_map: Dict[int, Dict],
    acc_snapshots: Dict[int, List[Tuple[str, float]]],
    acc_holdings: Dict[int, Dict[str, List[Dict]]],
    price_map: Dict[str, Dict[str, float]],
    net_worth_change: float
) -> Dict[str, Any]:
    """
    Computes exact period-over-period change attribution:
    1. Market Price Movement ($): S_0 * (P_1 - P_0)
    2. Net Share Additions/Inflows ($): (S_1 - S_0) * P_1
    3. Cash Balance Changes ($): Delta Cash accounts + Delta Brokerage Cash
    4. Credit Balance Changes ($): Credit_1 - Credit_0 (reduction in debt is positive impact)
    """
    cash_change = 0.0
    credit_change = 0.0
    brokerage_cash_change = 0.0
    market_price_movement = 0.0
    share_additions = 0.0

    for acc_id, acc in account_map.items():
        acc_type = acc["type"]

        if acc_type == "CASH":
            snaps = acc_snapshots.get(acc_id, [])
            v_start = [s[1] for s in snaps if s[0] <= start_date_str]
            v_end = [s[1] for s in snaps if s[0] <= end_date_str]
            bal_0 = v_start[-1] if v_start else 0.0
            bal_1 = v_end[-1] if v_end else 0.0
            cash_change += (bal_1 - bal_0)

        elif acc_type == "CREDIT":
            snaps = acc_snapshots.get(acc_id, [])
            v_start = [s[1] for s in snaps if s[0] <= start_date_str]
            v_end = [s[1] for s in snaps if s[0] <= end_date_str]
            # Since credit balance is stored negative, bal_1 - bal_0 gives exact impact on net worth!
            # e.g., debt goes from -5000 to -3000 -> -3000 - (-5000) = +2000
            bal_0 = v_start[-1] if v_start else 0.0
            bal_1 = v_end[-1] if v_end else 0.0
            credit_change += (bal_1 - bal_0)

        elif acc_type == "BROKERAGE":
            holdings_by_date = acc_holdings.get(acc_id, {})
            dates_0 = [d for d in holdings_by_date.keys() if d <= start_date_str]
            dates_1 = [d for d in holdings_by_date.keys() if d <= end_date_str]

            holdings_0_map: Dict[str, float] = {}
            if dates_0:
                latest_d0 = max(dates_0)
                for h in holdings_by_date[latest_d0]:
                    holdings_0_map[h["ticker"]] = h["shares"]

            holdings_1_map: Dict[str, float] = {}
            if dates_1:
                latest_d1 = max(dates_1)
                for h in holdings_by_date[latest_d1]:
                    holdings_1_map[h["ticker"]] = h["shares"]

            all_tickers = set(holdings_0_map.keys()).union(set(holdings_1_map.keys()))
            for t in all_tickers:
                s0 = holdings_0_map.get(t, 0.0)
                s1 = holdings_1_map.get(t, 0.0)
                if t == "CASH":
                    brokerage_cash_change += (s1 - s0)
                else:
                    p0 = lookup_forward_filled_price(t, start_date_str, price_map.get(t, {}))
                    p1 = lookup_forward_filled_price(t, end_date_str, price_map.get(t, {}))
                    # Standard portfolio attribution:
                    # S0 * (P1 - P0) is market movement
                    # (S1 - S0) * P1 is net share additions / contributions
                    market_delta = s0 * (p1 - p0)
                    shares_delta = (s1 - s0) * p1
                    market_price_movement += market_delta
                    share_additions += shares_delta

    total_cash_change = cash_change + brokerage_cash_change

    # Round results
    mkt = round(market_price_movement, 2)
    shares = round(share_additions, 2)
    cash = round(total_cash_change, 2)
    credit = round(credit_change, 2)
    total_attributed = round(mkt + shares + cash + credit, 2)

    # Any minor 1-cent rounding adjustment
    discrepancy = round(net_worth_change - total_attributed, 2)
    if abs(discrepancy) == 0.01:
        mkt = round(mkt + discrepancy, 2)
        total_attributed = net_worth_change

    return {
        "market_price_movement": mkt,
        "net_share_additions": shares,
        "cash_balance_changes": cash,
        "credit_balance_changes": credit,
        "total_attributed": total_attributed,
        "net_worth_change": net_worth_change,
        "details": {
            "cash_accounts_change": round(cash_change, 2),
            "brokerage_cash_change": round(brokerage_cash_change, 2)
        }
    }

def get_account_detail_analytics(
    account_id: int,
    range_str: Optional[str] = "1M",
    start_date_str: Optional[str] = None,
    end_date_str: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Returns individual account balance history over time, period high/low,
    period change ($ and %), and for brokerage accounts: per-ticker market value,
    weight %, and cash vs equity split.
    """
    with get_db(is_write=False) as conn:
        acc = conn.execute("SELECT id, name, type, institution, is_active FROM accounts WHERE id = ?", (account_id,)).fetchone()
        if not acc:
            return None
        acc_dict = dict(acc)

    start_date, end_date = parse_date_range(range_str, start_date_str, end_date_str)
    start_iso = start_date.isoformat()
    end_iso = end_date.isoformat()

    # Generate daily list
    date_list = []
    curr = start_date
    while curr <= end_date:
        date_list.append(curr.isoformat())
        curr += datetime.timedelta(days=1)

    daily_balances: List[Dict[str, Any]] = []
    holdings_breakdown: List[Dict[str, Any]] = []
    cash_equity_split = {"cash_amount": 0.0, "equity_amount": 0.0, "cash_percent": 0.0, "equity_percent": 0.0}

    with get_db(is_write=False) as conn:
        if acc_dict["type"] in ("CASH", "CREDIT"):
            snaps = conn.execute("""
                SELECT as_of_date, balance, note
                FROM balance_snapshots
                WHERE account_id = ? AND as_of_date <= ?
                ORDER BY as_of_date ASC
            """, (account_id, end_iso)).fetchall()
            snap_list = [(s["as_of_date"], float(s["balance"])) for s in snaps]

            for d in date_list:
                valid = [s for s in snap_list if s[0] <= d]
                b = valid[-1][1] if valid else 0.0
                daily_balances.append({"date": d, "balance": round(b, 2)})

        elif acc_dict["type"] == "BROKERAGE":
            holdings = conn.execute("""
                SELECT as_of_date, asset_type, ticker, shares
                FROM brokerage_holdings
                WHERE account_id = ? AND as_of_date <= ?
                ORDER BY as_of_date ASC
            """, (account_id, end_iso)).fetchall()

            holdings_by_date: Dict[str, List[Dict]] = {}
            tickers = set()
            for h in holdings:
                t = h["ticker"].upper()
                if h["asset_type"] == "EQUITY" and t != "CASH":
                    tickers.add(t)
                holdings_by_date.setdefault(h["as_of_date"], []).append({
                    "asset_type": h["asset_type"],
                    "ticker": t,
                    "shares": float(h["shares"])
                })

            price_map = get_price_map(list(tickers), end_iso)

            for d in date_list:
                valid_dates = [snap_d for snap_d in holdings_by_date.keys() if snap_d <= d]
                if valid_dates:
                    latest_d = max(valid_dates)
                    day_tot = 0.0
                    for h in holdings_by_date[latest_d]:
                        t = h["ticker"]
                        sh = h["shares"]
                        if h["asset_type"] == "CASH" or t == "CASH":
                            day_tot += sh
                        else:
                            pr = lookup_forward_filled_price(t, d, price_map.get(t, {}))
                            day_tot += (sh * pr)
                    daily_balances.append({"date": d, "balance": round(day_tot, 2)})
                else:
                    daily_balances.append({"date": d, "balance": 0.0})

            # Calculate current holdings breakdown at end_iso
            valid_end_dates = [snap_d for snap_d in holdings_by_date.keys() if snap_d <= end_iso]
            if valid_end_dates:
                latest_date = max(valid_end_dates)
                current_holdings = holdings_by_date[latest_date]
                total_val = 0.0
                items = []

                for h in current_holdings:
                    t = h["ticker"]
                    sh = h["shares"]
                    if h["asset_type"] == "CASH" or t == "CASH":
                        pr = 1.0
                        mv = sh
                        cash_equity_split["cash_amount"] += mv
                    else:
                        pr = lookup_forward_filled_price(t, end_iso, price_map.get(t, {}))
                        mv = sh * pr
                        cash_equity_split["equity_amount"] += mv
                    total_val += mv
                    items.append({
                        "ticker": t,
                        "asset_type": h["asset_type"],
                        "shares": round(sh, 4),
                        "price": round(pr, 4),
                        "market_value": round(mv, 2)
                    })

                # Calculate weights
                for it in items:
                    it["weight_percent"] = round((it["market_value"] / total_val) * 100, 2) if total_val > 0 else 0.0
                
                holdings_breakdown = sorted(items, key=lambda x: x["market_value"], reverse=True)

                if total_val > 0:
                    cash_equity_split["cash_percent"] = round((cash_equity_split["cash_amount"] / total_val) * 100, 2)
                    cash_equity_split["equity_percent"] = round((cash_equity_split["equity_amount"] / total_val) * 100, 2)

    # Compute period high, low, change
    balances_only = [b["balance"] for b in daily_balances]
    period_high = max(balances_only) if balances_only else 0.0
    period_low = min(balances_only) if balances_only else 0.0
    start_b = balances_only[0] if balances_only else 0.0
    end_b = balances_only[-1] if balances_only else 0.0
    change_dollars = round(end_b - start_b, 2)
    change_percent = round((change_dollars / abs(start_b)) * 100, 2) if start_b and abs(start_b) > 0.001 else 0.0

    return {
        "account": acc_dict,
        "range": range_str,
        "start_date": start_iso,
        "end_date": end_iso,
        "current_balance": end_b,
        "start_balance": start_b,
        "period_change_dollars": change_dollars,
        "period_change_percent": change_percent,
        "period_high": period_high,
        "period_low": period_low,
        "daily_history": daily_balances,
        "holdings_breakdown": holdings_breakdown,
        "cash_equity_split": cash_equity_split
    }
