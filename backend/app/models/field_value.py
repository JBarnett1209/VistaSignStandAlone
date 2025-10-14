"""
VistaSign Field Value Models
"""

from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime

from app.core.database import Base

class FieldValue(Base):
    """Field value model for VistaSign platform"""
    __tablename__ = "field_values"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Field value information
    field_id = Column(UUID(as_uuid=True), ForeignKey("fields.id"), nullable=False)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("recipients.id"), nullable=False)
    envelope_id = Column(UUID(as_uuid=True), ForeignKey("envelopes.id"), nullable=False)  # Denormalized for easier querying
    value = Column(Text, nullable=True)
    signed_at = Column(DateTime(timezone=True), server_default=func.now())
    signer_ip = Column(String(45), nullable=True)  # IPv4 or IPv6
    signer_user_agent = Column(Text, nullable=True)
    evidence_hash = Column(String(64), nullable=True)  # SHA256 hash of the value + context
    
    # Relationships
    field = relationship("Field", back_populates="field_values")
    recipient = relationship("Recipient", back_populates="field_values")
    envelope = relationship("Envelope")  # For direct access
