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


class RecipientCreate(BaseModel):
    name: str
    email: str
    role: Literal['SIGNER', 'CC', 'VIEWER'] = 'SIGNER'
    routing_order: int = 1
    access_code: Optional[str] = None
    phone_mfa: Optional[str] = None


class RecipientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[Literal['SIGNER', 'CC', 'VIEWER']] = None
    routing_order: Optional[int] = None
    access_code: Optional[str] = None
    phone_mfa: Optional[str] = None
    status: Optional[str] = None


class RecipientResponse(BaseModel):
    id: UUID
    envelope_id: UUID
    name: str
    email: str
    role: str
    routing_order: int
    status: str
    signed_at: Optional[datetime] = None
    signer_ip: Optional[str] = None
    signer_user_agent: Optional[str] = None

    class Config:
        from_attributes = True


class EnvelopeCreate(BaseModel):
    document_id: UUID
    subject: Optional[str] = None
    message: Optional[str] = None
    recipients: List[RecipientIn] = Field(default_factory=list)


class EnvelopeUpdate(BaseModel):
    subject: Optional[str] = None
    message: Optional[str] = None
    signing_order: Optional[List[UUID]] = None
    status: Optional[str] = None


class EnvelopeResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    document_id: UUID
    subject: str
    message: Optional[str] = None
    signing_order: Optional[List[UUID]] = None
    status: str
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EnvelopeListResponse(BaseModel):
    envelopes: List['EnvelopeResponse']
    total: int
    skip: int
    limit: int
    has_more: bool


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


class FieldCreate(BaseModel):
    page_index: int
    type: str
    rect_pts: Rect
    rotation: int = 0
    required: bool = False
    recipient_id: Optional[UUID] = None
    tab_settings: Optional[dict] = None


class FieldUpdate(BaseModel):
    page_index: Optional[int] = None
    type: Optional[str] = None
    rect_pts: Optional[Rect] = None
    rotation: Optional[int] = None
    required: Optional[bool] = None
    recipient_id: Optional[UUID] = None
    tab_settings: Optional[dict] = None


class FieldResponse(BaseModel):
    id: UUID
    envelope_id: UUID
    page_index: int
    type: str
    rect_pts: Rect
    rotation: int
    required: bool
    recipient_id: Optional[UUID] = None
    tab_settings: Optional[dict] = None

    class Config:
        from_attributes = True


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

