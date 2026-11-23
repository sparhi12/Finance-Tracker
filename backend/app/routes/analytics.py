from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.engine import reconstruct_time_series, get_account_detail_analytics

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.get("/net-worth")
def get_net_worth_analytics(
    range: Optional[str] = Query("1M", description="1M, 3M, YTD, 1Y, ALL, or custom"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD for custom range"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD for custom range")
):
    try:
        data = reconstruct_time_series(range_str=range, start_date_str=start_date, end_date_str=end_date)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute net worth time series: {str(e)}")

@router.get("/account/{account_id}")
def get_account_analytics(
    account_id: int,
    range: Optional[str] = Query("1M", description="1M, 3M, YTD, 1Y, ALL, or custom"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD for custom range"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD for custom range")
):
    data = get_account_detail_analytics(
        account_id=account_id,
        range_str=range,
        start_date_str=start_date,
        end_date_str=end_date
    )
    if not data:
        raise HTTPException(status_code=404, detail="Account not found")
    return data
