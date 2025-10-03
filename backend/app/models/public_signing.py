"""
VistaSign Public Signing Models
For DocuSign-style public document signing
"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, Enum, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime, timedelta
from enum import Enum as PyEnum

from app.core.database import Base

class PublicSigningStatus(str, PyEnum):
    """Public signing status"""
    PENDING = "pending"
    SENT = "sent"
    VIEWED = "viewed"
    SIGNED = "signed"
    COMPLETED = "completed"
    DECLINED = "declined"
    EXPIRED = "expired"

class PublicDocument(Base):
    """Public document for external signing"""
    __tablename__ = "public_documents"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Document information
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    document_url = Column(String(500), nullable=False)  # Public URL to document
    
    # Sender information
    sender_name = Column(String(255), nullable=False)
    sender_email = Column(String(255), nullable=False)
    sender_company = Column(String(255), nullable=True)
    
    # Signing configuration
    requires_signature = Column(Boolean, default=True)
    allow_decline = Column(Boolean, default=True)
    allow_forward = Column(Boolean, default=False)
    reminder_frequency = Column(Integer, default=3)  # days
    
    # Expiration
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Status
    status = Column(Enum(PublicSigningStatus), default=PublicSigningStatus.PENDING)
    
    # Public access
    public_id = Column(String(50), unique=True, nullable=False)  # Short public ID for URLs
    access_code = Column(String(10), nullable=True)  # Optional access code
    
    # Relationships
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # Null for anonymous
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    sent_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    creator = relationship("User")
    organization = relationship("Organization")
    recipients = relationship("PublicSigningRecipient", back_populates="document", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<PublicDocument(id={self.id}, title='{self.title}', status='{self.status.value}')>"
    
    @property
    def is_expired(self):
        """Check if document has expired"""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at
    
    @property
    def public_url(self):
        """Generate public URL for signing"""
        return f"/sign/{self.public_id}"

class PublicSigningRecipient(Base):
    """Recipients for public document signing"""
    __tablename__ = "public_signing_recipients"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Recipient information
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    role = Column(String(50), default="signer")  # signer, approver, reviewer, etc.
    order = Column(Integer, default=1)  # Signing order
    
    # Signing status
    status = Column(Enum(PublicSigningStatus), default=PublicSigningStatus.PENDING)
    signed_at = Column(DateTime(timezone=True), nullable=True)
    declined_at = Column(DateTime(timezone=True), nullable=True)
    declined_reason = Column(Text, nullable=True)
    
    # Access information
    access_token = Column(String(255), unique=True, nullable=False)
    last_accessed = Column(DateTime(timezone=True), nullable=True)
    
    # Custom fields for recipient
    custom_fields = Column(JSON, nullable=True)
    
    # Relationships
    document_id = Column(UUID(as_uuid=True), ForeignKey("public_documents.id"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    document = relationship("PublicDocument", back_populates="recipients")
    signatures = relationship("PublicSignature", back_populates="recipient", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<PublicSigningRecipient(id={self.id}, email='{self.email}', status='{self.status.value}')>"

class PublicSignature(Base):
    """Public signatures on documents"""
    __tablename__ = "public_signatures"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Signature information
    signature_data = Column(Text, nullable=True)  # Base64 signature data
    signature_image = Column(Text, nullable=True)  # Base64 signature image
    signature_position = Column(JSON, nullable=True)  # Position on document
    
    # Signing context
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    signing_reason = Column(Text, nullable=True)
    signing_location = Column(String(255), nullable=True)
    
    # Digital signature properties
    certificate_data = Column(Text, nullable=True)
    signature_hash = Column(String(64), nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("public_signing_recipients.id"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    signed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    recipient = relationship("PublicSigningRecipient", back_populates="signatures")
    
    def __repr__(self):
        return f"<PublicSignature(id={self.id}, recipient_id={self.recipient_id})>"

class Organization(Base):
    """Organizations for enterprise features"""
    __tablename__ = "organizations"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Organization information
    name = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    
    # Branding
    logo_url = Column(String(500), nullable=True)
    primary_color = Column(String(7), nullable=True)  # Hex color
    secondary_color = Column(String(7), nullable=True)
    
    # Settings
    allow_public_signing = Column(Boolean, default=True)
    require_authentication = Column(Boolean, default=False)
    custom_domain = Column(String(255), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    members = relationship("User", back_populates="organization")
    public_documents = relationship("PublicDocument", back_populates="organization")
    
    def __repr__(self):
        return f"<Organization(id={self.id}, name='{self.name}')>"
