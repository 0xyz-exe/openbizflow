from pydantic_settings import BaseSettings
from typing import List, Optional
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "OpenBizFlow"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-openbizflow-jwt-key-change-in-prod-32bytes!")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    # Fernet 32-urlsafe-base64-encoded key for credential encryption at rest
    ENCRYPTION_KEY: Optional[str] = os.getenv("ENCRYPTION_KEY", None)
    
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./openbizflow.db")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    
    # SSRF Protection
    ALLOW_PRIVATE_IPS: bool = os.getenv("ALLOW_PRIVATE_IPS", "false").lower() == "true"
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
