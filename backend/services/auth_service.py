import os
import uuid
import hmac
import hashlib
import json
import base64
import time
import secrets
from typing import Optional
from db.database import get_db, BASE_DIR

SECRET_FILE = os.path.join(BASE_DIR, "data", ".secret_key")

def get_or_create_secret_key() -> bytes:
    """Retrieve or generate a persistent secret key for token signing."""
    if os.path.exists(SECRET_FILE):
        try:
            with open(SECRET_FILE, "rb") as f:
                key = f.read().strip()
                if len(key) >= 32:
                    return key
        except Exception:
            pass
    
    os.makedirs(os.path.dirname(SECRET_FILE), exist_ok=True)
    new_key = secrets.token_bytes(48)
    try:
        with open(SECRET_FILE, "wb") as f:
            f.write(new_key)
    except Exception:
        pass
    return new_key

SECRET_KEY = get_or_create_secret_key()

AVATAR_COLORS = [
    "#a855f7", # Violet
    "#38bdf8", # Sky
    "#ec4899", # Pink
    "#10b981", # Emerald
    "#f59e0b", # Amber
    "#6366f1", # Indigo
    "#14b8a6", # Teal
    "#f43f5e", # Rose
]

def hash_password(password: str, salt: Optional[bytes] = None) -> tuple[str, str]:
    """Hashes a password using PBKDF2-HMAC-SHA256 with 200,000 rounds."""
    if salt is None:
        salt = secrets.token_bytes(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
    return hashed.hex(), salt.hex()

def verify_password(password: str, stored_hash: str, salt_hex: str) -> bool:
    """Verifies a password against the stored hash and salt."""
    salt = bytes.fromhex(salt_hex)
    computed_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(computed_hash, stored_hash)

def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

def b64url_decode(data: str) -> bytes:
    padding = 4 - (len(data) % 4)
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data.encode("utf-8"))

def generate_token(user_id: str, email: str, username: str, expires_in_days: int = 7) -> str:
    """Creates a signed HMAC-SHA256 token containing user claims."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "email": email,
        "username": username,
        "exp": int(time.time()) + (expires_in_days * 86400),
        "iat": int(time.time())
    }
    
    header_part = b64url_encode(json.dumps(header).encode("utf-8"))
    payload_part = b64url_encode(json.dumps(payload).encode("utf-8"))
    message = f"{header_part}.{payload_part}".encode("utf-8")
    
    signature = hmac.new(SECRET_KEY, message, hashlib.sha256).digest()
    sig_part = b64url_encode(signature)
    
    return f"{header_part}.{payload_part}.{sig_part}"

def verify_token(token: str) -> Optional[dict]:
    """Verifies and decodes a signed HMAC-SHA256 token."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_part, payload_part, sig_part = parts
        
        message = f"{header_part}.{payload_part}".encode("utf-8")
        expected_sig = hmac.new(SECRET_KEY, message, hashlib.sha256).digest()
        actual_sig = b64url_decode(sig_part)
        
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        
        payload_bytes = b64url_decode(payload_part)
        payload = json.loads(payload_bytes.decode("utf-8"))
        
        # Check expiration
        if payload.get("exp", 0) < time.time():
            return None
        
        return payload
    except Exception:
        return None

def register_user(username: str, email: str, password: str) -> dict:
    """Registers a new user and returns their public profile and token."""
    username = username.strip()
    email = email.strip().lower()
    
    if len(username) < 3:
        raise ValueError("يجب أن يتكون اسم المستخدم من 3 أحرف على الأقل")
    if "@" not in email or "." not in email:
        raise ValueError("صيغة البريد الإلكتروني غير صحيحة")
    if len(password) < 6:
        raise ValueError("يجب أن تكون كلمة المرور 6 خانات على الأقل")
        
    password_hash, salt = hash_password(password)
    user_id = str(uuid.uuid4())
    color = secrets.choice(AVATAR_COLORS)
    
    with get_db() as conn:
        # Check if username or email already exists
        existing = conn.execute(
            "SELECT id, username, email FROM users WHERE username = ? OR email = ?",
            (username, email)
        ).fetchone()
        
        if existing:
            if existing["email"] == email:
                raise ValueError("البريد الإلكتروني مسجل بالفعل")
            else:
                raise ValueError("اسم المستخدم مأخوذ مسبقاً، اختر اسماً آخر")
                
        conn.execute(
            """
            INSERT INTO users (id, username, email, password_hash, salt, avatar_color)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, username, email, password_hash, salt, color)
        )
        
    token = generate_token(user_id, email, username)
    return {
        "id": user_id,
        "username": username,
        "email": email,
        "avatarColor": color,
        "storageUsedBytes": 0,
        "storageQuotaBytes": 157286400, # 150MB
        "token": token
    }

def authenticate_user(identifier: str, password: str) -> dict:
    """Authenticates a user via email or username."""
    identifier = identifier.strip()
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ? OR username = ?",
            (identifier.lower(), identifier)
        ).fetchone()
        
        if not row:
            raise ValueError("بيانات الدخول غير صحيحة، يرجى التحقق من البريد أو كلمة المرور")
            
        if not verify_password(password, row["password_hash"], row["salt"]):
            raise ValueError("بيانات الدخول غير صحيحة، يرجى التحقق من البريد أو كلمة المرور")
            
        token = generate_token(row["id"], row["email"], row["username"])
        return {
            "id": row["id"],
            "username": row["username"],
            "email": row["email"],
            "avatarColor": row["avatar_color"],
            "storageUsedBytes": row["storage_used_bytes"],
            "storageQuotaBytes": row["storage_quota_bytes"],
            "token": token
        }

def get_user_by_id(user_id: str) -> Optional[dict]:
    """Retrieves user profile and storage stats by id."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "username": row["username"],
            "email": row["email"],
            "avatarColor": row["avatar_color"],
            "storageUsedBytes": row["storage_used_bytes"],
            "storageQuotaBytes": row["storage_quota_bytes"],
            "createdAt": row["created_at"]
        }
