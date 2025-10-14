"""
VistaSign Field Models
"""

from sqlalchemy import Column, String, DateTime, Enum, ForeignKey, Integer, JSON, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from app.core.database import Base

class FieldType(str, PyEnum):
    """Field types in VistaSign"""
    SIGNATURE = "signature"
    INITIALS = "initials"
    DATE_SIGNED = "date_signed"
    FULL_NAME = "full_name"
    EMAIL = "email"
    COMPANY = "company"
    TITLE = "title"
    TEXT = "text"
    TEXT_AREA = "textarea"
    NUMBER = "number"
    CHECKBOX = "checkbox"
    RADIO_GROUP = "radio_group"
    RADIO = "radio"
    DROPDOWN = "dropdown"
    ATTACHMENT = "attachment"
    STAMP_SEAL = "stamp_seal"
    APPROVE_DECLINE = "approve_decline"
    NOTE = "note"
    LINE = "line"
    RECTANGLE = "rectangle"

class Field(Base):
    """Field model for VistaSign platform"""
    __tablename__ = "fields"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Field information
    envelope_id = Column(UUID(as_uuid=True), ForeignKey("envelopes.id"), nullable=False)
    page_index = Column(Integer, nullable=False)  # 0-indexed page number
    type = Column(Enum(FieldType), nullable=False)
    rect_pts = Column(JSON, nullable=False)  # {x, y, w, h} in PDF points
    rotation = Column(Integer, default=0)  # 0, 90, 180, 270
    required = Column(Boolean, default=False)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("recipients.id"), nullable=True)  # Who this field is assigned to
    tab_settings = Column(JSON, nullable=True)  # {font, size, mask, validation, dropdownOptions, ...}
    
    # Relationships
    envelope = relationship("Envelope", back_populates="fields")
    recipient = relationship("Recipient")  # The recipient this field is assigned to
    field_values = relationship("FieldValue", back_populates="field", cascade="all, delete-orphan")
