import os
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
from app.config import DB_PATH, BACKUP_DIR, MAX_BACKUPS

_last_backup_time = 0.0

def create_backup(force: bool = False, min_interval_seconds: float = 2.0) -> Optional[str]:
    """
    Creates an automatic backup of the SQLite database before write operations.
    Retains the last MAX_BACKUPS (default 30).
    """
    global _last_backup_time
    now_ts = time.time()

    # Skip if less than min_interval_seconds has elapsed, unless forced
    if not force and (now_ts - _last_backup_time < min_interval_seconds):
        return None

    if not DB_PATH.exists() or DB_PATH.stat().st_size == 0:
        return None

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    backup_filename = f"finance_{timestamp}.db"
    backup_file = BACKUP_DIR / backup_filename

    # If file with same timestamp exists (rapid calls in same second), append a millisecond suffix
    if backup_file.exists():
        ms = int(datetime.now().microsecond / 1000)
        backup_filename = f"finance_{timestamp}_{ms:03d}.db"
        backup_file = BACKUP_DIR / backup_filename

    try:
        shutil.copy2(DB_PATH, backup_file)
        _last_backup_time = now_ts
        cleanup_old_backups()
        return str(backup_file)
    except Exception as e:
        print(f"[Backup Error] Failed to create backup: {e}")
        return None

def cleanup_old_backups(keep_count: int = MAX_BACKUPS):
    """
    Enforces backup retention policy, keeping the last `keep_count` backups.
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
