"""
VistaSign Authentication API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, Query
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta, timezone
from typing import Optional
import secrets
import logging

from app.core.database import get_db
from app.core.config import settings
from app.core.security.auth import AuthHandler, get_current_user
from app.core.cookies import set_refresh_cookie, set_csrf_cookie, delete_auth_cookies
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
async def login(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db),
    response: Response = None
):
    """User login endpoint"""
    try:
        # Find user by email
        result = await db.execute(
            select(User).where(User.email == login_data.email)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Verify password
        if not auth_handler.verify_password(login_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Check if user is active
        if user.status != UserStatus.ACTIVE:
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
        if response:
            set_refresh_cookie(response, refresh_token)
            set_csrf_cookie(response)
        
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
async def refresh_token(
    refresh_data: TokenRefreshRequest,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
    response: Response = None
):
    """Token refresh endpoint"""
    try:
        # Prefer cookie for refresh token
        incoming_refresh = refresh_data.refresh_token if refresh_data and getattr(refresh_data, "refresh_token", None) else None
        if request and not incoming_refresh:
            incoming_refresh = request.cookies.get(REFRESH_COOKIE_NAME)
        if not incoming_refresh:
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
            set_refresh_cookie(response, new_refresh_token)
            set_csrf_cookie(response)
        
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
    db: AsyncSession = Depends(get_db)
):
    """Register a new user with an invite code"""
    # Validate invite code
    result = await db.execute(select(Invite).where(Invite.code == payload.invite_code))
    invite = result.scalar_one_or_none()
    
    if not invite:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invite code")
    
    if invite.revoked:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite has been revoked")
    
    if invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite has expired")
    
    if invite.uses_count >= invite.max_uses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite has been fully used")
    
    # Check if user already exists
    existing_user = await db.execute(select(User).where(User.email == payload.email))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")
    
    # Create new user
    auth_handler = AuthHandler()
    hashed_password = auth_handler.get_password_hash(payload.password)
    
    user = User(
        email=payload.email,
        password_hash=hashed_password,
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=UserRole(invite.role),
        status=UserStatus.ACTIVE,
        is_verified=True,  # Invited users are pre-verified
        is_active=True
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Update invite usage
    invite.uses_count += 1
    db.add(invite)
    await db.commit()
    
    # Generate tokens
    access_token = auth_handler.create_access_token({"sub": str(user.id), "email": user.email})
    refresh_token = auth_handler.create_refresh_token({"sub": str(user.id), "email": user.email})
    
    # Set cookies
    set_refresh_cookie(response, refresh_token)
    set_csrf_cookie(response)
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

@router.post("/test-invite")
async def create_test_invite(
    db: AsyncSession = Depends(get_db)
):
    """Create a test invite for debugging (temporary endpoint)"""
    import secrets
    from app.models.invite import Invite
    from datetime import datetime, timedelta
    
    code = secrets.token_urlsafe(24)
    invite = Invite(
        code=code,
        invited_email="test@example.com",
        role="user",
        created_by="00000000-0000-0000-0000-000000000000",  # dummy UUID
        max_uses=1,
        expires_at=datetime.now(timezone.utc) + timedelta(days=14)
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)
    
    return {
        "code": code,
        "url": f"https://vistasign.unitvista.com/register?invite={code}",
        "id": str(invite.id)
    }

@router.post("/logout")
async def logout(response: Response):
    """User logout endpoint"""
    delete_auth_cookies(response)
    return {"message": "Successfully logged out"}
