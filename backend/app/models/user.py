"""
VistaSign User Models
"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from app.core.database import Base

class UserRole(str, PyEnum):
    """User roles in VistaSign"""
    ADMIN = "admin"
    USER = "user"
    SIGNER = "signer"
    VIEWER = "viewer"

class UserStatus(str, PyEnum):
    """User account status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING_VERIFICATION = "pending_verification"

class User(Base):
    """User model for VistaSign platform"""
    __tablename__ = "users"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Authentication
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # User information
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    company = Column(String(255), nullable=True)
    job_title = Column(String(100), nullable=True)
    
    # Role and permissions
    role = Column(Enum(UserRole), default=UserRole.USER)
    status = Column(Enum(UserStatus), default=UserStatus.ACTIVE)
    
    # Digital signature settings
    signature_image = Column(Text, nullable=True)  # Base64 encoded signature image
    signature_style = Column(String(50), default="handwritten")  # handwritten, typed, image
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Organization relationship
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    
    # Relationships
    documents = relationship("Document", back_populates="owner")
    signatures = relationship("Signature", back_populates="signer")
    workflows = relationship("Workflow", back_populates="creator")
    workflow_participants = relationship("WorkflowParticipant", back_populates="user")
    subscription = relationship("Subscription", back_populates="user", uselist=False)
    organization = relationship("Organization", back_populates="members")
    
    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', role='{self.role.value}')>"
    
    @property
    def full_name(self):
        """Get user's full name"""
        return f"{self.first_name} {self.last_name}"
    
    @property
    def initials(self):
        """Get user's initials"""
        return f"{self.first_name[0]}{self.last_name[0]}".upper()
