"""
VistaSign Authentication API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, Query
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta, timezone
from typing import Optional
import secrets
import logging

from app.core.database import get_db
from app.core.config import settings
from app.core.security.auth import AuthHandler, get_current_user
from app.core.cookies import set_refresh_cookie, set_csrf_cookie, delete_auth_cookies
from app.core.rate_limit import limiter
from app.models.user import User, UserStatus, UserRole
from app.models.invite import Invite
from app.schemas.auth import (
    LoginRequest, LoginResponse, RegisterRequest, RegisterResponse,
    UserRegistration, TokenRefreshRequest, TokenRefreshResponse, UserProfile,
    TokenResponse
)
 

router = APIRouter()
security = HTTPBearer()
auth_handler = AuthHandler()
logger = logging.getLogger(__name__)

REFRESH_COOKIE_NAME = "vst_refresh"
CSRF_COOKIE_NAME = "vst_csrf"


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(
    login_data: LoginRequest,
    response: Response,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """User login endpoint"""
    try:
        # Normalize email and find user
        normalized_email = login_data.email.strip().lower()
        # Case-insensitive lookup to support legacy mixed-case emails
        result = await db.execute(
            select(User).where(func.lower(User.email) == normalized_email)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            logger.info(f"Login failed: user not found for email={normalized_email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # If we found a legacy mixed-case email, normalize it now
        try:
            if user and user.email != normalized_email:
                user.email = normalized_email
                await db.commit()
        except Exception:
            pass

        # Verify password with detail (so we only rehash when truly legacy)
        verified, mode = auth_handler.verify_password_detailed(login_data.password, user.password_hash)
        if not verified:
            try:
                from passlib.context import CryptContext
                scheme = CryptContext(schemes=["argon2","bcrypt"]).identify(user.password_hash)
            except Exception:
                scheme = None
            logger.info(f"Login failed: password verification failed (scheme={scheme}) for email={normalized_email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Only rehash if login succeeded via legacy scheme
        if mode in ("bcrypt_legacy", "argon2_legacy"):
            try:
                user.password_hash = auth_handler.get_password_hash(login_data.password)
                logger.info(f"User {user.email} password rehashed to Argon2id+pepper (from {mode}).")
            except Exception:
                pass
        
        # Check if user is active
        if user.status != UserStatus.ACTIVE:
            logger.info(f"Login failed: user inactive email={normalized_email} status={user.status}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is not active"
            )

        # Update last login
        user.last_login = datetime.now()
        await db.commit()
        
        # Generate tokens
        access_token = auth_handler.create_access_token(
            data={"sub": str(user.id), "email": user.email}
        )
        refresh_token = auth_handler.create_refresh_token(
            data={"sub": str(user.id)}
        )
        # Set standardized cookies
        logger.info(f"Login successful for user {user.email}, setting cookies...")
        set_refresh_cookie(response, refresh_token, request)
        set_csrf_cookie(response, request=request)
        logger.info("Cookies set successfully")
        
        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserProfile(
                id=str(user.id),
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                role=user.role.value,
                is_verified=user.is_verified
            )
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )


@router.post("/refresh", response_model=TokenRefreshResponse)
@limiter.limit("60/minute")
async def refresh_token(
    refresh_data: TokenRefreshRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """Token refresh endpoint"""
    try:
        logger.info("Token refresh request received")
        
        # Prefer cookie for refresh token
        incoming_refresh = refresh_data.refresh_token if refresh_data and getattr(refresh_data, "refresh_token", None) else None
        if request and not incoming_refresh:
            incoming_refresh = request.cookies.get(REFRESH_COOKIE_NAME)
            logger.info(f"Refresh token from cookie: {'present' if incoming_refresh else 'missing'}")
        
        if not incoming_refresh:
            logger.warning("No refresh token found in request or cookie")
            # Clear cookies and return 401 without raising to ensure deletion is set
            if response is not None:
                delete_auth_cookies(response)
            return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Missing refresh token"})

        # Verify refresh token
        payload = auth_handler.verify_token(incoming_refresh)
        if not payload or payload.get("type") != "refresh":
            if response is not None:
                delete_auth_cookies(response)
            return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Invalid refresh token"})
        
        user_id = payload.get("sub")
        if not user_id:
            if response is not None:
                delete_auth_cookies(response)
            return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Invalid token"})
        
        # Get user
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user or user.status != UserStatus.ACTIVE:
            if response is not None:
                delete_auth_cookies(response)
            return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "User not found or inactive"})
        
        # Generate new tokens
        access_token = auth_handler.create_access_token(
            data={"sub": str(user.id), "email": user.email}
        )
        new_refresh_token = auth_handler.create_refresh_token(
            data={"sub": str(user.id)}
        )
        # Rotate cookies with standardized attributes
        if response:
            set_refresh_cookie(response, new_refresh_token, request)
            set_csrf_cookie(response, request=request)
        
        logger.info(f"Token refresh successful for user {user.email}")
        
        return TokenRefreshResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
        
    except HTTPException as e:
        # On any explicit 401 during refresh, clear cookies
        if e.status_code == status.HTTP_401_UNAUTHORIZED and response is not None:
            delete_auth_cookies(response)
            return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": e.detail})
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )

@router.get("/me", response_model=UserProfile)
async def get_current_user_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user profile"""
    try:
        result = await db.execute(
            select(User).where(User.id == current_user["user_id"])
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return UserProfile(
            id=str(user.id),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            company=user.company,
            job_title=user.job_title,
            role=user.role.value,
            is_verified=user.is_verified,
            created_at=user.created_at,
            last_login=user.last_login
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get profile error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user profile"
        )

@router.get("/validate-invite")
async def validate_invite(
    code: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Validate an invite code and return invite details"""
    logger.info(f"Validating invite code: {code}")
    
    result = await db.execute(select(Invite).where(Invite.code == code))
    invite = result.scalar_one_or_none()
    
    if not invite:
        logger.warning(f"Invite not found for code: {code}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite code")
    
    logger.info(f"Found invite: id={invite.id}, email={invite.invited_email}, revoked={invite.revoked}, uses={invite.uses_count}/{invite.max_uses}, expires={invite.expires_at}")
    
    if invite.revoked:
        logger.warning(f"Invite {invite.id} is revoked")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite has been revoked")
    
    if invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
        logger.warning(f"Invite {invite.id} has expired: {invite.expires_at} < {datetime.now(timezone.utc)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite has expired")
    
    if invite.uses_count >= invite.max_uses:
        logger.warning(f"Invite {invite.id} is fully used: {invite.uses_count}/{invite.max_uses}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite has been fully used")
    
    logger.info(f"Invite {invite.id} is valid")
    return {
        "email": invite.invited_email,
        "role": invite.role,
        "expires_at": invite.expires_at
    }

@router.post("/register", response_model=TokenResponse)
async def register(
    payload: UserRegistration,
    response: Response,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user (open self-service signup)."""
    # Basic validation
    normalized_email = payload.email.strip().lower()
    if not normalized_email or "@" not in normalized_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A valid email is required")
    if not payload.password or len(payload.password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Password must be at least 8 characters")

    existing_user = await db.execute(select(User).where(User.email == normalized_email))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="An account with this email already exists")

    # Create the new user. New signups are standard users.
    auth_handler = AuthHandler()
    user = User(
        email=normalized_email,
        password_hash=auth_handler.get_password_hash(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
        is_verified=True,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Generate tokens
    access_token = auth_handler.create_access_token({"sub": str(user.id), "email": user.email})
    refresh_token = auth_handler.create_refresh_token({"sub": str(user.id), "email": user.email})
    
    # Set cookies
    set_refresh_cookie(response, refresh_token, request)
    set_csrf_cookie(response, request=request)
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

@router.post("/logout")
async def logout(response: Response):
    """User logout endpoint"""
    delete_auth_cookies(response)
    return {"message": "Successfully logged out"}


@router.get("/session-check")
async def session_check(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Lightweight check to validate refresh cookie without rotating tokens.
    Returns 204 if valid/active; 401 otherwise.
    """
    try:
        refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
        if not refresh_token:
            return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "No refresh"})

        payload = auth_handler.verify_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Invalid"})

        user_id = payload.get("sub")
        if not user_id:
            return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Invalid"})

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or user.status != UserStatus.ACTIVE:
            return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Inactive"})

        # Success for auth_request must be 2xx; use 200
        return Response(status_code=status.HTTP_200_OK)
    except Exception:
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Unauthorized"})


@router.get("/debug")
async def debug_auth_status(
    current_user: dict = Depends(get_current_user)
):
    """Debug endpoint to check authentication status"""
    return {
        "authenticated": True,
        "user_id": current_user.get("user_id"),
        "user_id_type": str(type(current_user.get("user_id"))),
        "email": current_user.get("email"),
        "role": current_user.get("role"),
        "is_active": current_user.get("is_active"),
        "all_keys": list(current_user.keys()),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
