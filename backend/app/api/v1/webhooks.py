from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import hmac
import hashlib
import json
from typing import Dict, Any
import uuid
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.config import settings
from app.core.auth import get_current_user
from app.models.user import User
from app.models.envelope import Envelope, AuditEvent, ActorType, Recipient, RecipientStatus
from app.core.email import send_email

router = APIRouter()

def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify webhook signature using HMAC-SHA256."""
    if not secret:
        return False
    
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(f"sha256={expected_signature}", signature)

@router.post("/envelope/{envelope_id}/events")
async def handle_envelope_webhook(
    envelope_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Handle envelope lifecycle webhooks."""
    # Get raw body
    body = await request.body()
    
    # Verify webhook signature if secret is configured
    signature = request.headers.get("x-webhook-signature")
    if settings.WEBHOOK_SECRET and not verify_webhook_signature(body, signature, settings.WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    
    # Parse webhook payload
    try:
        payload = json.loads(body.decode('utf-8'))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    
    # Verify envelope exists
    envelope = await db.execute(
        select(Envelope).where(Envelope.id == envelope_id)
    )
    envelope = envelope.scalar_one_or_none()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    event_type = payload.get("event_type")
    event_data = payload.get("data", {})
    
    # Create audit event
    audit_event = AuditEvent(
        envelope_id=envelope_id,
        actor_type=ActorType.SYSTEM,
        event=f"webhook.{event_type}",
        event_metadata={
            "webhook_payload": payload,
            "webhook_source": request.headers.get("user-agent", "unknown")
        }
    )
    db.add(audit_event)
    
    # Handle different event types
    if event_type == "envelope.sent":
        await handle_envelope_sent(envelope, event_data, db)
    elif event_type == "envelope.completed":
        await handle_envelope_completed(envelope, event_data, db)
    elif event_type == "envelope.voided":
        await handle_envelope_voided(envelope, event_data, db)
    elif event_type == "recipient.signed":
        await handle_recipient_signed(envelope, event_data, db)
    elif event_type == "recipient.declined":
        await handle_recipient_declined(envelope, event_data, db)
    
    await db.commit()
    
    return {"message": "Webhook processed successfully"}

async def handle_envelope_sent(envelope: Envelope, data: Dict[str, Any], db: AsyncSession):
    """Handle envelope sent event."""
    # Send notification emails to recipients
    recipients = await db.execute(
        select(Recipient).where(Recipient.envelope_id == envelope.id)
    )
    recipients = recipients.scalars().all()
    
    for recipient in recipients:
        email_body = f"""
        <html>
        <body>
            <h2>Document Ready for Signature</h2>
            <p>Hello {recipient.name},</p>
            <p>You have received a document for signature: <strong>{envelope.subject}</strong></p>
            <p>Please click the link below to review and sign the document:</p>
            <p><a href="{settings.FRONTEND_URL}/sign/{envelope.id}/{recipient.id}">Sign Document</a></p>
            {f"<p><strong>Message:</strong> {envelope.message}</p>" if envelope.message else ""}
            <p>This link will expire in 30 days.</p>
        </body>
        </html>
        """
        
        send_email(
            to_email=recipient.email,
            subject=f"Document Ready for Signature: {envelope.subject}",
            html_body=email_body,
            text_body=f"Document Ready for Signature: {envelope.subject}\n\nPlease visit: {settings.FRONTEND_URL}/sign/{envelope.id}/{recipient.id}"
        )

async def handle_envelope_completed(envelope: Envelope, data: Dict[str, Any], db: AsyncSession):
    """Handle envelope completed event."""
    # Send completion notification to envelope creator
    creator = await db.execute(
        select(User).where(User.id == envelope.created_by)
    )
    creator = creator.scalar_one_or_none()
    
    if creator:
        email_body = f"""
        <html>
        <body>
            <h2>Document Signing Completed</h2>
            <p>Hello {creator.name},</p>
            <p>The document <strong>{envelope.subject}</strong> has been completed by all recipients.</p>
            <p>You can download the signed document and certificate from your VistaSign dashboard.</p>
        </body>
        </html>
        """
        
        send_email(
            to_email=creator.email,
            subject=f"Document Signing Completed: {envelope.subject}",
            html_body=email_body,
            text_body=f"Document Signing Completed: {envelope.subject}\n\nThe document has been completed by all recipients."
        )

async def handle_envelope_voided(envelope: Envelope, data: Dict[str, Any], db: AsyncSession):
    """Handle envelope voided event."""
    # Send void notification to all recipients
    recipients = await db.execute(
        select(Recipient).where(Recipient.envelope_id == envelope.id)
    )
    recipients = recipients.scalars().all()
    
    for recipient in recipients:
        email_body = f"""
        <html>
        <body>
            <h2>Document Signing Cancelled</h2>
            <p>Hello {recipient.name},</p>
            <p>The document <strong>{envelope.subject}</strong> has been cancelled by the sender.</p>
            <p>You no longer need to sign this document.</p>
        </body>
        </html>
        """
        
        send_email(
            to_email=recipient.email,
            subject=f"Document Signing Cancelled: {envelope.subject}",
            html_body=email_body,
            text_body=f"Document Signing Cancelled: {envelope.subject}\n\nThe document has been cancelled by the sender."
        )

async def handle_recipient_signed(envelope: Envelope, data: Dict[str, Any], db: AsyncSession):
    """Handle recipient signed event."""
    recipient_id = data.get("recipient_id")
    if not recipient_id:
        return
    
    recipient = await db.execute(
        select(Recipient).where(Recipient.id == recipient_id)
    )
    recipient = recipient.scalar_one_or_none()
    
    if recipient:
        # Send notification to next recipient in routing order
        next_recipient = await db.execute(
            select(Recipient).where(
                and_(
                    Recipient.envelope_id == envelope.id,
                    Recipient.routing_order > recipient.routing_order,
                    Recipient.status == RecipientStatus.PENDING
                )
            ).order_by(Recipient.routing_order).limit(1)
        )
        next_recipient = next_recipient.scalar_one_or_none()
        
        if next_recipient:
            email_body = f"""
            <html>
            <body>
                <h2>Your Turn to Sign</h2>
                <p>Hello {next_recipient.name},</p>
                <p>The document <strong>{envelope.subject}</strong> is now ready for your signature.</p>
                <p>Please click the link below to review and sign the document:</p>
                <p><a href="{settings.FRONTEND_URL}/sign/{envelope.id}/{next_recipient.id}">Sign Document</a></p>
            </body>
            </html>
            """
            
            send_email(
                to_email=next_recipient.email,
                subject=f"Your Turn to Sign: {envelope.subject}",
                html_body=email_body,
                text_body=f"Your Turn to Sign: {envelope.subject}\n\nPlease visit: {settings.FRONTEND_URL}/sign/{envelope.id}/{next_recipient.id}"
            )

async def handle_recipient_declined(envelope: Envelope, data: Dict[str, Any], db: AsyncSession):
    """Handle recipient declined event."""
    # Send notification to envelope creator
    creator = await db.execute(
        select(User).where(User.id == envelope.created_by)
    )
    creator = creator.scalar_one_or_none()
    
    if creator:
        recipient_id = data.get("recipient_id")
        recipient = await db.execute(
            select(Recipient).where(Recipient.id == recipient_id)
        )
        recipient = recipient.scalar_one_or_none()
        
        if recipient:
            email_body = f"""
            <html>
            <body>
                <h2>Document Signing Declined</h2>
                <p>Hello {creator.name},</p>
                <p>{recipient.name} has declined to sign the document <strong>{envelope.subject}</strong>.</p>
                <p>You may want to contact them directly or send the document to a different recipient.</p>
            </body>
            </html>
            """
            
            send_email(
                to_email=creator.email,
                subject=f"Document Signing Declined: {envelope.subject}",
                html_body=email_body,
                text_body=f"Document Signing Declined: {envelope.subject}\n\n{recipient.name} has declined to sign the document."
            )

@router.get("/envelope/{envelope_id}/events")
async def list_envelope_events(
    envelope_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List webhook events for an envelope."""
    # Verify user has access to envelope
    envelope = await db.execute(
        select(Envelope).where(
            and_(Envelope.id == envelope_id, Envelope.tenant_id == current_user.id)
        )
    )
    envelope = envelope.scalar_one_or_none()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    # Get webhook events
    events = await db.execute(
        select(AuditEvent).where(
            and_(
                AuditEvent.envelope_id == envelope_id,
                AuditEvent.event.like("webhook.%")
            )
        ).order_by(AuditEvent.occurred_at.desc())
    )
    events = events.scalars().all()
    
    return {
        "envelope_id": envelope_id,
        "events": [
            {
                "id": event.id,
                "event": event.event,
                "occurred_at": event.occurred_at,
                "metadata": event.metadata
            }
            for event in events
        ]
    }
