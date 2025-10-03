"""
VistaSign User Schemas
"""

from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime

class UserResponse(BaseModel):
    """User response schema"""
    id: str
    email: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    role: str
    status: str
    is_verified: bool
    signature_style: Optional[str] = None
    created_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    """User update schema"""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    signature_style: Optional[str] = None
    signature_image: Optional[str] = None

class UserListResponse(BaseModel):
    """User list response schema"""
    users: List[UserResponse]
    total: int
    skip: int
    limit: int
    has_more: bool
