"""
Public (recipient-facing) signing endpoints.

Signing links are token-gated: the emailed URL carries an opaque
WorkflowParticipant.signing_token (see workflows.send_workflow) rather than raw
workflow/participant IDs. This mirrors UnitVista's VistaSignSignLink.token_jti
flow and prevents enumeration of documents by guessing UUIDs.

The token is resolved to a (workflow, participant) pair and the request is then
served by the existing, battle-tested workflow signing handlers.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.workflow import WorkflowParticipant

router = APIRouter()


async def _resolve_participant(token: str, db: AsyncSession) -> WorkflowParticipant:
    """Resolve a signing token to its WorkflowParticipant, or raise."""
    if not token or not token.strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token required")
    result = await db.execute(
        select(WorkflowParticipant).where(WorkflowParticipant.signing_token == token.strip())
    )
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid or expired signing link")
    return participant


@router.get("/sign/{token}")
async def get_public_signing_page(token: str, db: AsyncSession = Depends(get_db)):
    """Return the signing page (workflow + participant + document + fields) for a token."""
    participant = await _resolve_participant(token, db)
    # Lazy import to avoid a circular import (workflows imports nothing from here).
    from app.api.v1.workflows import get_workflow_signing_page
    return await get_workflow_signing_page(str(participant.workflow_id), str(participant.id), db)


@router.post("/sign/{token}")
async def submit_public_signing(
    token: str,
    signature_data: dict,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Submit a signature (or decline) for a token. Body matches the workflow sign contract."""
    participant = await _resolve_participant(token, db)
    from app.api.v1.workflows import sign_workflow_document
    return await sign_workflow_document(
        str(participant.workflow_id), str(participant.id), signature_data, request, db
    )
