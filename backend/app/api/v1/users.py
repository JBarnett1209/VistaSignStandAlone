"""
VistaSign Users API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import logging

from app.core.database import get_db
from app.core.security.auth import get_current_user
from app.models.user import User, UserRole
from app.models.invite import Invite
from app.schemas.user import UserResponse, UserUpdate, UserListResponse
from fastapi import Body
from datetime import datetime, timedelta
import secrets
from app.core.email import send_email
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/profile", response_model=UserResponse)
async def get_user_profile(
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
        
        return UserResponse(
            id=str(user.id),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            company=user.company,
            job_title=user.job_title,
            role=user.role.value,
            status=user.status.value,
            is_verified=user.is_verified,
            signature_style=user.signature_style,
            created_at=user.created_at,
            last_login=user.last_login
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user profile error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user profile"
        )


@router.post("/invites", response_model=dict)
async def create_invite(
    email: Optional[str] = Body(default=None),
    max_uses: int = Body(default=1, ge=1),
    expires_in_days: Optional[int] = Body(default=14, ge=1, le=365),
    role: str = Body(default="user"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create an invite code (admin only)."""
    # Verify admin
    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    me: User | None = result.scalar_one_or_none()
    if not me or me.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    code = secrets.token_urlsafe(24)
    expires_at = None
    if expires_in_days is not None:
        expires_at = datetime.utcnow() + timedelta(days=expires_in_days)

    # Validate role
    if role not in ["user", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'user' or 'admin'"
        )

    invite = Invite(
        code=code,
        invited_email=email,
        max_uses=max_uses,
        expires_at=expires_at,
        created_by=me.id,
        role=role
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)
    # Send email if provided
    if email:
        subject = "Your VistaSign Invite"
        # Use configured FRONTEND_URL for sign-up link
        app_url = settings.FRONTEND_URL or "http://localhost:3000"
        html = (
            f"<p>You have been invited to join VistaSign.</p>"
            f"<p>Use this invite code during registration:</p>"
            f"<p><b>{invite.code}</b></p>"
            f"<p>Sign up here: <a href='{app_url}/register'>{app_url}/register</a></p>"
        )
        text = (
            "You have been invited to join VistaSign.\n\n"
            f"Invite code: {invite.code}\n"
            f"Sign up: {app_url}/register\n"
        )
        try:
            send_email(email, subject, html, text)
        except Exception:
            # Do not fail the API if email sending fails
            pass
    return {"code": invite.code, "expires_at": invite.expires_at, "max_uses": invite.max_uses, "role": invite.role}


@router.get("/invites", response_model=list[dict])
async def list_invites(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List invites (admin only)."""
    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    me: User | None = result.scalar_one_or_none()
    if not me or me.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    result = await db.execute(select(Invite))
    invites = result.scalars().all()
    return [
        {
            "id": str(inv.id),
            "code": inv.code,
            "invited_email": inv.invited_email,
            "role": inv.role,
            "expires_at": inv.expires_at,
            "max_uses": inv.max_uses,
            "uses_count": inv.uses_count,
            "revoked": inv.revoked,
            "created_at": inv.created_at,
        }
        for inv in invites
    ]


@router.post("/invites/{code}/revoke", response_model=dict)
async def revoke_invite(
    code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Revoke an invite (admin only)."""
    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    me: User | None = result.scalar_one_or_none()
    if not me or me.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    result = await db.execute(select(Invite).where(Invite.code == code))
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    invite.revoked = True
    db.add(invite)
    await db.commit()
    return {"message": "Invite revoked"}

@router.put("/profile", response_model=UserResponse)
async def update_user_profile(
    user_update: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user profile"""
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
        
        # Update fields
        if user_update.first_name is not None:
            user.first_name = user_update.first_name
        if user_update.last_name is not None:
            user.last_name = user_update.last_name
        if user_update.phone is not None:
            user.phone = user_update.phone
        if user_update.company is not None:
            user.company = user_update.company
        if user_update.job_title is not None:
            user.job_title = user_update.job_title
        if user_update.signature_style is not None:
            user.signature_style = user_update.signature_style
        if user_update.signature_image is not None:
            user.signature_image = user_update.signature_image
        
        await db.commit()
        await db.refresh(user)
        
        return UserResponse(
            id=str(user.id),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            company=user.company,
            job_title=user.job_title,
            role=user.role.value,
            status=user.status.value,
            is_verified=user.is_verified,
            signature_style=user.signature_style,
            created_at=user.created_at,
            last_login=user.last_login
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update user profile error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user profile"
        )

@router.get("/", response_model=UserListResponse)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List users (admin only)"""
    try:
        # Check if user is admin
        if current_user["role"] != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        # Build query
        query = select(User)
        
        # Apply filters
        if role:
            query = query.where(User.role == role)
        if status:
            query = query.where(User.status == status)
        if search:
            query = query.where(
                User.first_name.ilike(f"%{search}%") |
                User.last_name.ilike(f"%{search}%") |
                User.email.ilike(f"%{search}%")
            )
        
        # Get total count
        count_query = select(User)
        if role:
            count_query = count_query.where(User.role == role)
        if status:
            count_query = count_query.where(User.status == status)
        if search:
            count_query = count_query.where(
                User.first_name.ilike(f"%{search}%") |
                User.last_name.ilike(f"%{search}%") |
                User.email.ilike(f"%{search}%")
            )
        
        total_result = await db.execute(count_query)
        total = len(total_result.scalars().all())
        
        # Get users with pagination
        result = await db.execute(query.offset(skip).limit(limit))
        users = result.scalars().all()
        
        return UserListResponse(
            users=[
                UserResponse(
                    id=str(user.id),
                    email=user.email,
                    first_name=user.first_name,
                    last_name=user.last_name,
                    phone=user.phone,
                    company=user.company,
                    job_title=user.job_title,
                    role=user.role.value,
                    status=user.status.value,
                    is_verified=user.is_verified,
                    signature_style=user.signature_style,
                    created_at=user.created_at,
                    last_login=user.last_login
                ) for user in users
            ],
            total=total,
            skip=skip,
            limit=limit,
            has_more=(skip + limit) < total
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"List users error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list users"
        )
