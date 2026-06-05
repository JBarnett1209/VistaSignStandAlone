from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security.auth import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.envelope import Envelope, Recipient, Field, FieldValue, AuditEvent, ActorType, EnvelopeStatus, RecipientStatus
from app.schemas.envelope import (
    EnvelopeCreate, EnvelopeUpdate, EnvelopeResponse, EnvelopeListResponse,
    RecipientCreate, RecipientUpdate, RecipientResponse,
    FieldCreate, FieldUpdate, FieldResponse,
    FieldValueCreate, FieldValueResponse
)
from app.workers.queue import enqueue_finalize
from app.core.realtime import realtime_service

router = APIRouter()

@router.post("/", response_model=EnvelopeResponse)
async def create_envelope(
    envelope_data: EnvelopeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new envelope."""
    # Verify document exists and user has access
    document = await db.execute(
        select(Document).where(
            and_(Document.id == envelope_data.document_id, Document.owner_id == uuid.UUID(current_user["user_id"]))
        )
    )
    document = document.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Create envelope
    envelope = Envelope(
        tenant_id=uuid.UUID(current_user["user_id"]),
        document_id=envelope_data.document_id,
        subject=envelope_data.subject,
        message=envelope_data.message,
        created_by=uuid.UUID(current_user["user_id"]),
        status=EnvelopeStatus.DRAFT
    )
    db.add(envelope)
    await db.flush()  # Get the envelope ID
    
    # Create recipients
    for i, recipient_data in enumerate(envelope_data.recipients):
        recipient = Recipient(
            envelope_id=envelope.id,
            name=recipient_data.name,
            email=recipient_data.email,
            role=recipient_data.role,
            routing_order=recipient_data.routing_order,
            status=RecipientStatus.PENDING
        )
        db.add(recipient)
    
    # Create fields if provided
    if envelope_data.fields:
        for field_data in envelope_data.fields:
            field = Field(
                envelope_id=envelope.id,
                page_index=field_data.page_index,
                type=field_data.type,
                rect_pts=field_data.rect_pts.dict(),
                rotation=field_data.rotation,
                required=field_data.required,
                recipient_id=field_data.recipient_id,
                tab_settings=field_data.tab_settings.dict() if field_data.tab_settings else None
            )
            db.add(field)
    
    # Create audit event
    audit_event = AuditEvent(
        envelope_id=envelope.id,
        actor_type=ActorType.USER,
        actor_id=uuid.UUID(current_user["user_id"]),
        event="envelope.created",
        event_metadata={"subject": envelope.subject}
    )
    db.add(audit_event)
    
    await db.commit()
    await db.refresh(envelope)
    
    return envelope

@router.get("/", response_model=EnvelopeListResponse)
async def list_envelopes(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List envelopes for the current user."""
    query = select(Envelope).where(Envelope.tenant_id == uuid.UUID(current_user["user_id"]))
    total_query = select(Envelope).where(Envelope.tenant_id == uuid.UUID(current_user["user_id"]))
    
    envelopes = await db.execute(query.offset(skip).limit(limit))
    total = await db.execute(total_query)
    
    return EnvelopeListResponse(
        envelopes=envelopes.scalars().all(),
        total=len(total.scalars().all()),
        skip=skip,
        limit=limit,
        has_more=skip + limit < len(total.scalars().all())
    )

@router.get("/{envelope_id}", response_model=EnvelopeResponse)
async def get_envelope(
    envelope_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific envelope."""
    envelope = await db.execute(
        select(Envelope).where(
            and_(Envelope.id == envelope_id, Envelope.tenant_id == uuid.UUID(current_user["user_id"]))
        )
    )
    envelope = envelope.scalar_one_or_none()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    return envelope

@router.put("/{envelope_id}", response_model=EnvelopeResponse)
async def update_envelope(
    envelope_id: uuid.UUID,
    envelope_data: EnvelopeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update an envelope."""
    envelope = await db.execute(
        select(Envelope).where(
            and_(Envelope.id == envelope_id, Envelope.tenant_id == uuid.UUID(current_user["user_id"]))
        )
    )
    envelope = envelope.scalar_one_or_none()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    if envelope.status != EnvelopeStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Cannot update envelope that is not in draft status")
    
    # Update fields
    if envelope_data.subject is not None:
        envelope.subject = envelope_data.subject
    if envelope_data.message is not None:
        envelope.message = envelope_data.message
    if envelope_data.signing_order is not None:
        envelope.signing_order = envelope_data.signing_order
    if envelope_data.status is not None:
        envelope.status = envelope_data.status
    
    envelope.updated_at = datetime.now(timezone.utc)
    
    # Create audit event
    audit_event = AuditEvent(
        envelope_id=envelope.id,
        actor_type=ActorType.USER,
        actor_id=uuid.UUID(current_user["user_id"]),
        event="envelope.updated",
        event_metadata={"changes": envelope_data.dict(exclude_unset=True)}
    )
    db.add(audit_event)
    
    await db.commit()
    await db.refresh(envelope)
    
    return envelope

@router.post("/{envelope_id}/send")
async def send_envelope(
    envelope_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send an envelope for signing."""
    envelope = await db.execute(
        select(Envelope).where(
            and_(Envelope.id == envelope_id, Envelope.tenant_id == uuid.UUID(current_user["user_id"]))
        )
    )
    envelope = envelope.scalar_one_or_none()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    if envelope.status != EnvelopeStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Envelope is not in draft status")
    
    # Validate envelope has recipients and fields
    recipients = await db.execute(
        select(Recipient).where(Recipient.envelope_id == envelope_id)
    )
    recipients = recipients.scalars().all()
    if not recipients:
        raise HTTPException(status_code=400, detail="Envelope must have at least one recipient")
    
    fields = await db.execute(
        select(Field).where(Field.envelope_id == envelope_id)
    )
    fields = fields.scalars().all()
    if not fields:
        raise HTTPException(status_code=400, detail="Envelope must have at least one field")
    
    # Update envelope status
    envelope.status = EnvelopeStatus.SENT
    envelope.updated_at = datetime.now(timezone.utc)
    
    # Create audit event
    audit_event = AuditEvent(
        envelope_id=envelope.id,
        actor_type=ActorType.USER,
        actor_id=uuid.UUID(current_user["user_id"]),
        event="envelope.sent",
        event_metadata={"recipient_count": len(recipients), "field_count": len(fields)}
    )
    db.add(audit_event)
    
    await db.commit()
    
    # Enqueue finalization job
    enqueue_finalize(str(envelope_id))
    
    # Emit real-time event
    await realtime_service.emit_to_room(
        f"envelope_{envelope_id}",
        "envelope.status",
        {"envelope_id": str(envelope_id), "status": "sent"}
    )
    
    return {"message": "Envelope sent successfully", "envelope_id": envelope_id}

@router.post("/{envelope_id}/void")
async def void_envelope(
    envelope_id: uuid.UUID,
    reason: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Void an envelope."""
    envelope = await db.execute(
        select(Envelope).where(
            and_(Envelope.id == envelope_id, Envelope.tenant_id == uuid.UUID(current_user["user_id"]))
        )
    )
    envelope = envelope.scalar_one_or_none()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    if envelope.status in [EnvelopeStatus.COMPLETED, EnvelopeStatus.VOIDED]:
        raise HTTPException(status_code=400, detail="Cannot void envelope in current status")
    
    envelope.status = EnvelopeStatus.VOIDED
    envelope.updated_at = datetime.now(timezone.utc)
    
    # Create audit event
    audit_event = AuditEvent(
        envelope_id=envelope.id,
        actor_type=ActorType.USER,
        actor_id=uuid.UUID(current_user["user_id"]),
        event="envelope.voided",
        event_metadata={"reason": reason}
    )
    db.add(audit_event)
    
    await db.commit()
    
    # Emit real-time event
    await realtime_service.emit_to_room(
        f"envelope_{envelope_id}",
        "envelope.status",
        {"envelope_id": str(envelope_id), "status": "voided"}
    )
    
    return {"message": "Envelope voided successfully", "envelope_id": envelope_id}

@router.post("/{envelope_id}/fields")
async def upsert_fields(
    envelope_id: uuid.UUID,
    fields_data: List[FieldCreate],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create or update fields for an envelope."""
    envelope = await db.execute(
        select(Envelope).where(
            and_(Envelope.id == envelope_id, Envelope.tenant_id == uuid.UUID(current_user["user_id"]))
        )
    )
    envelope = envelope.scalar_one_or_none()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    if envelope.status != EnvelopeStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Cannot modify fields of envelope that is not in draft status")
    
    # Delete existing fields
    existing_fields = await db.execute(
        select(Field).where(Field.envelope_id == envelope_id)
    )
    for field in existing_fields.scalars().all():
        await db.delete(field)
    
    # Create new fields
    for field_data in fields_data:
        field = Field(
            envelope_id=envelope_id,
            page_index=field_data.page_index,
            type=field_data.type,
            rect_pts=field_data.rect_pts.dict(),
            rotation=field_data.rotation,
            required=field_data.required,
            recipient_id=field_data.recipient_id,
            tab_settings=field_data.tab_settings.dict() if field_data.tab_settings else None
        )
        db.add(field)
    
    # Create audit event
    audit_event = AuditEvent(
        envelope_id=envelope.id,
        actor_type=ActorType.USER,
        actor_id=uuid.UUID(current_user["user_id"]),
        event="envelope.fields_updated",
        event_metadata={"field_count": len(fields_data)}
    )
    db.add(audit_event)
    
    await db.commit()
    
    return {"message": "Fields updated successfully", "field_count": len(fields_data)}

@router.get("/{envelope_id}/recipients", response_model=List[RecipientResponse])
async def list_recipients(
    envelope_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List recipients for an envelope."""
    envelope = await db.execute(
        select(Envelope).where(
            and_(Envelope.id == envelope_id, Envelope.tenant_id == uuid.UUID(current_user["user_id"]))
        )
    )
    envelope = envelope.scalar_one_or_none()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    recipients = await db.execute(
        select(Recipient).where(Recipient.envelope_id == envelope_id)
    )
    return recipients.scalars().all()

@router.post("/{envelope_id}/recipients", response_model=RecipientResponse)
async def add_recipient(
    envelope_id: uuid.UUID,
    recipient_data: RecipientCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a recipient to an envelope."""
    envelope = await db.execute(
        select(Envelope).where(
            and_(Envelope.id == envelope_id, Envelope.tenant_id == uuid.UUID(current_user["user_id"]))
        )
    )
    envelope = envelope.scalar_one_or_none()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    if envelope.status != EnvelopeStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Cannot modify recipients of envelope that is not in draft status")
    
    recipient = Recipient(
        envelope_id=envelope_id,
        name=recipient_data.name,
        email=recipient_data.email,
        role=recipient_data.role,
        routing_order=recipient_data.routing_order,
        status=RecipientStatus.PENDING
    )
    db.add(recipient)
    await db.commit()
    await db.refresh(recipient)
    
    return recipient

@router.put("/{envelope_id}/recipients/{recipient_id}", response_model=RecipientResponse)
async def update_recipient(
    envelope_id: uuid.UUID,
    recipient_id: uuid.UUID,
    recipient_data: RecipientUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a recipient."""
    envelope = await db.execute(
        select(Envelope).where(
            and_(Envelope.id == envelope_id, Envelope.tenant_id == uuid.UUID(current_user["user_id"]))
        )
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
    
    # Update fields
    if recipient_data.name is not None:
        recipient.name = recipient_data.name
    if recipient_data.email is not None:
        recipient.email = recipient_data.email
    if recipient_data.role is not None:
        recipient.role = recipient_data.role
    if recipient_data.routing_order is not None:
        recipient.routing_order = recipient_data.routing_order
    if recipient_data.status is not None:
        recipient.status = recipient_data.status
    
    await db.commit()
    await db.refresh(recipient)
    
    return recipient

@router.delete("/{envelope_id}/recipients/{recipient_id}")
async def delete_recipient(
    envelope_id: uuid.UUID,
    recipient_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a recipient from an envelope."""
    envelope = await db.execute(
        select(Envelope).where(
            and_(Envelope.id == envelope_id, Envelope.tenant_id == uuid.UUID(current_user["user_id"]))
        )
    )
    envelope = envelope.scalar_one_or_none()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    if envelope.status != EnvelopeStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Cannot modify recipients of envelope that is not in draft status")
    
    recipient = await db.execute(
        select(Recipient).where(
            and_(Recipient.id == recipient_id, Recipient.envelope_id == envelope_id)
        )
    )
    recipient = recipient.scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    await db.delete(recipient)
    await db.commit()
    
    return {"message": "Recipient deleted successfully"}