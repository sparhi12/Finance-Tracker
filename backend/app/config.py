import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root or backend dir
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if not env_path.exists():
    env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

def get_storage_paths():
    # Primary DB path configurable via .env, default D:\finance\finance.db
    db_path_str = os.getenv("DB_PATH", r"D:\finance\finance.db")
    backup_dir_str = os.getenv("BACKUP_DIR", r"D:\finance\backups")

    db_path = Path(db_path_str)
    backup_dir = Path(backup_dir_str)

    try:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        backup_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        # Fallback to local data dir if D: drive is not writable or absent
        fallback_dir = Path(__file__).resolve().parent.parent.parent / "data"
        fallback_dir.mkdir(parents=True, exist_ok=True)
        backup_fallback = fallback_dir / "backups"
        backup_fallback.mkdir(parents=True, exist_ok=True)
        print(f"[Config Warning] Could not access '{db_path.parent}' ({e}). Falling back to '{fallback_dir}'")
        db_path = fallback_dir / "finance.db"
        backup_dir = backup_fallback

    return db_path, backup_dir

DB_PATH, BACKUP_DIR = get_storage_paths()
MAX_BACKUPS = int(os.getenv("MAX_BACKUPS", "12"))

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "*"
]
