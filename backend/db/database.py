import sqlite3
import os
from contextlib import contextmanager

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "vision_studio.db")

def init_db():
    """Ensure data directory and database tables exist."""
    os.makedirs(DATA_DIR, exist_ok=True)
    with get_db() as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        
        # 1. Users Table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            avatar_color TEXT DEFAULT '#a855f7',
            storage_used_bytes INTEGER DEFAULT 0,
            storage_quota_bytes INTEGER DEFAULT 157286400,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 2. Projects Table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            thumbnail_url TEXT,
            doc_width INTEGER NOT NULL,
            doc_height INTEGER NOT NULL,
            layers_data TEXT NOT NULL,
            size_bytes INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """)

        # Index on user_id for fast project lookups
        conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
        """)

        # 3. User Assets Table (Vault)
        conn.execute("""
        CREATE TABLE IF NOT EXISTS user_assets (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """)

        conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_assets_user_id ON user_assets(user_id);
        """)

@contextmanager
def get_db():
    """Context manager for thread-safe SQLite connection with dict-like row factory."""
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
