"""
Centralized cookie management for VistaSign
Ensures all cookies use identical attributes to prevent duplicates
"""

from fastapi import Response, Request
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
    
    # Start with basic cookie attributes
    cookie_kwargs = {
        "key": "vst_refresh",
        "value": refresh_token,
        "max_age": max_age,
        "httponly": True,
        "path": "/",
        "samesite": "lax"
    }
    
    # Set domain if specified
    if settings.COOKIE_DOMAIN:
        cookie_kwargs["domain"] = settings.COOKIE_DOMAIN
    
    # Determine secure flag based on environment and request context
    if settings.ENVIRONMENT == "development":
        # Development: always use non-secure cookies
        cookie_kwargs["secure"] = False
        logger.info("Setting non-secure cookies for development environment")
    else:
        # Production/Staging: check if we're behind a load balancer
        is_behind_alb = False
        if request:
            # Check for ALB headers
            has_alb_headers = any([
                request.headers.get("x-forwarded-for"),
                request.headers.get("x-forwarded-host"),
                request.headers.get("x-amzn-trace-id"),
                request.headers.get("x-forwarded-port")
            ])
            
            # Check for HTTPS indicators
            is_https = (
                request.url.scheme == "https" or 
                request.headers.get("x-forwarded-proto") == "https"
            )
            
            if has_alb_headers or is_https:
                is_behind_alb = True
                logger.info("Detected ALB/HTTPS setup - using secure cookies")
        
        # Use secure cookies if behind ALB or in production
        cookie_kwargs["secure"] = is_behind_alb or settings.ENVIRONMENT == "production"
    
    # Debug logging
    logger.info(f"Setting refresh cookie with attributes: {cookie_kwargs}")
    
    response.set_cookie(**cookie_kwargs)


def set_csrf_cookie(response: Response, csrf_token: str = None, request: Request = None) -> str:
    """Set CSRF token cookie with standardized attributes"""
    import logging
    logger = logging.getLogger(__name__)
    
    if csrf_token is None:
        csrf_token = secrets.token_urlsafe(32)
    
    max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 if hasattr(settings, "REFRESH_TOKEN_EXPIRE_DAYS") else 14 * 24 * 60 * 60
    
    # Start with basic cookie attributes
    cookie_kwargs = {
        "key": "vst_csrf",
        "value": csrf_token,
        "max_age": max_age,
        "httponly": False,
        "path": "/",
        "samesite": "lax"
    }
    
    # Set domain if specified
    if settings.COOKIE_DOMAIN:
        cookie_kwargs["domain"] = settings.COOKIE_DOMAIN
    
    # Determine secure flag based on environment and request context (same logic as refresh cookie)
    if settings.ENVIRONMENT == "development":
        # Development: always use non-secure cookies
        cookie_kwargs["secure"] = False
    else:
        # Production/Staging: check if we're behind a load balancer
        is_behind_alb = False
        if request:
            # Check for ALB headers
            has_alb_headers = any([
                request.headers.get("x-forwarded-for"),
                request.headers.get("x-forwarded-host"),
                request.headers.get("x-amzn-trace-id"),
                request.headers.get("x-forwarded-port")
            ])
            
            # Check for HTTPS indicators
            is_https = (
                request.url.scheme == "https" or 
                request.headers.get("x-forwarded-proto") == "https"
            )
            
            if has_alb_headers or is_https:
                is_behind_alb = True
        
        # Use secure cookies if behind ALB or in production
        cookie_kwargs["secure"] = is_behind_alb or settings.ENVIRONMENT == "production"
    
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
