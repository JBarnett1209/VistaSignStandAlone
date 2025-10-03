"""
VistaSign Invite Model
"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime

from app.core.database import Base


class Invite(Base):
    """Invite model to support invite-only registrations"""
    __tablename__ = "invites"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Unique invite code (token)
    code = Column(String(64), nullable=False, unique=True, index=True)

    # Optional: limit to a specific email address
    invited_email = Column(String(255), nullable=True, index=True)

    # Invite lifecycle controls
    expires_at = Column(DateTime(timezone=True), nullable=True)
    max_uses = Column(Integer, nullable=False, default=1)
    uses_count = Column(Integer, nullable=False, default=0)
    revoked = Column(Boolean, nullable=False, default=False)

    # Audit fields
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        UniqueConstraint('code', name='uq_invites_code'),
    )

    def is_valid_for(self, email: str | None) -> bool:
        """Return True if the invite can be used now for the given email."""
        if self.revoked:
            return False
        if self.expires_at and datetime.utcnow().astimezone(self.expires_at.tzinfo) > self.expires_at:
            return False
        if self.uses_count >= self.max_uses:
            return False
        if self.invited_email and email and self.invited_email.lower() != email.lower():
            return False
        return True


