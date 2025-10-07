"""
VistaSign - Digital Signature Platform
Main FastAPI application entry point
"""

from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from contextlib import asynccontextmanager
import logging
import os
import asyncio
from typing import AsyncGenerator

from app.core.database import init_db, get_db
from app.core.config import settings
from app.api.v1 import auth, documents, signatures, workflows, users, public_signing, billing
from app.api.v1 import invites
from app.core.security.auth import get_current_user
from app.core.certs import ensure_signature_certs
from app.core.admin_setup import ensure_initial_admin
from app.core.security_headers import SecurityHeadersMiddleware
from app.core.acme_watcher import acme_watcher_task
from starlette.middleware.base import BaseHTTPMiddleware

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
    # Exempt initial login and CSRF minting endpoints
    if path == "/api/v1/auth/login" or path == "/api/v1/auth/csrf":
        return await call_next(request)

    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        csrf_cookie = request.cookies.get("vst_csrf")
        csrf_header = request.headers.get("x-csrf-token")
        if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
            return JSONResponse(status_code=403, content={"detail": "CSRF validation failed"})
    return await call_next(request)

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

# CSRF minting endpoint: sets a non-HttpOnly CSRF cookie and returns the value
@app.get("/api/v1/auth/csrf", tags=["Authentication"])
async def mint_csrf():
    token = secrets.token_urlsafe(32)
    response = JSONResponse({"csrf": token})
    # Non-HttpOnly by design for double-submit pattern; Secure+Lax for safety
    response.set_cookie(
        key="vst_csrf",
        value=token,
        httponly=False,
        samesite="lax",
        secure=True,
    )
    return response

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
