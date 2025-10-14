"""
VistaSign Recipient Models
"""

from sqlalchemy import Column, String, DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from app.core.database import Base

class RecipientRole(str, PyEnum):
    """Recipient roles in VistaSign"""
    SIGNER = "signer"
    CC = "cc"
    VIEWER = "viewer"

class RecipientStatus(str, PyEnum):
    """Recipient status in VistaSign"""
    PENDING = "pending"
    VIEWED = "viewed"
    SIGNED = "signed"
    COMPLETED = "completed"  # All fields filled, ready for envelope finalization
    DECLINED = "declined"
    BOUNCED = "bounced"  # Email bounced

class Recipient(Base):
    """Recipient model for VistaSign platform"""
    __tablename__ = "recipients"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Recipient information
    envelope_id = Column(UUID(as_uuid=True), ForeignKey("envelopes.id"), nullable=False)
    role = Column(Enum(RecipientRole), default=RecipientRole.SIGNER)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    routing_order = Column(Integer, nullable=False)
    access_code_hash = Column(String, nullable=True)
    phone_mfa = Column(String(20), nullable=True)  # Store phone number for MFA
    status = Column(Enum(RecipientStatus), default=RecipientStatus.PENDING)
    signed_at = Column(DateTime(timezone=True), nullable=True)
    signer_ip = Column(String(45), nullable=True)  # IPv4 or IPv6
    signer_user_agent = Column(Text, nullable=True)
    
    # Relationships
    envelope = relationship("Envelope", back_populates="recipients")
    field_values = relationship("FieldValue", back_populates="recipient", cascade="all, delete-orphan")
    sign_link = relationship("SignLink", back_populates="recipient", uselist=False, cascade="all, delete-orphan")
