"""
VistaSign Document Schemas
"""

from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime

class DocumentCreate(BaseModel):
    """Document creation schema"""
    title: str
    description: Optional[str] = None

class DocumentUpdate(BaseModel):
    """Document update schema"""
    title: Optional[str] = None
    description: Optional[str] = None

class DocumentResponse(BaseModel):
    """Document response schema"""
    id: str
    title: str
    description: Optional[str] = None
    filename: str
    file_size: int
    document_type: str
    status: str
    mime_type: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class DocumentListResponse(BaseModel):
    """Document list response schema"""
    documents: List[DocumentResponse]
    total: int
    skip: int
    limit: int
    has_more: bool

class DocumentVersionResponse(BaseModel):
    """Document version response schema"""
    id: str
    version_number: int
    change_description: Optional[str] = None
    file_size: int
    file_hash: str
    created_at: datetime
    
    class Config:
        from_attributes = True
