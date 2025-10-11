"""
Centralized cookie management for VistaSign
Ensures all cookies use identical attributes to prevent duplicates
"""

from fastapi import Response
from app.core.config import settings
import secrets


def _apply_development_cookie_settings(cookie_kwargs: dict) -> dict:
    """Apply development-friendly cookie settings"""
    if settings.ENVIRONMENT == "development":
        cookie_kwargs["samesite"] = "lax"
        cookie_kwargs["secure"] = False
        # Don't set domain in development to allow localhost
        if "domain" in cookie_kwargs:
            del cookie_kwargs["domain"]
    return cookie_kwargs

def _apply_flexible_cookie_settings(cookie_kwargs: dict) -> dict:
    """Apply flexible cookie settings for various deployment scenarios"""
    # Only apply flexible settings for development environment
    if settings.ENVIRONMENT == "development":
        # Remove domain restriction to allow localhost and IP addresses
        if "domain" in cookie_kwargs:
            del cookie_kwargs["domain"]
        # Allow cookies over HTTP for local development only
        cookie_kwargs["secure"] = False
        cookie_kwargs["samesite"] = "lax"
    elif settings.ENVIRONMENT == "staging":
        # Staging environment - more permissive but still secure
        # Remove domain restriction for testing
        if "domain" in cookie_kwargs:
            del cookie_kwargs["domain"]
        # Keep secure=True for staging (should use HTTPS)
        cookie_kwargs["secure"] = True
        cookie_kwargs["samesite"] = "lax"
    # Production environment keeps all security settings intact
    return cookie_kwargs


def set_refresh_cookie(response: Response, refresh_token: str, request: Request = None) -> None:
    """Set refresh token cookie with standardized attributes"""
    import logging
    logger = logging.getLogger(__name__)
    
    max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 if hasattr(settings, "REFRESH_TOKEN_EXPIRE_DAYS") else 14 * 24 * 60 * 60
    
    # Determine cookie attributes based on environment
    cookie_kwargs = {
        "key": "vst_refresh",
        "value": refresh_token,
        "max_age": max_age,
        "httponly": True,
        "path": "/",
    }
    
    # Set domain if specified
    if settings.COOKIE_DOMAIN:
        cookie_kwargs["domain"] = settings.COOKIE_DOMAIN
    
    # Set secure and samesite based on environment
    if settings.COOKIE_SECURE:
        cookie_kwargs["secure"] = True
        cookie_kwargs["samesite"] = "lax"
    else:
        cookie_kwargs["secure"] = False
        cookie_kwargs["samesite"] = "lax"
    
    # Ensure cookies work across subdomains and are persistent
    if settings.ENVIRONMENT != "development":
        # In production, use more permissive settings for better session persistence
        cookie_kwargs["samesite"] = "lax"
    
    # Apply development-friendly settings if needed
    cookie_kwargs = _apply_development_cookie_settings(cookie_kwargs)
    
    # Apply flexible settings for non-production environments
    cookie_kwargs = _apply_flexible_cookie_settings(cookie_kwargs)
    
    # Smart cookie security based on request context
    if request:
        # If request is over HTTP and not localhost, warn about security
        if request.url.scheme == "http" and request.client.host not in ["127.0.0.1", "localhost"]:
            logger.warning(f"Setting cookies over HTTP from {request.client.host} - consider using HTTPS")
        
        # Auto-detect if we should use secure cookies based on request scheme
        if request.url.scheme == "https":
            cookie_kwargs["secure"] = True
        elif settings.ENVIRONMENT == "development":
            cookie_kwargs["secure"] = False
    
    # Debug logging
    logger.info(f"Setting refresh cookie with attributes: {cookie_kwargs}")
    
    response.set_cookie(**cookie_kwargs)


def set_csrf_cookie(response: Response, csrf_token: str = None) -> str:
    """Set CSRF token cookie with standardized attributes"""
    import logging
    logger = logging.getLogger(__name__)
    
    if csrf_token is None:
        csrf_token = secrets.token_urlsafe(32)
    
    max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 if hasattr(settings, "REFRESH_TOKEN_EXPIRE_DAYS") else 14 * 24 * 60 * 60
    
    # Determine cookie attributes based on environment
    cookie_kwargs = {
        "key": "vst_csrf",
        "value": csrf_token,
        "max_age": max_age,
        "httponly": False,
        "path": "/",
    }
    
    # Set domain if specified
    if settings.COOKIE_DOMAIN:
        cookie_kwargs["domain"] = settings.COOKIE_DOMAIN
    
    # Set secure and samesite based on environment
    if settings.COOKIE_SECURE:
        cookie_kwargs["secure"] = True
        cookie_kwargs["samesite"] = "lax"
    else:
        cookie_kwargs["secure"] = False
        cookie_kwargs["samesite"] = "lax"
    
    # Ensure cookies work across subdomains and are persistent
    if settings.ENVIRONMENT != "development":
        # In production, use more permissive settings for better session persistence
        cookie_kwargs["samesite"] = "lax"
    
    # Apply development-friendly settings if needed
    cookie_kwargs = _apply_development_cookie_settings(cookie_kwargs)
    
    # Apply flexible settings for non-production environments
    cookie_kwargs = _apply_flexible_cookie_settings(cookie_kwargs)
    
    # Debug logging
    logger.info(f"Setting CSRF cookie with attributes: {cookie_kwargs}")
    
    response.set_cookie(**cookie_kwargs)
    
    return csrf_token


def delete_auth_cookies(response: Response) -> None:
    """Delete all auth cookies with standardized attributes"""
    delete_kwargs = {"path": "/"}
    if settings.COOKIE_DOMAIN:
        delete_kwargs["domain"] = settings.COOKIE_DOMAIN
    
    response.delete_cookie(key="vst_refresh", **delete_kwargs)
    response.delete_cookie(key="vst_csrf", **delete_kwargs)
