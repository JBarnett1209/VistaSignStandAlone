"""
API Token Model
"""

from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base

class ApiToken(Base):
    """API tokens for programmatic access"""
    
    __tablename__ = "api_tokens"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)  # User-friendly name for the token
    token_hash = Column(String(255), nullable=False, unique=True, index=True)  # Hashed token value
    token_prefix = Column(String(10), nullable=False)  # First few chars for identification
    scopes = Column(String(500), nullable=False, default="read")  # Comma-separated scopes: read, write, admin
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # Optional expiration
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationship
    user = relationship("User", back_populates="api_tokens")
    
    # Indexes
    __table_args__ = (
        Index('idx_api_tokens_user_active', 'user_id', 'is_active'),
        Index('idx_api_tokens_expires', 'expires_at'),
    )
    
    def __repr__(self):
        return f"<ApiToken(id={self.id}, name='{self.name}', prefix='{self.token_prefix}')>"
    
    @property
    def is_expired(self):
        """Check if token is expired"""
        if not self.expires_at:
            return False
        return func.now() > self.expires_at
    
    @property
    def is_valid(self):
        """Check if token is valid (active and not expired)"""
        return self.is_active and not self.is_expired
