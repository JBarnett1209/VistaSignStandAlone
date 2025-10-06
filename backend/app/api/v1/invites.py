"""
VistaSign Invites API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import datetime, timedelta
import secrets

from app.core.database import get_db
from app.core.security.auth import get_current_user
from app.models.invite import Invite
from app.models.user import User, UserRole
from app.schemas.auth import InviteCreate, InviteResponse, InviteListResponse

router = APIRouter()

@router.post("/", response_model=InviteResponse)
async def create_invite(
    payload: InviteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create an invite. Users may only invite role=user; admins may invite user or admin."""
    requested_role = payload.role.lower()
    if requested_role not in {"user", "admin"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    # Enforce: non-admins cannot invite admins
    if current_user["role"] != UserRole.ADMIN.value and requested_role == "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    code = secrets.token_urlsafe(24)
    invite = Invite(
        code=code,
        invited_email=payload.email,
        role=requested_role,
        created_by=current_user["user_id"],
        max_uses=1,
        expires_at=datetime.utcnow() + timedelta(days=14)
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    return InviteResponse(
        id=str(invite.id),
        email=invite.invited_email,
        role=invite.role,
        code=invite.code,
        revoked=invite.revoked,
        uses_count=invite.uses_count,
        max_uses=invite.max_uses,
        expires_at=invite.expires_at
    )

@router.get("/", response_model=InviteListResponse)
async def list_invites(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List invites. Admins see all; users see invites they created."""
    if current_user["role"] == UserRole.ADMIN.value:
        result = await db.execute(select(Invite))
    else:
        result = await db.execute(select(Invite).where(Invite.created_by == current_user["user_id"]))
    invites = result.scalars().all()
    return InviteListResponse(invites=[
        InviteResponse(
            id=str(i.id), email=i.invited_email, role=i.role, code=i.code,
            revoked=i.revoked, uses_count=i.uses_count, max_uses=i.max_uses,
            expires_at=i.expires_at
        ) for i in invites
    ])

@router.delete("/{invite_id}")
async def revoke_invite(invite_id: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Revoke an invite (mark as revoked). Admins can revoke any; users can revoke theirs."""
    result = await db.execute(select(Invite).where(Invite.id == invite_id))
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    if current_user["role"] != UserRole.ADMIN.value and invite.created_by != current_user["user_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    invite.revoked = True
    db.add(invite)
    await db.commit()
    return {"message": "Invite revoked"}
