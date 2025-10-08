"""
VistaSign Document Models
"""

from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, Integer, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from app.core.database import Base

class DocumentStatus(str, PyEnum):
    """Document status"""
    DRAFT = "draft"
    PENDING_SIGNATURE = "pending_signature"
    SIGNED = "signed"
    COMPLETED = "completed"
    REJECTED = "rejected"
    EXPIRED = "expired"

class DocumentType(str, PyEnum):
    """Document type"""
    PDF = "pdf"
    WORD = "word"
    EXCEL = "excel"
    POWERPOINT = "powerpoint"
    IMAGE = "image"
    TEXT = "text"
    CSV = "csv"
    RTF = "rtf"
    OPEN_DOCUMENT = "open_document"
    OTHER = "other"

class Document(Base):
    """Document model for VistaSign platform"""
    __tablename__ = "documents"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Document information
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_hash = Column(String(64), nullable=False)  # SHA-256 hash
    
    # Document metadata
    document_type = Column(Enum(DocumentType), default=DocumentType.PDF)
    status = Column(Enum(DocumentStatus), default=DocumentStatus.DRAFT)
    mime_type = Column(String(100), nullable=False)
    
    # Signing configuration
    requires_signature = Column(Boolean, default=True)
    signature_positions = Column(JSON, nullable=True)  # Positions where signatures are required
    signing_deadline = Column(DateTime(timezone=True), nullable=True)
    
    # Security and encryption
    is_encrypted = Column(Boolean, default=False)
    encryption_key = Column(String(255), nullable=True)
    access_control = Column(JSON, nullable=True)  # Access control settings
    
    # Audit trail
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    signed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    owner = relationship("User", foreign_keys=[owner_id], back_populates="documents")
    creator = relationship("User", foreign_keys=[created_by])
    versions = relationship("DocumentVersion", back_populates="document", cascade="all, delete-orphan")
    signatures = relationship("Signature", back_populates="document")
    workflows = relationship("Workflow", back_populates="document")
    
    def __repr__(self):
        return f"<Document(id={self.id}, title='{self.title}', status='{self.status.value}')>"

class DocumentVersion(Base):
    """Document version model for tracking changes"""
    __tablename__ = "document_versions"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Version information
    version_number = Column(Integer, nullable=False)
    change_description = Column(Text, nullable=True)
    
    # File information
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_hash = Column(String(64), nullable=False)
    
    # Relationships
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    document = relationship("Document", back_populates="versions")
    creator = relationship("User")
    
    def __repr__(self):
        return f"<DocumentVersion(id={self.id}, version={self.version_number})>"
