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
from app.core.email import send_email
from app.core.config import settings
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

    # Send invite email
    try:
        invite_url = f"https://{settings.SINGLE_HOSTNAME}/register?invite={invite.code}"
        subject = f"You're invited to join VistaSign"
        
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #6B46C1;">Welcome to VistaSign!</h2>
            <p>You've been invited to join VistaSign Digital Signature Platform.</p>
            <p><strong>Role:</strong> {invite.role.title()}</p>
            <p><strong>Expires:</strong> {invite.expires_at.strftime('%B %d, %Y at %I:%M %p UTC')}</p>
            <p>Click the button below to accept your invitation:</p>
            <a href="{invite_url}" style="background-color: #6B46C1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">Accept Invitation</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">{invite_url}</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 14px;">This invitation was sent by {current_user.get('email', 'an administrator')}.</p>
        </body>
        </html>
        """
        
        text_body = f"""
        Welcome to VistaSign!
        
        You've been invited to join VistaSign Digital Signature Platform.
        
        Role: {invite.role.title()}
        Expires: {invite.expires_at.strftime('%B %d, %Y at %I:%M %p UTC')}
        
        Accept your invitation by visiting:
        {invite_url}
        
        This invitation was sent by {current_user.get('email', 'an administrator')}.
        """
        
        email_sent = send_email(
            to_email=invite.invited_email,
            subject=subject,
            html_body=html_body,
            text_body=text_body
        )
        
        if not email_sent:
            # Log warning but don't fail the request
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to send invite email to {invite.invited_email}")
            
    except Exception as e:
        # Log error but don't fail the request
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error sending invite email: {e}")

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
    """List active invites (exclude revoked, expired, or fully used)."""
    now = datetime.utcnow()
    base = select(Invite).where(
        Invite.revoked == False,
        (Invite.expires_at == None) | (Invite.expires_at > now),
        Invite.uses_count < Invite.max_uses,
    )
    if current_user["role"] == UserRole.ADMIN.value:
        result = await db.execute(base)
    else:
        result = await db.execute(base.where(Invite.created_by == current_user["user_id"]))
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
