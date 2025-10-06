"""
VistaSign Users API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Optional
import logging
from datetime import datetime

from app.core.database import get_db
from app.core.security.auth import get_current_user
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import UserResponse, UserUpdate, UserListResponse

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/profile", response_model=UserResponse)
async def get_user_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user profile"""
    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserResponse(
        id=str(user.id), email=user.email, first_name=user.first_name, last_name=user.last_name,
        phone=user.phone, company=user.company, job_title=user.job_title, role=user.role.value,
        status=user.status.value, is_verified=user.is_verified, signature_style=user.signature_style,
        created_at=user.created_at, last_login=user.last_login
    )

@router.patch("/{user_id}/role")
async def update_role(user_id: str, payload: dict = Body(...), db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.ADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    new_role = payload.get("role")
    if new_role not in ("user", "admin"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.role = UserRole(new_role)
    db.add(user)
    await db.commit()
    return {"message": "Role updated"}

@router.post("/{user_id}/deactivate")
async def deactivate_user(user_id: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.ADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.status = UserStatus.INACTIVE
    db.add(user)
    await db.commit()
    return {"message": "User deactivated"}

@router.post("/{user_id}/reactivate")
async def reactivate_user(user_id: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.ADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.status = UserStatus.ACTIVE
    db.add(user)
    await db.commit()
    return {"message": "User reactivated"}

@router.delete("/{user_id}")
async def delete_user(user_id: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.ADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if str(user.id) == current_user["user_id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account")
    await db.delete(user)
    await db.commit()
    return {"message": "User deleted"}

@router.put("/profile", response_model=UserResponse)
async def update_user_profile(
    user_update: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
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
        id=str(user.id), email=user.email, first_name=user.first_name, last_name=user.last_name,
        phone=user.phone, company=user.company, job_title=user.job_title, role=user.role.value,
        status=user.status.value, is_verified=user.is_verified, signature_style=user.signature_style,
        created_at=user.created_at, last_login=user.last_login
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
    if current_user["role"] != UserRole.ADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    query = select(User)
    result = await db.execute(query.offset(skip).limit(limit))
    users = result.scalars().all()
    total = len(users)
    return UserListResponse(
        users=[
            UserResponse(
                id=str(u.id), email=u.email, first_name=u.first_name, last_name=u.last_name,
                phone=u.phone, company=u.company, job_title=u.job_title, role=u.role.value,
                status=u.status.value, is_verified=u.is_verified, signature_style=u.signature_style,
                created_at=u.created_at, last_login=u.last_login
            ) for u in users
        ],
        total=total, skip=skip, limit=limit, has_more=False
    )
