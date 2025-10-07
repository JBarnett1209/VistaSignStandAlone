"""
Centralized cookie management for VistaSign
Ensures all cookies use identical attributes to prevent duplicates
"""

from fastapi import Response
from app.core.config import settings
import secrets


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Set refresh token cookie with standardized attributes"""
    max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 if hasattr(settings, "REFRESH_TOKEN_EXPIRE_DAYS") else 14 * 24 * 60 * 60
    
    response.set_cookie(
        key="vst_refresh",
        value=refresh_token,
        max_age=max_age,
        httponly=True,
        secure=True,
        samesite="none",
        domain="vistasign.unitvista.com",
        path="/",
    )


def set_csrf_cookie(response: Response, csrf_token: str = None) -> str:
    """Set CSRF token cookie with standardized attributes"""
    if csrf_token is None:
        csrf_token = secrets.token_urlsafe(32)
    
    max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 if hasattr(settings, "REFRESH_TOKEN_EXPIRE_DAYS") else 14 * 24 * 60 * 60
    
    response.set_cookie(
        key="vst_csrf",
        value=csrf_token,
        max_age=max_age,
        httponly=False,
        secure=True,
        samesite="none",
        domain="vistasign.unitvista.com",
        path="/",
    )
    
    return csrf_token


def delete_auth_cookies(response: Response) -> None:
    """Delete all auth cookies with standardized attributes"""
    response.delete_cookie(
        key="vst_refresh",
        path="/",
        domain="vistasign.unitvista.com",
    )
    response.delete_cookie(
        key="vst_csrf",
        path="/",
        domain="vistasign.unitvista.com",
    )
