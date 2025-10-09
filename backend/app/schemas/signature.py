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
    
    # Legal compliance fields
    signature_level: Optional[str] = None
    is_legally_binding: Optional[bool] = None
    compliance_standard: Optional[str] = None
    
    # Hybrid signature fields
    certificate_type: Optional[str] = None
    
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
    template_data: Dict[str, Any]
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

class LegalSignatureVerificationResponse(BaseModel):
    """Legal signature verification response schema"""
    is_valid: bool
    is_legally_binding: bool
    errors: List[str] = []
    warnings: List[str] = []
    verification_details: Dict[str, Any] = {}
    legal_compliance: Dict[str, Any] = {}
    certificate_chain: Optional[Dict[str, Any]] = None

class SignatureLevelInfo(BaseModel):
    """Signature level information schema"""
    available: bool
    description: str
    legal_binding: str
    verification: str
    use_cases: List[str]

class SignatureLevelsResponse(BaseModel):
    """Available signature levels response schema"""
    simple: SignatureLevelInfo
    advanced: SignatureLevelInfo
    qualified: SignatureLevelInfo

class HybridSignatureCreate(BaseModel):
    """Hybrid signature creation schema"""
    document_id: str
    signature_data: Optional[str] = None
    signature_image: Optional[str] = None
    signature_position: Optional[Dict[str, Any]] = None
    signing_reason: Optional[str] = None
    signing_location: Optional[str] = None
    signature_level: str = "simple"  # simple, advanced, qualified

class SignatureDeleteRequest(BaseModel):
    """Signature deletion request schema"""
    deletion_reason: Optional[str] = None

class AdminSignatureResponse(BaseModel):
    """Admin signature response schema with full details"""
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
    
    # Legal compliance fields
    signature_level: Optional[str] = None
    is_legally_binding: Optional[bool] = None
    compliance_standard: Optional[str] = None
    
    # Hybrid signature fields
    certificate_type: Optional[str] = None
    
    # Soft delete fields
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None
    deletion_reason: Optional[str] = None
    
    # User information
    signer_email: Optional[str] = None
    signer_name: Optional[str] = None
    document_title: Optional[str] = None
    
    class Config:
        from_attributes = True

class AdminSignatureListResponse(BaseModel):
    """Admin signature list response schema"""
    signatures: List[AdminSignatureResponse]
    total: int
    skip: int
    limit: int
    has_more: bool
    deleted_count: int = 0
