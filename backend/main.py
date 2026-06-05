"""
VistaSign - Digital Signature Platform
Main FastAPI application entry point
"""

from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from slowapi.util import get_remote_address
from app.core.rate_limit import limiter, RateLimitExceeded
from contextlib import asynccontextmanager
import logging
import os
import asyncio
from typing import AsyncGenerator

from app.core.database import init_db, get_db
from app.core.config import settings
from app.api.v1 import auth, documents, signatures, workflows, users, public_signing, billing
from app.api.v1 import envelopes as envelopes_api
from app.api.v1 import invites, certificate_validation, logs, api_tokens, webhooks, evidence
from app.core.security.auth import get_current_user
from app.core.certs import ensure_signature_certs
from app.core.admin_setup import ensure_initial_admin
from app.core.security_headers import SecurityHeadersMiddleware
from app.core.acme_watcher import acme_watcher_task
from app.core.request_logging_middleware import RequestLoggingMiddleware, DatabaseLoggingMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.realtime import socket_app

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Security scheme
security = HTTPBearer()

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager"""
    # Startup
    logger.info("🚀 Starting VistaSign Digital Signature Platform...")
    # Ensure document-signing certs exist (self-signed if missing)
    try:
        ensure_signature_certs()
        logger.info("🔐 Document-signing certificates ready")
    except Exception as e:
        logger.warning(f"⚠️ Could not ensure signing certs: {e}")
    await init_db()
    logger.info("✅ Database initialized successfully")
    # Create initial admin user if configured
    await ensure_initial_admin()
    
    # Start ACME certificate watcher
    asyncio.create_task(acme_watcher_task())
    
    logger.info("🔐 Security systems activated")
    logger.info("📝 VistaSign platform ready for digital signatures")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down VistaSign platform...")

# Create FastAPI application
app = FastAPI(
    title="VistaSign Digital Signature Platform",
    description="Secure digital signature platform for document signing and management",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Mount Socket.IO app under /ws
app.mount("/ws", socket_app)

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Too Many Requests"})

# Custom middleware to handle ALB proxy headers
class ProxyHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # Trust X-Forwarded-* headers from ALB
        if "x-forwarded-proto" in request.headers:
            request.scope["scheme"] = request.headers["x-forwarded-proto"]
        if "x-forwarded-host" in request.headers:
            request.scope["server"] = (request.headers["x-forwarded-host"], None)
        return await call_next(request)

# Security headers middleware (add first)
app.add_middleware(SecurityHeadersMiddleware)
# Trust ALB/X-Forwarded-* so app treats scheme/host correctly
app.add_middleware(ProxyHeadersMiddleware)
# Request logging middleware (add early to capture all requests)
app.add_middleware(RequestLoggingMiddleware)
# Database logging middleware (add last to ensure logs are committed)
app.add_middleware(DatabaseLoggingMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Basic CSRF protection for unsafe methods using X-CSRF-Token header + cookie
@app.middleware("http")
async def csrf_protect(request: Request, call_next):
    # Allow preflight and public endpoints
    if request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path
    # Exempt endpoints that either mint tokens or already require Bearer auth
    # Auth endpoints, file upload, and public signing endpoints
    if path in [
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/logout",
        "/api/v1/auth/csrf",
        "/api/v1/auth/refresh",
        "/api/v1/documents/upload",
        "/api/v1/documents/upload-debug",
        "/api/v1/logs/test",
        "/test-upload",
    ] or (path.startswith("/api/v1/workflows/") and "/sign/" in path) \
      or path.startswith("/api/v1/public/"):
        logger.info(f"CSRF: exempting {request.method} {path}")
        return await call_next(request)

    # Only check CSRF for state-changing methods (POST, PUT, PATCH, DELETE)
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        # If a Bearer token is present, skip CSRF (Bearer requests are not CSRF-prone)
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            return await call_next(request)

        # For cookie-based auth, validate CSRF token
        csrf_cookie = request.cookies.get("vst_csrf")
        csrf_header = request.headers.get("x-csrf-token")
        
        # Debug logging
        logger.info(f"CSRF validation for {request.method} {path} - Cookie: {csrf_cookie}, Header: {csrf_header}")
        
        if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
            logger.warning(f"CSRF validation failed for {request.method} {path} - Cookie: {csrf_cookie}, Header: {csrf_header}")
            return JSONResponse(status_code=403, content={"detail": "CSRF validation failed"})
    
    # For GET requests, always allow (no CSRF needed for safe methods)
    return await call_next(request)

# Global exception handler to ensure JSON responses
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler to ensure all errors return JSON"""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error": str(exc) if settings.DEBUG else "An unexpected error occurred"
        }
    )

# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "VistaSign Digital Signature Platform",
        "version": "1.0.0"
    }

# Include API routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["Documents"])
app.include_router(signatures.router, prefix="/api/v1/signatures", tags=["Signatures"])
app.include_router(workflows.router, prefix="/api/v1/workflows", tags=["Workflows"])
app.include_router(public_signing.router, prefix="/api/v1/public", tags=["Public Signing"])
app.include_router(billing.router, prefix="/api/v1/billing", tags=["Billing"])
app.include_router(invites.router, prefix="/api/v1/invites", tags=["Invites"])
app.include_router(certificate_validation.router, prefix="/api/v1/certificates", tags=["Certificate Validation"])
app.include_router(logs.router, prefix="/api/v1/logs", tags=["Logs"])
app.include_router(api_tokens.router, prefix="/api/v1/api-tokens", tags=["API Tokens"])
app.include_router(envelopes_api.router, prefix="/api/v1/envelopes", tags=["Envelopes"])
app.include_router(webhooks.router, prefix="/api/v1/webhooks", tags=["Webhooks"])
app.include_router(evidence.router, prefix="/api/v1/evidence", tags=["Evidence"])

# CSRF minting endpoint: sets a non-HttpOnly CSRF cookie and returns the value
@app.get("/api/v1/auth/csrf", tags=["Authentication"])
async def mint_csrf():
    from app.core.cookies import set_csrf_cookie
    response = JSONResponse({"csrf": ""})
    token = set_csrf_cookie(response)
    response.body = f'{{"csrf": "{token}"}}'.encode()
    return response

# Debug endpoint to check cookie settings
@app.get("/api/v1/debug/cookies", tags=["Debug"])
async def debug_cookies(request: Request):
    """Debug endpoint to check cookie settings and request headers"""
    return {
        "cookies": dict(request.cookies),
        "headers": {
            "x-forwarded-proto": request.headers.get("x-forwarded-proto"),
            "x-forwarded-for": request.headers.get("x-forwarded-for"),
            "x-forwarded-host": request.headers.get("x-forwarded-host"),
            "x-amzn-trace-id": request.headers.get("x-amzn-trace-id"),
            "x-forwarded-port": request.headers.get("x-forwarded-port"),
            "host": request.headers.get("host"),
            "user-agent": request.headers.get("user-agent")
        },
        "url_scheme": request.url.scheme,
        "environment": settings.ENVIRONMENT,
        "cookie_domain": settings.COOKIE_DOMAIN,
        "cookie_secure": settings.COOKIE_SECURE
    }

# Test upload endpoint for debugging (no auth required)
@app.post("/test-upload", tags=["Debug"])
async def test_upload(request: Request):
    """Test endpoint to debug upload issues (no auth required)"""
    try:
        logger.info(f"Test upload request received")
        logger.info(f"Content-Type: {request.headers.get('content-type')}")
        logger.info(f"Content-Length: {request.headers.get('content-length')}")
        
        # Try to read the raw body
        body = await request.body()
        logger.info(f"Body length: {len(body)}")
        logger.info(f"Body preview: {body[:200] if body else 'Empty'}")
        
        return {
            "message": "Test upload debug info logged",
            "content_type": request.headers.get('content-type'),
            "content_length": request.headers.get('content-length'),
            "body_length": len(body)
        }
    except Exception as e:
        logger.error(f"Test upload error: {str(e)}")
        return {"error": str(e)}

# Test email endpoint for debugging
@app.post("/test-email", tags=["Debug"])
async def test_email():
    """Test email sending for debugging OAuth2 issues"""
    from app.core.email import send_email
    
    test_email_body = """
    <html>
    <body>
        <h2>Test Email</h2>
        <p>This is a test email to verify OAuth2 configuration.</p>
    </body>
    </html>
    """
    
    success = send_email(
        to_email="jbarnett1209@gmail.com",
        subject="VistaSign OAuth2 Test",
        html_body=test_email_body,
        text_body="This is a test email to verify OAuth2 configuration."
    )
    
    return {"success": success, "message": "Check backend logs for details"}

# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with platform information"""
    return {
        "message": "Welcome to VistaSign Digital Signature Platform",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
