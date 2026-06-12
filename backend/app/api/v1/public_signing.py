"""
Public (recipient-facing) envelope signing — token-gated.

The signing link carries an opaque SignLink.token_jti (created when a workflow
is sent, see services/envelope_dispatch). The token resolves to an
(envelope, recipient) pair; the recipient views the document, fills their
fields, and completes. When every recipient has completed, the finalize worker
produces the signed PDF + evidence and the originating workflow is marked done.
"""

import hashlib
import logging
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security.auth import AuthHandler
from app.models.envelope import (
    Envelope, Recipient, Field, FieldValue, SignLink, AuditEvent,
    EnvelopeStatus, RecipientStatus, ActorType,
)
from app.models.document import Document
from app.models.workflow import Workflow, WorkflowParticipant, WorkflowStatus
from app.workers.queue import enqueue_finalize

logger = logging.getLogger(__name__)
router = APIRouter()


async def _resolve(token: str, db: AsyncSession):
    """Resolve a signing token to (sign_link, envelope, recipient) or raise."""
    if not token or not token.strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token required")
    link = (await db.execute(
        select(SignLink).where(SignLink.token_jti == token.strip())
    )).scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid or expired signing link")
    if link.expires_at and link.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Signing link expired")
    envelope = await db.get(Envelope, link.envelope_id)
    recipient = await db.get(Recipient, link.recipient_id)
    if not envelope or not recipient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Envelope not found")
    return link, envelope, recipient


async def _recipient_fields(db: AsyncSession, envelope_id, recipient_id):
    """Fields assigned to this recipient (or unassigned)."""
    return (await db.execute(
        select(Field).where(and_(
            Field.envelope_id == envelope_id,
            or_(Field.recipient_id == recipient_id, Field.recipient_id.is_(None)),
        ))
    )).scalars().all()


async def _sync_participant(db: AsyncSession, recipient: Recipient, status_value: str, when: datetime):
    """Mirror a recipient's signing status onto its WorkflowParticipant (if any)."""
    if not recipient.workflow_participant_id:
        return
    participant = await db.get(WorkflowParticipant, recipient.workflow_participant_id)
    if participant:
        participant.status = status_value
        if status_value == "completed":
            participant.signed_at = when


async def _maybe_finalize(db: AsyncSession, envelope: Envelope):
    """If all recipients are complete, enqueue finalize and complete the workflow."""
    recipients = (await db.execute(
        select(Recipient).where(Recipient.envelope_id == envelope.id)
    )).scalars().all()
    if not recipients or not all(r.status == RecipientStatus.COMPLETED for r in recipients):
        return False
    db.add(AuditEvent(envelope_id=envelope.id, actor_type=ActorType.SYSTEM,
                      event="envelope.all_signed", event_metadata={}))
    # Mark the originating workflow complete.
    workflow = (await db.execute(
        select(Workflow).where(Workflow.envelope_id == envelope.id)
    )).scalar_one_or_none()
    if workflow:
        workflow.status = WorkflowStatus.COMPLETED
        workflow.completed_at = datetime.now(timezone.utc)
    await db.commit()
    try:
        enqueue_finalize(str(envelope.id))
    except Exception as e:
        logger.error(f"Failed to enqueue finalize for envelope {envelope.id}: {e}")
    return True


@router.get("/sign/{token}")
async def get_signing_page(token: str, db: AsyncSession = Depends(get_db)):
    """Return the envelope, recipient, document, and this recipient's fields."""
    link, envelope, recipient = await _resolve(token, db)
    document = await db.get(Document, envelope.document_id)

    fields = await _recipient_fields(db, envelope.id, recipient.id)
    values = (await db.execute(
        select(FieldValue).where(and_(
            FieldValue.envelope_id == envelope.id,
            FieldValue.recipient_id == recipient.id,
        ))
    )).scalars().all()
    value_map = {str(v.field_id): v.value for v in values}

    document_payload = None
    if document:
        doc_token = AuthHandler().create_access_token(
            {"sub": str(document.id), "type": "document_access"},
            expires_delta=timedelta(hours=12),
        )
        document_payload = {
            "id": str(document.id),
            "title": document.title,
            "file_url": f"/api/v1/documents/public/{document.id}/file?token={doc_token}",
        }

    return {
        "envelope": {"id": str(envelope.id), "subject": envelope.subject,
                     "message": envelope.message, "status": envelope.status},
        "recipient": {"id": str(recipient.id), "name": recipient.name,
                      "email": recipient.email, "status": recipient.status},
        "document": document_payload,
        "already_signed": recipient.status == RecipientStatus.COMPLETED or envelope.status != EnvelopeStatus.SENT,
        "fields": [
            {"id": str(f.id), "type": f.type, "page_index": f.page_index,
             "rect_pts": f.rect_pts, "required": f.required, "value": value_map.get(str(f.id))}
            for f in fields
        ],
    }


@router.post("/sign/{token}/fields/{field_id}")
async def submit_field_value(token: str, field_id: str, payload: dict, request: Request,
                             db: AsyncSession = Depends(get_db)):
    """Save (upsert) a value for one of this recipient's fields."""
    link, envelope, recipient = await _resolve(token, db)
    if envelope.status != EnvelopeStatus.SENT:
        raise HTTPException(status_code=400, detail="This document is no longer open for signing")
    if recipient.status == RecipientStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="You have already completed signing")
    try:
        field = await db.get(Field, uuid.UUID(field_id))
    except ValueError:
        raise HTTPException(status_code=404, detail="Field not found")
    if not field or field.envelope_id != envelope.id:
        raise HTTPException(status_code=404, detail="Field not found")
    # A recipient may only fill blocks assigned to them (or unassigned ones).
    if field.recipient_id and str(field.recipient_id) != str(recipient.id):
        raise HTTPException(status_code=403, detail="This field is assigned to another signer")

    value = payload.get("value")
    now = datetime.now(timezone.utc)
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    evidence = hashlib.sha256(
        f"{value}|{field.id}|{recipient.id}|{envelope.id}|{now.isoformat()}".encode()
    ).hexdigest()

    existing = (await db.execute(
        select(FieldValue).where(and_(
            FieldValue.field_id == field.id, FieldValue.recipient_id == recipient.id,
        ))
    )).scalar_one_or_none()
    if existing:
        existing.value = value
        existing.signed_at = now
        existing.signer_ip = ip
        existing.signer_user_agent = ua
        existing.evidence_hash = evidence
    else:
        db.add(FieldValue(field_id=field.id, envelope_id=envelope.id, recipient_id=recipient.id,
                          value=value, signed_at=now, signer_ip=ip, signer_user_agent=ua,
                          evidence_hash=evidence))
    await db.commit()
    return {"message": "Field saved"}


@router.post("/sign/{token}/complete")
async def complete_signing(token: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Mark this recipient complete; finalize when everyone has signed."""
    link, envelope, recipient = await _resolve(token, db)
    if recipient.status == RecipientStatus.COMPLETED:
        return {"message": "Already completed"}
    if envelope.status != EnvelopeStatus.SENT:
        raise HTTPException(status_code=400, detail="This document is no longer open for signing")

    # All required fields for this recipient must have a value.
    required = [f for f in await _recipient_fields(db, envelope.id, recipient.id) if f.required]
    if required:
        values = (await db.execute(
            select(FieldValue).where(and_(
                FieldValue.envelope_id == envelope.id,
                FieldValue.recipient_id == recipient.id,
            ))
        )).scalars().all()
        filled = {str(v.field_id) for v in values if v.value not in (None, "", [])}
        missing = [f for f in required if str(f.id) not in filled]
        if missing:
            raise HTTPException(status_code=400,
                                detail=f"{len(missing)} required field(s) not completed")

    now = datetime.now(timezone.utc)
    recipient.status = RecipientStatus.COMPLETED
    recipient.signed_at = now
    recipient.signer_ip = request.client.host if request.client else None
    recipient.signer_user_agent = request.headers.get("user-agent")
    link.used_at = now
    db.add(AuditEvent(envelope_id=envelope.id, actor_type=ActorType.RECIPIENT, actor_id=recipient.id,
                      event="recipient.completed", event_metadata={"email": recipient.email}))
    await _sync_participant(db, recipient, "completed", now)
    await db.commit()

    await _maybe_finalize(db, envelope)
    return {"message": "Signing completed"}


@router.post("/sign/{token}/decline")
async def decline_signing(token: str, request: Request, payload: dict | None = None,
                          db: AsyncSession = Depends(get_db)):
    """Decline to sign: voids the envelope and cancels the workflow."""
    link, envelope, recipient = await _resolve(token, db)
    now = datetime.now(timezone.utc)
    reason = (payload or {}).get("reason") if payload else None

    recipient.status = RecipientStatus.DECLINED
    envelope.status = EnvelopeStatus.VOIDED
    link.used_at = now
    db.add(AuditEvent(envelope_id=envelope.id, actor_type=ActorType.RECIPIENT, actor_id=recipient.id,
                      event="recipient.declined", event_metadata={"email": recipient.email, "reason": reason}))
    await _sync_participant(db, recipient, "declined", now)
    workflow = (await db.execute(
        select(Workflow).where(Workflow.envelope_id == envelope.id)
    )).scalar_one_or_none()
    if workflow:
        workflow.status = WorkflowStatus.CANCELLED
    await db.commit()
    return {"message": "Signing declined"}
