import os
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
from app.config import DB_PATH, BACKUP_DIR, MAX_BACKUPS

def should_run_monthly_backup() -> bool:
    """
    Checks if a backup has already been created for the current calendar month (YYYY-MM).
    """
    if not BACKUP_DIR.exists():
        return True
    current_month_prefix = datetime.now().strftime("finance_%Y-%m")
    existing_month_backups = list(BACKUP_DIR.glob(f"{current_month_prefix}*.db"))
    return len(existing_month_backups) == 0

def create_backup(force: bool = False) -> Optional[str]:
    """
    Creates an automatic backup of the SQLite database at most once per calendar month.
    Manual / forced backups bypass the monthly limit.
    Retains the last MAX_BACKUPS (default 12 monthly snapshots).
    """
    if not DB_PATH.exists() or DB_PATH.stat().st_size == 0:
        return None

    # Only create automatic backup if no backup exists yet for this month
    if not force and not should_run_monthly_backup():
        return None

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    if force:
        timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        backup_filename = f"finance_{timestamp}_manual.db"
    else:
        month_str = datetime.now().strftime("%Y-%m")
        backup_filename = f"finance_{month_str}.db"

    backup_file = BACKUP_DIR / backup_filename

    try:
        shutil.copy2(DB_PATH, backup_file)
        cleanup_old_backups()
        return str(backup_file)
    except Exception as e:
        print(f"[Backup Error] Failed to create backup: {e}")
        return None

def cleanup_old_backups(keep_count: int = MAX_BACKUPS):
    """
    Enforces backup retention policy, keeping the last `keep_count` backups (default 12 months).
    """
    try:
        if not BACKUP_DIR.exists():
            return
        
        backups = sorted(
            [f for f in BACKUP_DIR.glob("finance_*.db") if f.is_file()],
            key=lambda f: f.stat().st_mtime
        )

        if len(backups) > keep_count:
            excess = len(backups) - keep_count
            for f in backups[:excess]:
                try:
                    f.unlink()
                except Exception as del_err:
                    print(f"[Backup Cleanup] Could not delete old backup {f.name}: {del_err}")
    except Exception as e:
        print(f"[Backup Cleanup Error] {e}")

def list_backups() -> List[Dict]:
    """
    Returns metadata for all available backups.
    """
    if not BACKUP_DIR.exists():
        return []
    
    files = sorted(
        [f for f in BACKUP_DIR.glob("finance_*.db") if f.is_file()],
        key=lambda f: f.stat().st_mtime,
        reverse=True
    )
    result = []
    for f in files:
        stat = f.stat()
        result.append({
            "filename": f.name,
            "path": str(f),
            "size_bytes": stat.st_size,
            "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
        })
    return result

def restore_backup(backup_path: str) -> bool:
    """
    Safely restores DB_PATH from a chosen backup snapshot file.
    """
    source = Path(backup_path)
    if not source.exists():
        return False
    try:
        # Create a safety backup of current state before overwrite
        create_backup(force=True)

        # Remove WAL and SHM journal files
        wal_file = Path(str(DB_PATH) + "-wal")
        shm_file = Path(str(DB_PATH) + "-shm")
        if wal_file.exists():
            wal_file.unlink()
        if shm_file.exists():
            shm_file.unlink()

        # Copy snapshot to DB_PATH
        shutil.copy2(str(source), str(DB_PATH))

        # Reconnect and ensure WAL mode
        conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.close()
        return True
    except Exception as e:
        print(f"[Restore Error] Failed to restore from {backup_path}: {e}")
        return False
