import os
import uuid
import json
from typing import Optional
from db.database import get_db, BASE_DIR

STORAGE_ROOT = os.path.join(BASE_DIR, "storage", "users")

def get_user_storage_dir(user_id: str, subfolder: str = "") -> str:
    """Gets or creates the directory for a user's files."""
    user_dir = os.path.join(STORAGE_ROOT, user_id)
    if subfolder:
        target = os.path.join(user_dir, subfolder)
    else:
        target = user_dir
    os.makedirs(target, exist_ok=True)
    return target

def recalculate_user_storage(conn, user_id: str) -> int:
    """Recalculates and updates the total storage used by a user."""
    proj_size = conn.execute(
        "SELECT COALESCE(SUM(size_bytes), 0) as total FROM projects WHERE user_id = ?",
        (user_id,)
    ).fetchone()["total"]
    
    asset_size = conn.execute(
        "SELECT COALESCE(SUM(size_bytes), 0) as total FROM user_assets WHERE user_id = ?",
        (user_id,)
    ).fetchone()["total"]
    
    total = int(proj_size + asset_size)
    conn.execute("UPDATE users SET storage_used_bytes = ? WHERE id = ?", (total, user_id))
    return total

def check_quota(conn, user_id: str, additional_bytes: int):
    """Raises ValueError if adding bytes exceeds the user's storage quota."""
    user = conn.execute("SELECT storage_used_bytes, storage_quota_bytes FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        raise ValueError("المستخدم غير موجود")
    used = user["storage_used_bytes"]
    quota = user["storage_quota_bytes"]
    if (used + additional_bytes) > quota:
        avail_mb = max(0, (quota - used) / (1024 * 1024))
        needed_mb = additional_bytes / (1024 * 1024)
        raise ValueError(f"تم تجاوز سعة التخزين المتاحة. المتبقي: {avail_mb:.1f} ميغابايت، الحجم المطلوب: {needed_mb:.1f} ميغابايت")

# ----------------- Project Management -----------------

def save_project(
    user_id: str,
    title: str,
    doc_width: int,
    doc_height: int,
    layers_data: str,
    thumbnail_url: str,
    project_id: Optional[str] = None
) -> dict:
    """Saves or updates a project for the given user."""
    size_bytes = len(layers_data.encode("utf-8")) + len(thumbnail_url.encode("utf-8"))
    
    with get_db() as conn:
        if project_id:
            # Update existing
            existing = conn.execute(
                "SELECT id, size_bytes FROM projects WHERE id = ? AND user_id = ?",
                (project_id, user_id)
            ).fetchone()
            if not existing:
                raise ValueError("المشروع غير موجود أو لا تملك صلاحية تعديله")
                
            delta_bytes = size_bytes - existing["size_bytes"]
            if delta_bytes > 0:
                check_quota(conn, user_id, delta_bytes)
                
            conn.execute(
                """
                UPDATE projects
                SET title = ?, doc_width = ?, doc_height = ?, layers_data = ?, thumbnail_url = ?, size_bytes = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
                """,
                (title, doc_width, doc_height, layers_data, thumbnail_url, size_bytes, project_id, user_id)
            )
            saved_id = project_id
        else:
            # Create new
            check_quota(conn, user_id, size_bytes)
            saved_id = str(uuid.uuid4())
            conn.execute(
                """
                INSERT INTO projects (id, user_id, title, doc_width, doc_height, layers_data, thumbnail_url, size_bytes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (saved_id, user_id, title, doc_width, doc_height, layers_data, thumbnail_url, size_bytes)
            )
            
        total_used = recalculate_user_storage(conn, user_id)
        
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (saved_id,)).fetchone()
        return {
            "id": row["id"],
            "title": row["title"],
            "docWidth": row["doc_width"],
            "docHeight": row["doc_height"],
            "thumbnailUrl": row["thumbnail_url"],
            "sizeBytes": row["size_bytes"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
            "storageUsedBytes": total_used
        }

def list_projects(user_id: str) -> list[dict]:
    """Lists summary info for all projects belonging to user (fast, without full layer data)."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, title, doc_width, doc_height, thumbnail_url, size_bytes, created_at, updated_at
            FROM projects
            WHERE user_id = ?
            ORDER BY updated_at DESC
            """,
            (user_id,)
        ).fetchall()
        
        return [
            {
                "id": r["id"],
                "title": r["title"],
                "docWidth": r["doc_width"],
                "docHeight": r["doc_height"],
                "thumbnailUrl": r["thumbnail_url"],
                "sizeBytes": r["size_bytes"],
                "createdAt": r["created_at"],
                "updatedAt": r["updated_at"]
            }
            for r in rows
        ]

def get_project(user_id: str, project_id: str) -> Optional[dict]:
    """Loads a full project including layers_data for the user."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM projects WHERE id = ? AND user_id = ?",
            (project_id, user_id)
        ).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "title": row["title"],
            "docWidth": row["doc_width"],
            "docHeight": row["doc_height"],
            "thumbnailUrl": row["thumbnail_url"],
            "layersData": row["layers_data"],
            "sizeBytes": row["size_bytes"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"]
        }

def delete_project(user_id: str, project_id: str) -> bool:
    """Deletes a project and recalculates storage."""
    with get_db() as conn:
        res = conn.execute(
            "DELETE FROM projects WHERE id = ? AND user_id = ?",
            (project_id, user_id)
        )
        if res.rowcount > 0:
            recalculate_user_storage(conn, user_id)
            return True
        return False

# ----------------- Vault Assets Management -----------------

def save_user_asset(user_id: str, filename: str, content: bytes, mime_type: str) -> dict:
    """Saves an image asset to the user's private vault on disk and records in DB."""
    size_bytes = len(content)
    
    with get_db() as conn:
        check_quota(conn, user_id, size_bytes)
        
        asset_id = str(uuid.uuid4())
        user_assets_dir = get_user_storage_dir(user_id, "assets")
        
        # Clean safe filename
        safe_name = os.path.basename(filename).replace(" ", "_")
        stored_filename = f"{asset_id}_{safe_name}"
        file_path = os.path.join(user_assets_dir, stored_filename)
        
        with open(file_path, "wb") as f:
            f.write(content)
            
        conn.execute(
            """
            INSERT INTO user_assets (id, user_id, filename, file_path, mime_type, size_bytes)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (asset_id, user_id, filename, file_path, mime_type, size_bytes)
        )
        
        total_used = recalculate_user_storage(conn, user_id)
        
        return {
            "id": asset_id,
            "filename": filename,
            "url": f"/api/assets/{asset_id}/raw",
            "sizeBytes": size_bytes,
            "mimeType": mime_type,
            "storageUsedBytes": total_used
        }

def list_user_assets(user_id: str) -> list[dict]:
    """Lists all assets in user's vault."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM user_assets WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        ).fetchall()
        
        return [
            {
                "id": r["id"],
                "filename": r["filename"],
                "url": f"/api/assets/{r['id']}/raw",
                "sizeBytes": r["size_bytes"],
                "mimeType": r["mime_type"],
                "createdAt": r["created_at"]
            }
            for r in rows
        ]

def get_asset_file(user_id: str, asset_id: str) -> Optional[tuple[str, str, str]]:
    """Returns (file_path, filename, mime_type) for an asset."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM user_assets WHERE id = ? AND user_id = ?",
            (asset_id, user_id)
        ).fetchone()
        if not row or not os.path.exists(row["file_path"]):
            return None
        return row["file_path"], row["filename"], row["mime_type"]

def delete_user_asset(user_id: str, asset_id: str) -> bool:
    """Deletes an asset from disk and DB."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT file_path FROM user_assets WHERE id = ? AND user_id = ?",
            (asset_id, user_id)
        ).fetchone()
        if not row:
            return False
            
        file_path = row["file_path"]
        conn.execute("DELETE FROM user_assets WHERE id = ? AND user_id = ?", (asset_id, user_id))
        recalculate_user_storage(conn, user_id)
        
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
    except Exception:
        pass
        
    return True
