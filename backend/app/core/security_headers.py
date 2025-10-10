"""
Security headers middleware for VistaSign.
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse
import time
import secrets


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Generate nonce for CSP
        nonce = secrets.token_urlsafe(16)
        
        # Check if this is a document file request (allow iframe embedding)
        is_document_file = "/api/v1/documents/public/" in str(request.url) and "/file" in str(request.url)
        
        # HSTS - Force HTTPS
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        
        # Prevent clickjacking (except for document files)
        if is_document_file:
            response.headers["X-Frame-Options"] = "SAMEORIGIN"
        else:
            response.headers["X-Frame-Options"] = "DENY"
        
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # XSS Protection
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Content Security Policy - Allow iframe embedding for document files
        if is_document_file:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "frame-ancestors 'self'; "
                "object-src 'none'"
            )
        else:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                f"script-src 'self' 'nonce-{nonce}'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https: blob:; "
                "font-src 'self' data:; "
                "connect-src 'self' https: wss:; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self'; "
                "object-src 'none'; "
                "media-src 'self'; "
                "worker-src 'self'"
            )
        
        # Permissions Policy
        response.headers["Permissions-Policy"] = (
            "geolocation=(), "
            "microphone=(), "
            "camera=(), "
            "payment=(), "
            "usb=(), "
            "magnetometer=(), "
            "gyroscope=(), "
            "speaker=(), "
            "vibrate=(), "
            "fullscreen=(self), "
            "sync-xhr=()"
        )
        
        # Remove server information
        if "server" in response.headers:
            del response.headers["server"]
        
        # Add custom security header
        response.headers["X-VistaSign-Security"] = "enabled"
        
        return response
