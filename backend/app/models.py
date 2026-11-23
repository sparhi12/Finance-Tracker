from typing import Literal, Optional, List
from pydantic import BaseModel, Field, field_validator

AccountType = Literal["CASH", "BROKERAGE", "CREDIT"]
AssetType = Literal["EQUITY", "CASH"]

# Account Models
class AccountBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: AccountType
    institution: str = Field(..., min_length=1, max_length=100)
    is_active: bool = True

class AccountCreate(AccountBase):
    pass

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[AccountType] = None
    institution: Optional[str] = None
    is_active: Optional[bool] = None

class AccountResponse(AccountBase):
    id: int
    created_at: str
    latest_balance: Optional[float] = None
    latest_as_of_date: Optional[str] = None

# Balance Snapshot Models
class BalanceSnapshotCreate(BaseModel):
    account_id: int
    as_of_date: str  # YYYY-MM-DD
    balance: float
    note: Optional[str] = None

    @field_validator("as_of_date")
    def validate_date(cls, v: str) -> str:
        # Simple ISO date validation
        parts = v.split("-")
        if len(parts) != 3:
            raise ValueError("Date must be in YYYY-MM-DD format")
        return v

class BalanceSnapshotResponse(BaseModel):
    id: int
    account_id: int
    as_of_date: str
    balance: float
    note: Optional[str] = None

# Brokerage Holdings Models
class BrokerageHoldingItem(BaseModel):
    asset_type: AssetType = "EQUITY"
    ticker: str
    shares: float

    @field_validator("ticker")
    def clean_ticker(cls, v: str) -> str:
        return v.strip().upper()

class BrokerageHoldingsSnapshotCreate(BaseModel):
    account_id: int
    as_of_date: str
    holdings: List[BrokerageHoldingItem]

class BrokerageHoldingResponse(BaseModel):
    id: int
    account_id: int
    as_of_date: str
    asset_type: AssetType
    ticker: str
    shares: float
    price: Optional[float] = 1.0
    market_value: Optional[float] = 0.0

# Frictionless Data Review Entry Models
class QuickReviewAccountData(BaseModel):
    account_id: int
    as_of_date: str
    # If Cash or Credit:
    balance: Optional[float] = None
    note: Optional[str] = None
    # If Brokerage:
    holdings: Optional[List[BrokerageHoldingItem]] = None

class QuickReviewBatchSubmit(BaseModel):
    items: List[QuickReviewAccountData]

# Ticker Price Models
class TickerPriceResponse(BaseModel):
    ticker: str
    date: str
    close_price: float

# Transaction Models
class TransactionBase(BaseModel):
    account_id: int
    date: str
    merchant: str
    amount: float
    category: Optional[str] = "Uncategorized"
    is_transfer: bool = False
    note: Optional[str] = None

class TransactionCreate(TransactionBase):
    pass

class TransactionResponse(TransactionBase):
    id: int
