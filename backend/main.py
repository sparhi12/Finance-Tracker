from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import CORS_ORIGINS, DB_PATH, BACKUP_DIR
from app.database import init_db
from app.price_service import startup_price_sync, ensure_cash_price
from app.routes.accounts import router as accounts_router
from app.routes.snapshots import router as snapshots_router
from app.routes.prices import router as prices_router
from app.routes.analytics import router as analytics_router
from app.routes.transactions import router as transactions_router
from app.routes.backups import router as backups_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema & WAL mode
    init_db()
    ensure_cash_price()
    # Startup price sync for active equities
    try:
        startup_price_sync()
    except Exception as e:
        print(f"[Startup Warning] Price sync skipped or failed: {e}")
    yield

app = FastAPI(
    title="Local-First Personal Finance & Net Worth Tracker",
    description="Offline-capable local-first finance manager with daily time-series reconstruction",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(accounts_router)
app.include_router(snapshots_router)
app.include_router(prices_router)
app.include_router(analytics_router)
app.include_router(transactions_router)
app.include_router(backups_router)

@app.get("/")
def root():
    return {
        "app": "Local-First Personal Finance Tracker",
        "status": "online",
        "db_path": str(DB_PATH),
        "backup_dir": str(BACKUP_DIR),
        "docs": "/docs"
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "db_exists": DB_PATH.exists()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
