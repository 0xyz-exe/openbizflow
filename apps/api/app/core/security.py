from datetime import datetime, timedelta, timezone
from typing import Any, Union, Optional
import jwt
import bcrypt
from cryptography.fernet import Fernet
from app.core.config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72],
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8")[:72], salt).decode("utf-8")

def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt

# Credential Encryption at Rest (Fernet)
def get_fernet() -> Fernet:
    if settings.ENCRYPTION_KEY:
        try:
            return Fernet(settings.ENCRYPTION_KEY.encode())
        except Exception:
            pass
    # Fallback to deterministic key derived from SECRET_KEY
    import base64
    import hashlib
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest())
    return Fernet(key)

def encrypt_secret(secret_str: str) -> str:
    f = get_fernet()
    return f.encrypt(secret_str.encode()).decode()

def decrypt_secret(encrypted_str: str) -> str:
    f = get_fernet()
    return f.decrypt(encrypted_str.encode()).decode()
