"""
VistaSign Audit Event Models
"""

from sqlalchemy import Column, String, DateTime, Enum, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from app.core.database import Base

class ActorType(str, PyEnum):
    """Actor types for audit events"""
    USER = "user"
    SYSTEM = "system"
    RECIPIENT = "recipient"

class AuditEvent(Base):
    """Audit event model for VistaSign platform"""
    __tablename__ = "audit_events"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Event information
    envelope_id = Column(UUID(as_uuid=True), ForeignKey("envelopes.id"), nullable=False)
    actor_type = Column(Enum(ActorType), nullable=False)
    actor_id = Column(UUID(as_uuid=True), nullable=True)  # User ID or Recipient ID
    event = Column(String(255), nullable=False)  # e.g., "envelope.created", "recipient.viewed", "field.signed"
    event_metadata = Column(JSON, nullable=True)  # Additional event data
    
    # Timestamps
    occurred_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    envelope = relationship("Envelope", back_populates="audit_events")
