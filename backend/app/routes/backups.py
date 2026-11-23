from fastapi import APIRouter
from app.backup_service import list_backups, create_backup
from app.config import DB_PATH, BACKUP_DIR, MAX_BACKUPS

router = APIRouter(prefix="/api/backups", tags=["Backups"])

@router.get("")
def get_backups():
    return {
        "db_path": str(DB_PATH),
        "backup_dir": str(BACKUP_DIR),
        "max_backups": MAX_BACKUPS,
        "backups": list_backups()
    }

@router.post("/create")
def trigger_backup():
    file_path = create_backup(force=True)
    return {
        "message": "Backup created successfully" if file_path else "No DB found to backup",
        "backup_file": file_path
    }
