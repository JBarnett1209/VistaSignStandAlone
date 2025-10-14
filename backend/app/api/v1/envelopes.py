from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.core.database import get_db
from app.core.security.auth import AuthHandler
from app.schemas.envelope import EnvelopeCreate, EnvelopeOut, FieldsUpsertRequest
from app.models.envelope import Envelope, Recipient, Field, AuditEvent
from app.workers.finalize import finalize_pdf
from app.services import storage
from app.models.document import Document
from sqlalchemy import select, and_
from app.core.realtime import emit_envelope_status

router = APIRouter(prefix="/envelopes", tags=["envelopes"])


@router.post("/", response_model=EnvelopeOut)
async def create_envelope(payload: EnvelopeCreate, db: AsyncSession = Depends(get_db), user=Depends(AuthHandler.get_current_user)):
    env = Envelope(document_id=payload.document_id, subject=payload.subject, message=payload.message, status="DRAFT", created_by=user.id)
    db.add(env)
    await db.flush()
    for r in payload.recipients:
        db.add(Recipient(envelope_id=env.id, role=r.role, name=r.name, email=r.email, routing_order=r.routing_order))
    await db.commit()
    await db.refresh(env)
    return env


@router.get("/{envelope_id}", response_model=EnvelopeOut)
async def get_envelope(envelope_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(AuthHandler.get_current_user)):
    result = await db.execute(select(Envelope).where(Envelope.id == envelope_id))
    env = result.scalar_one_or_none()
    if not env:
        raise HTTPException(status_code=404, detail="Envelope not found")
    return env


@router.post("/{envelope_id}/fields")
async def upsert_fields(envelope_id: UUID, payload: FieldsUpsertRequest, db: AsyncSession = Depends(get_db), user=Depends(AuthHandler.get_current_user)):
    # naive upsert: replace all for envelope
    await db.execute(Field.__table__.delete().where(Field.envelope_id == envelope_id))
    for f in payload.fields:
        db.add(Field(envelope_id=envelope_id, recipient_id=f.recipient_id, page=f.page, type=f.type, rect=f.rect.model_dump(), required=f.required, tab_settings=f.tab_settings))
    await db.commit()
    return {"ok": True}


@router.post("/{envelope_id}/send")
async def send_envelope(envelope_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(AuthHandler.get_current_user)):
    # Load envelope and related document
    result = await db.execute(select(Envelope).where(Envelope.id == envelope_id))
    env = result.scalar_one_or_none()
    if not env:
        raise HTTPException(status_code=404, detail="Envelope not found")

    doc_res = await db.execute(select(Document).where(Document.id == env.document_id))
    doc = doc_res.scalar_one_or_none()
    if not doc or not doc.file_path:
        raise HTTPException(status_code=400, detail="Envelope document missing")

    # Read PDF bytes (convert on-the-fly if needed)
    if doc.mime_type != "application/pdf":
        from app.core.document_converter import DocumentConverter
        import os, uuid
        tmp_pdf = f"/tmp/{uuid.uuid4()}.pdf"
        ok = await DocumentConverter.convert_to_pdf(doc.file_path, tmp_pdf, doc.mime_type, doc.title or doc.filename)
        if not ok:
            raise HTTPException(status_code=500, detail="Failed to convert document to PDF")
        with open(tmp_pdf, "rb") as f:
            pdf_bytes = f.read()
    else:
        with open(doc.file_path, "rb") as f:
            pdf_bytes = f.read()

    # Fetch fields for flattening
    fields_res = await db.execute(select(Field).where(Field.envelope_id == envelope_id))
    fields = [
        {
            "page": f.page,
            "type": f.type,
            "rect_pts": f.rect,
            "required": f.required,
        }
        for f in fields_res.scalars().all()
    ]

    # Finalize (flatten + sign)
    signed_pdf = finalize_pdf(pdf_bytes, fields)
    signed_path, signed_key = storage.save_signed_pdf(signed_pdf)

    # Audit event
    db.add(AuditEvent(envelope_id=envelope_id, actor_type="USER", actor_id=user.id, event="envelope.sent", metadata={"signed_key": signed_key}))
    env.status = "SENT"
    await db.commit()
    # Emit status update
    try:
        await emit_envelope_status(str(envelope_id), {"status": "SENT"})
    except Exception:
        pass
    return {"ok": True, "signed_storage_key": signed_key}

