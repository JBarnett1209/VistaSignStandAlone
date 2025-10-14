"""
VistaSign Sign Link Models
"""

from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.core.database import Base

class SignLink(Base):
    """Sign link model for VistaSign platform"""
    __tablename__ = "sign_links"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Link information
    envelope_id = Column(UUID(as_uuid=True), ForeignKey("envelopes.id"), nullable=False)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("recipients.id"), nullable=False)
    token_jti = Column(UUID(as_uuid=True), nullable=False, unique=True)  # JWT ID for revocation
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    envelope = relationship("Envelope", back_populates="sign_links")
    recipient = relationship("Recipient", back_populates="sign_link")
