"""
VistaSign Authentication Schemas
"""

from pydantic import BaseModel, EmailStr, validator
from typing import Optional
from datetime import datetime

class LoginRequest(BaseModel):
    """Login request schema"""
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    """Login response schema"""
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int
    user: "UserProfile"

class RegisterRequest(BaseModel):
    """Registration request schema"""
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    invite_code: Optional[str] = None
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v

class RegisterResponse(BaseModel):
    """Registration response schema"""
    message: str
    user_id: str
    email: str

class TokenRefreshRequest(BaseModel):
    """Token refresh request schema"""
    # Optional: if omitted, backend will read HttpOnly cookie
    refresh_token: Optional[str] = None

class TokenRefreshResponse(BaseModel):
    """Token refresh response schema"""
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int

class UserProfile(BaseModel):
    """User profile schema"""
    id: str
    email: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    role: str
    is_verified: bool
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Update forward references
LoginResponse.model_rebuild()
