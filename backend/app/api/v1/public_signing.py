from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import hashlib

from app.core.database import get_db
from app.models.envelope import Envelope, Recipient, Field, FieldValue, AuditEvent, ActorType, RecipientStatus
from app.schemas.envelope import FieldValueCreate, FieldValueResponse
from app.core.realtime import realtime_service

router = APIRouter()

@router.get("/{envelope_id}/{recipient_id}")
async def get_public_signing_data(
    envelope_id: uuid.UUID,
    recipient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get envelope data for public signing."""
    # Get envelope and recipient
    envelope = await db.execute(
        select(Envelope).where(Envelope.id == envelope_id)
    )
    envelope = envelope.scalar_one_or_none()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    recipient = await db.execute(
        select(Recipient).where(
            and_(Recipient.id == recipient_id, Recipient.envelope_id == envelope_id)
        )
    )
    recipient = recipient.scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # Get fields assigned to this recipient
    fields = await db.execute(
        select(Field).where(
            and_(Field.envelope_id == envelope_id, Field.recipient_id == recipient_id)
        )
    )
    fields = fields.scalars().all()
    
    # Get existing field values
    field_values = await db.execute(
        select(FieldValue).where(
            and_(FieldValue.envelope_id == envelope_id, FieldValue.recipient_id == recipient_id)
        )
    )
    field_values = field_values.scalars().all()
    
    return {
        "envelope": {
            "id": envelope.id,
            "subject": envelope.subject,
            "message": envelope.message,
            "status": envelope.status
        },
        "recipient": {
            "id": recipient.id,
            "name": recipient.name,
            "email": recipient.email,
            "role": recipient.role,
            "status": recipient.status
        },
        "fields": [
            {
                "id": field.id,
                "type": field.type,
                "page_index": field.page_index,
                "rect_pts": field.rect_pts,
                "rotation": field.rotation,
                "required": field.required,
                "tab_settings": field.tab_settings
            }
            for field in fields
        ],
        "field_values": {
            fv.field_id: {
                "id": fv.id,
                "value": fv.value,
                "signed_at": fv.signed_at
            }
            for fv in field_values
        }
    }

@router.post("/{envelope_id}/{recipient_id}/fields/{field_id}")
async def update_field_value(
    envelope_id: uuid.UUID,
    recipient_id: uuid.UUID,
    field_id: uuid.UUID,
    field_value_data: FieldValueCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Update a field value for public signing."""
    # Verify envelope and recipient
    envelope = await db.execute(
        select(Envelope).where(Envelope.id == envelope_id)
    )
    envelope = envelope.scalar_one_or_none()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    recipient = await db.execute(
        select(Recipient).where(
            and_(Recipient.id == recipient_id, Recipient.envelope_id == envelope_id)
        )
    )
    recipient = recipient.scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # Verify field belongs to this recipient
    field = await db.execute(
        select(Field).where(
            and_(
                Field.id == field_id,
                Field.envelope_id == envelope_id,
                Field.recipient_id == recipient_id
            )
        )
    )
    field = field.scalar_one_or_none()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    
    # Get client info
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    # Create or update field value
    existing_value = await db.execute(
        select(FieldValue).where(
            and_(
                FieldValue.field_id == field_id,
                FieldValue.recipient_id == recipient_id
            )
        )
    )
    existing_value = existing_value.scalar_one_or_none()
    
    if existing_value:
        existing_value.value = field_value_data.value
        existing_value.signer_ip = client_ip
        existing_value.signer_user_agent = user_agent
        existing_value.signed_at = datetime.now(timezone.utc)
        # Generate evidence hash
        evidence_data = f"{field_value_data.value}{client_ip}{user_agent}{field_id}{recipient_id}"
        existing_value.evidence_hash = hashlib.sha256(evidence_data.encode()).hexdigest()
    else:
        field_value = FieldValue(
            field_id=field_id,
            recipient_id=recipient_id,
            envelope_id=envelope_id,
            value=field_value_data.value,
            signer_ip=client_ip,
            signer_user_agent=user_agent,
            signed_at=datetime.now(timezone.utc)
        )
        # Generate evidence hash
        evidence_data = f"{field_value_data.value}{client_ip}{user_agent}{field_id}{recipient_id}"
        field_value.evidence_hash = hashlib.sha256(evidence_data.encode()).hexdigest()
        db.add(field_value)
    
    # Create audit event
    audit_event = AuditEvent(
        envelope_id=envelope_id,
        actor_type=ActorType.RECIPIENT,
        actor_id=recipient_id,
        event="field.signed",
        event_metadata={
            "field_id": str(field_id),
            "field_type": field.type,
            "signer_ip": client_ip,
            "signer_user_agent": user_agent
        }
    )
    db.add(audit_event)
    
    await db.commit()
    
    # Emit real-time event
    await realtime_service.emit_to_room(
        f"envelope_{envelope_id}",
        "field.updated",
        {
            "envelope_id": str(envelope_id),
            "field_id": str(field_id),
            "recipient_id": str(recipient_id),
            "value": field_value_data.value
        }
    )
    
    return {"message": "Field value updated successfully"}

@router.post("/{envelope_id}/{recipient_id}/complete")
async def complete_signing(
    envelope_id: uuid.UUID,
    recipient_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Mark recipient as completed signing."""
    # Verify envelope and recipient
    envelope = await db.execute(
        select(Envelope).where(Envelope.id == envelope_id)
    )
    envelope = envelope.scalar_one_or_none()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    recipient = await db.execute(
        select(Recipient).where(
            and_(Recipient.id == recipient_id, Recipient.envelope_id == envelope_id)
        )
    )
    recipient = recipient.scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # Check if all required fields are completed
    required_fields = await db.execute(
        select(Field).where(
            and_(
                Field.envelope_id == envelope_id,
                Field.recipient_id == recipient_id,
                Field.required == True
            )
        )
    )
    required_fields = required_fields.scalars().all()
    
    completed_values = await db.execute(
        select(FieldValue).where(
                and_(
                FieldValue.envelope_id == envelope_id,
                FieldValue.recipient_id == recipient_id,
                FieldValue.value.isnot(None)
            )
        )
    )
    completed_values = completed_values.scalars().all()
    completed_field_ids = {fv.field_id for fv in completed_values}
    
    missing_required = [f for f in required_fields if f.id not in completed_field_ids]
    if missing_required:
            raise HTTPException(
            status_code=400, 
            detail=f"Missing required fields: {[f.type for f in missing_required]}"
        )
    
        # Update recipient status
    recipient.status = RecipientStatus.COMPLETED
    recipient.signed_at = datetime.now(timezone.utc)
    recipient.signer_ip = request.client.host if request.client else None
    recipient.signer_user_agent = request.headers.get("user-agent")
    
    # Create audit event
    audit_event = AuditEvent(
        envelope_id=envelope_id,
        actor_type=ActorType.RECIPIENT,
        actor_id=recipient_id,
        event="recipient.completed",
        event_metadata={
            "signer_ip": recipient.signer_ip,
            "signer_user_agent": recipient.signer_user_agent
        }
    )
    db.add(audit_event)
        
        await db.commit()
    
    # Emit real-time event
    await realtime_service.emit_to_room(
        f"envelope_{envelope_id}",
        "recipient.progress",
        {
            "envelope_id": str(envelope_id),
            "recipient_id": str(recipient_id),
            "status": "completed"
        }
    )
    
    return {"message": "Signing completed successfully"}

@router.post("/{envelope_id}/{recipient_id}/decline")
async def decline_signing(
    envelope_id: uuid.UUID,
    recipient_id: uuid.UUID,
    reason: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Decline to sign the envelope."""
    # Verify envelope and recipient
    envelope = await db.execute(
        select(Envelope).where(Envelope.id == envelope_id)
    )
    envelope = envelope.scalar_one_or_none()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    recipient = await db.execute(
        select(Recipient).where(
            and_(Recipient.id == recipient_id, Recipient.envelope_id == envelope_id)
        )
    )
    recipient = recipient.scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # Update recipient status
    recipient.status = RecipientStatus.DECLINED
    recipient.signer_ip = request.client.host if request.client else None
    recipient.signer_user_agent = request.headers.get("user-agent")
    
    # Create audit event
    audit_event = AuditEvent(
        envelope_id=envelope_id,
        actor_type=ActorType.RECIPIENT,
        actor_id=recipient_id,
        event="recipient.declined",
        event_metadata={
            "reason": reason,
            "signer_ip": recipient.signer_ip,
            "signer_user_agent": recipient.signer_user_agent
        }
    )
    db.add(audit_event)
    
    await db.commit()
    
    # Emit real-time event
    await realtime_service.emit_to_room(
        f"envelope_{envelope_id}",
        "recipient.progress",
        {
            "envelope_id": str(envelope_id),
            "recipient_id": str(recipient_id),
            "status": "declined"
        }
    )
    
    return {"message": "Signing declined successfully"}