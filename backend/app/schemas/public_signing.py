"""
VistaSign Public Signing Schemas
"""

from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List, Dict, Any
from datetime import datetime

class PublicSigningRecipientCreate(BaseModel):
    """Public signing recipient creation schema"""
    name: str
    email: EmailStr
    role: str = "signer"
    order: int = 1
    custom_fields: Optional[Dict[str, Any]] = None

class PublicDocumentCreate(BaseModel):
    """Public document creation schema"""
    title: str
    description: Optional[str] = None
    document_url: str
    sender_name: str
    sender_email: EmailStr
    sender_company: Optional[str] = None
    requires_signature: bool = True
    allow_decline: bool = True
    allow_forward: bool = False
    reminder_frequency: int = 3
    expires_at: Optional[datetime] = None
    access_code: Optional[str] = None
    recipients: List[PublicSigningRecipientCreate]

class PublicDocumentResponse(BaseModel):
    """Public document response schema"""
    id: str
    title: str
    description: Optional[str] = None
    public_id: str
    public_url: str
    status: str
    expires_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class PublicDocumentListResponse(BaseModel):
    """Public document list response schema"""
    documents: List[PublicDocumentResponse]
    total: int
    skip: int
    limit: int
    has_more: bool

class PublicSigningRecipientResponse(BaseModel):
    """Public signing recipient response schema"""
    id: str
    name: str
    email: str
    role: str
    status: str
    signed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class PublicSignatureCreate(BaseModel):
    """Public signature creation schema"""
    access_token: str
    signature_data: Optional[str] = None
    signature_image: Optional[str] = None
    signature_position: Optional[Dict[str, Any]] = None
    signing_reason: Optional[str] = None
    signing_location: Optional[str] = None

class PublicSignatureResponse(BaseModel):
    """Public signature response schema"""
    id: str
    signed_at: Optional[datetime] = None
    status: str
    
    class Config:
        from_attributes = True

class PublicSigningResponse(BaseModel):
    """Public signing page response schema"""
    document: PublicDocumentResponse
    recipients: List[PublicSigningRecipientResponse]
    requires_access_code: bool
    access_code_provided: bool
