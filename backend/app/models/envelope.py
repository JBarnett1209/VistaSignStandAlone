from sqlalchemy import Column, String, DateTime, Enum, ForeignKey, Integer, JSON, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.core.database import Base


class EnvelopeStatus(str, Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    COMPLETED = "COMPLETED"
    VOIDED = "VOIDED"


class RecipientRole(str, Enum):
    SIGNER = "SIGNER"
    CC = "CC"
    VIEWER = "VIEWER"


class Envelope(Base):
    __tablename__ = "envelopes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), index=True, nullable=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    subject = Column(String(255), nullable=True)
    message = Column(String, nullable=True)
    signing_order = Column(JSON, nullable=True)
    status = Column(String(20), default=EnvelopeStatus.DRAFT)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    recipients = relationship("Recipient", back_populates="envelope", cascade="all, delete-orphan")
    fields = relationship("Field", back_populates="envelope", cascade="all, delete-orphan")
    events = relationship("AuditEvent", back_populates="envelope", cascade="all, delete-orphan")


class Recipient(Base):
    __tablename__ = "recipients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    envelope_id = Column(UUID(as_uuid=True), ForeignKey("envelopes.id"), nullable=False, index=True)
    role = Column(String(20), default=RecipientRole.SIGNER)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    routing_order = Column(Integer, default=1)
    access_code_hash = Column(String(255), nullable=True)
    phone_mfa = Column(String(32), nullable=True)

    envelope = relationship("Envelope", back_populates="recipients")


class Field(Base):
    __tablename__ = "fields"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    envelope_id = Column(UUID(as_uuid=True), ForeignKey("envelopes.id"), index=True, nullable=False)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("recipients.id"), nullable=True)
    page = Column(Integer, default=1)
    type = Column(String(50), nullable=False)
    rect = Column(JSON, nullable=False)  # {x,y,w,h}
    required = Column(Boolean, default=False)
    tab_settings = Column(JSON, nullable=True)

    envelope = relationship("Envelope", back_populates="fields")


class FieldValue(Base):
    __tablename__ = "field_values"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    field_id = Column(UUID(as_uuid=True), ForeignKey("fields.id"), index=True, nullable=False)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("recipients.id"), index=True, nullable=True)
    value = Column(JSON, nullable=True)
    signed_at = Column(DateTime(timezone=True), nullable=True)
    signer_ip = Column(String(64), nullable=True)
    signer_user_agent = Column(String(255), nullable=True)
    evidence_hash = Column(String(128), nullable=True)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    envelope_id = Column(UUID(as_uuid=True), ForeignKey("envelopes.id"), index=True, nullable=False)
    actor_type = Column(String(20), nullable=False)  # USER|SYSTEM|RECIPIENT
    actor_id = Column(UUID(as_uuid=True), nullable=True)
    event = Column(String(64), nullable=False)
    event_metadata = Column(JSON, nullable=True)
    occurred_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    envelope = relationship("Envelope", back_populates="events")


class SignLink(Base):
    __tablename__ = "sign_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    envelope_id = Column(UUID(as_uuid=True), ForeignKey("envelopes.id"), index=True, nullable=False)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("recipients.id"), index=True, nullable=False)
    token_jti = Column(String(64), index=True, unique=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)


