from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class Rect(BaseModel):
    x: float
    y: float
    w: float
    h: float


class RecipientIn(BaseModel):
    role: Literal['SIGNER', 'CC', 'VIEWER'] = 'SIGNER'
    name: str
    email: str
    routing_order: int = 1


class EnvelopeCreate(BaseModel):
    document_id: UUID
    subject: Optional[str] = None
    message: Optional[str] = None
    recipients: List[RecipientIn] = Field(default_factory=list)


class EnvelopeOut(BaseModel):
    id: UUID
    document_id: UUID
    subject: Optional[str]
    message: Optional[str]
    status: str
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class FieldDef(BaseModel):
    id: Optional[UUID] = None
    page: int
    type: str
    rect: Rect
    required: bool = False
    recipient_id: Optional[UUID] = None
    tab_settings: Optional[dict] = None


class FieldsUpsertRequest(BaseModel):
    fields: List[FieldDef]


class FieldValueCreate(BaseModel):
    field_id: UUID
    recipient_id: UUID
    value: Optional[str] = None
    signer_ip: Optional[str] = None
    signer_user_agent: Optional[str] = None
    evidence_hash: Optional[str] = None


class FieldValueResponse(BaseModel):
    id: UUID
    field_id: UUID
    recipient_id: UUID
    envelope_id: UUID
    value: Optional[str] = None
    signed_at: datetime
    signer_ip: Optional[str] = None
    signer_user_agent: Optional[str] = None
    evidence_hash: Optional[str] = None

    class Config:
        from_attributes = True


class EvidenceOut(BaseModel):
    envelope_id: UUID
    hash: str
    events: List[dict] = Field(default_factory=list)

