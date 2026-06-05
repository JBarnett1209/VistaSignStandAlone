"""
VistaSign Configuration Settings
"""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Optional
import os
import json
from urllib.parse import unquote

class Settings(BaseSettings):
    """Application settings"""
    
    # Application - REQUIRED
    APP_NAME: str
    VERSION: str
    DEBUG: bool
    ENVIRONMENT: str
    APP_URL: str
    FRONTEND_URL: str
    SINGLE_HOSTNAME: str
    
    # Database - REQUIRED
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    
    # Security - REQUIRED
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # Industry standard: 15-30 minutes
    REFRESH_TOKEN_EXPIRE_DAYS: float = 0.33  # Industry standard: 8 hours (0.33 days)
    INVITE_ONLY: bool = True
    
    # Cookie settings
    COOKIE_DOMAIN: Optional[str] = None  # None means use current domain
    COOKIE_SECURE: bool = True  # Set to False for localhost development
    
    # CORS - REQUIRED
    ALLOWED_ORIGINS: str
    
    @field_validator('ALLOWED_ORIGINS', mode='after')
    @classmethod
    def parse_allowed_origins(cls, v):
        """Parse ALLOWED_ORIGINS from environment variable"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v
    
    # File Storage
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100MB
    ALLOWED_FILE_TYPES: str = (
        "application/pdf,"
        "application/msword,"
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document,"
        "application/vnd.ms-excel,"
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,"
        "application/vnd.ms-powerpoint,"
        "application/vnd.openxmlformats-officedocument.presentationml.presentation,"
        "text/plain,"
        "text/csv,"
        "image/jpeg,"
        "image/jpg,"
        "image/png,"
        "image/gif,"
        "image/bmp,"
        "image/tiff,"
        "image/webp,"
        "application/rtf,"
        "application/vnd.oasis.opendocument.text,"
        "application/vnd.oasis.opendocument.spreadsheet,"
        "application/vnd.oasis.opendocument.presentation"
    )
    
    @field_validator('ALLOWED_FILE_TYPES', mode='after')
    @classmethod
    def parse_allowed_file_types(cls, v):
        """Parse ALLOWED_FILE_TYPES from environment variable"""
        if isinstance(v, str):
            return [file_type.strip() for file_type in v.split(',')]
        return v

    # Application-level encryption
    ENCRYPTION_KEY: str | None = None
    ENCRYPTION_SALT: str | None = None
    ENCRYPTION_PEPPER: str | None = None
    
    # Digital Signatures
    SIGNATURE_CERT_PATH: Optional[str] = None
    SIGNATURE_KEY_PATH: Optional[str] = None
    SIGNATURE_PASSWORD: Optional[str] = None
    
    # Encryption - REQUIRED
    ENCRYPTION_KEY: str
    
    # Email (for notifications)
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REFRESH_TOKEN: Optional[str] = None
    GOOGLE_REDIRECT_URI: Optional[str] = None
    GOOGLE_WORKSPACE_DOMAIN: Optional[str] = None
    FROM_EMAIL: Optional[str] = None
    FROM_NAME: Optional[str] = None

    # Transactional email via SMTP (Mailcow etc.)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_USE_TLS: bool = True   # STARTTLS on a plain connection (port 587)
    SMTP_USE_SSL: bool = False  # implicit TLS (port 465)
    SUPPORT_EMAIL: Optional[str] = None

    # Slack notifications (for DNS TXT challenges or alerts)
    SLACK_WEBHOOK_URL: Optional[str] = None
    SLACK_BOT_TOKEN: Optional[str] = None

    # Route53 / AWS (for DNS-01 automation via reverse proxy)
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: Optional[str] = None
    ROUTE53_HOSTED_ZONE_ID: Optional[str] = None

    # Initial admin user (for first-time setup)
    INITIAL_ADMIN_EMAIL: Optional[str] = None
    INITIAL_ADMIN_PASSWORD: Optional[str] = None
    INITIAL_ADMIN_FIRST_NAME: str = "Admin"
    INITIAL_ADMIN_LAST_NAME: str = "User"
    
    # Redis (for caching and sessions) - REQUIRED
    REDIS_URL: str
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/vistasign.log"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

    def model_post_init(self, __context) -> None:
        """Decode URL-encoded secrets so they are env-safe."""
        try:
            if isinstance(self.ENCRYPTION_KEY, str) and "%" in self.ENCRYPTION_KEY:
                # Only unquote if percent-encoded content is present
                self.ENCRYPTION_KEY = unquote(self.ENCRYPTION_KEY)
        except Exception:
            # Leave as-is if decoding fails
            pass

# Create settings instance
settings = Settings()
