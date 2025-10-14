from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.core.database import get_db
from app.core.security.auth import AuthHandler
from app.schemas.envelope import EnvelopeCreate, EnvelopeOut, FieldsUpsertRequest
from app.models.envelope import Envelope, Recipient, Field

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

