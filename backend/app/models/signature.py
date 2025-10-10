"""
VistaSign Signature Models
"""

from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from app.core.database import Base

class SignatureStatus(str, PyEnum):
    """Signature status"""
    PENDING = "pending"
    SIGNED = "signed"
    REJECTED = "rejected"
    EXPIRED = "expired"

class SignatureType(str, PyEnum):
    """Signature type"""
    ELECTRONIC = "electronic"
    DIGITAL = "digital"
    BIOMETRIC = "biometric"

class Signature(Base):
    """Digital signature model"""
    __tablename__ = "signatures"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Signature information
    signature_type = Column(Enum(SignatureType), default=SignatureType.ELECTRONIC)
    status = Column(Enum(SignatureStatus), default=SignatureStatus.PENDING)
    
    # Signature data
    signature_data = Column(Text, nullable=True)  # Base64 encoded signature
    signature_image = Column(Text, nullable=True)  # Base64 encoded signature image
    signature_position = Column(JSON, nullable=True)  # Position on document
    field_id = Column(String(255), nullable=True)  # ID of the field being signed
    
    # Digital signature properties
    certificate_data = Column(Text, nullable=True)  # Digital certificate
    certificate_thumbprint = Column(String(64), nullable=True)
    signature_hash = Column(String(64), nullable=True)  # Hash of the signature
    timestamp = Column(DateTime(timezone=True), nullable=True)
    
    # Cryptographic signature data
    digital_signature = Column(Text, nullable=True)  # Base64 encoded digital signature
    document_hash = Column(String(64), nullable=True)  # SHA-256 hash of document content
    signature_metadata = Column(JSON, nullable=True)  # Complete signature metadata
    verification_status = Column(String(20), default="pending")  # pending, verified, failed
    
    # Legal compliance fields
    signature_level = Column(String(20), default="simple")  # simple, advanced, qualified
    is_legally_binding = Column(Boolean, default=False)
    compliance_standard = Column(String(20), default="ESIGN")  # ESIGN, eIDAS, etc.
    certificate_chain = Column(JSON, nullable=True)  # Complete certificate chain info
    timestamp_data = Column(JSON, nullable=True)  # RFC 3161 timestamp data
    legal_metadata = Column(JSON, nullable=True)  # Legal compliance metadata
    
    # Hybrid signature fields
    certificate_type = Column(String(20), default="system")  # system, user, trusted
    user_metadata = Column(JSON, nullable=True)  # User-specific certificate metadata
    qualified_metadata = Column(JSON, nullable=True)  # Qualified signature metadata
    
    # Signing context
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    signing_reason = Column(Text, nullable=True)
    signing_location = Column(String(255), nullable=True)
    participant_email = Column(String(255), nullable=True)  # For workflow participants without user accounts
    
    # Relationships
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    signer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    template_id = Column(UUID(as_uuid=True), ForeignKey("signature_templates.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    signed_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Soft delete fields
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    deletion_reason = Column(Text, nullable=True)
    
    # Relationships
    document = relationship("Document", back_populates="signatures")
    signer = relationship("User", back_populates="signatures", foreign_keys=[signer_id])
    template = relationship("SignatureTemplate", back_populates="signatures")
    deleted_by_user = relationship("User", foreign_keys=[deleted_by])
    
    def __repr__(self):
        return f"<Signature(id={self.id}, status='{self.status.value}', signer='{self.signer_id}')>"

class SignatureTemplate(Base):
    """Signature template model"""
    __tablename__ = "signature_templates"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Template information
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Template data
    template_data = Column(JSON, nullable=False)  # Template configuration
    signature_style = Column(String(50), default="handwritten")
    
    # Relationships
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    creator = relationship("User")
    signatures = relationship("Signature", back_populates="template")
    
    def __repr__(self):
        return f"<SignatureTemplate(id={self.id}, name='{self.name}')>"
