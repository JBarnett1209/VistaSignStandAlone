"""
VistaSign Signature Schemas
"""

from pydantic import BaseModel, validator
from typing import Optional, List, Dict, Any
from datetime import datetime

class SignatureCreate(BaseModel):
    """Signature creation schema"""
    document_id: str
    signature_data: Optional[str] = None  # Base64 encoded signature data
    signature_image: Optional[str] = None  # Base64 encoded signature image
    signature_position: Optional[Dict[str, Any]] = None
    signing_reason: Optional[str] = None
    signing_location: Optional[str] = None

class SignatureResponse(BaseModel):
    """Signature response schema"""
    id: str
    document_id: str
    signer_id: str
    signature_type: str
    status: str
    signature_position: Optional[Dict[str, Any]] = None
    signing_reason: Optional[str] = None
    signing_location: Optional[str] = None
    created_at: datetime
    signed_at: Optional[datetime] = None
    
    # Digital signature fields
    digital_signature: Optional[str] = None
    document_hash: Optional[str] = None
    certificate_thumbprint: Optional[str] = None
    verification_status: Optional[str] = None
    
    class Config:
        from_attributes = True

class SignatureListResponse(BaseModel):
    """Signature list response schema"""
    signatures: List[SignatureResponse]
    total: int
    skip: int
    limit: int
    has_more: bool

class SignatureTemplateCreate(BaseModel):
    """Signature template creation schema"""
    name: str
    description: Optional[str] = None
    template_data: Dict[str, Any]
    signature_style: str = "handwritten"

class SignatureTemplateResponse(BaseModel):
    """Signature template response schema"""
    id: str
    name: str
    description: Optional[str] = None
    signature_style: str
    is_default: bool
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class SignatureVerificationResponse(BaseModel):
    """Signature verification response schema"""
    is_valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    verification_details: Dict[str, Any] = {}
    certificate_info: Optional[Dict[str, Any]] = None
