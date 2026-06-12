"""
VistaSign Workflows API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
import logging
import uuid
import secrets
from datetime import datetime, timedelta, timezone

from app.core.database import get_db
from app.core.security.auth import get_current_user
from app.core.legal_signature import legal_signature_service
from app.core.config import settings
from app.models.workflow import Workflow, WorkflowStep, WorkflowParticipant, WorkflowStatus
from app.models.document import Document
from app.schemas.workflow import (
    WorkflowCreate, WorkflowResponse, WorkflowListResponse,
    WorkflowStepCreate, WorkflowStepResponse,
    WorkflowParticipantCreate, WorkflowParticipantResponse, WorkflowParticipantUpdate
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/", response_model=WorkflowResponse)
async def create_workflow(
    workflow_data: WorkflowCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new workflow"""
    try:
        # Verify document exists and user has access
        result = await db.execute(
            select(Document).where(
                and_(
                    Document.id == workflow_data.document_id,
                    Document.owner_id == uuid.UUID(current_user["user_id"])
                )
            )
        )
        document = result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        # Create workflow
        workflow = Workflow(
            name=workflow_data.name,
            description=workflow_data.description,
            workflow_data=workflow_data.workflow_data,
            document_id=workflow_data.document_id,
            created_by=uuid.UUID(current_user["user_id"]),
            status=WorkflowStatus.DRAFT
        )
        
        db.add(workflow)
        await db.commit()
        await db.refresh(workflow)
        
        return WorkflowResponse(
            id=str(workflow.id),
            name=workflow.name,
            description=workflow.description,
            status=workflow.status.value,
            document_id=str(workflow.document_id),
            envelope_id=str(workflow.envelope_id) if workflow.envelope_id else None,
            created_by=str(workflow.created_by),
            created_at=workflow.created_at,
            started_at=workflow.started_at,
            completed_at=workflow.completed_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create workflow error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create workflow"
        )

@router.get("/", response_model=WorkflowListResponse)
async def list_workflows(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status_filter: Optional[str] = Query(None, alias="status"),
    document_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List workflows"""
    try:
        # Build query
        query = select(Workflow).where(Workflow.created_by == uuid.UUID(current_user["user_id"]))

        # Apply filters
        if status_filter:
            query = query.where(Workflow.status == status_filter)
        if document_id:
            query = query.where(Workflow.document_id == document_id)

        # Get total count
        count_query = select(Workflow).where(Workflow.created_by == uuid.UUID(current_user["user_id"]))
        if status_filter:
            count_query = count_query.where(Workflow.status == status_filter)
        if document_id:
            count_query = count_query.where(Workflow.document_id == document_id)
        
        total_result = await db.execute(count_query)
        total = len(total_result.scalars().all())
        
        # Get workflows with pagination and participants
        result = await db.execute(query.offset(skip).limit(limit))
        workflows = result.scalars().all()
        
        # Get participants for each workflow
        workflow_responses = []
        for workflow in workflows:
            # Get participants for this workflow
            participants_query = select(WorkflowParticipant).where(WorkflowParticipant.workflow_id == workflow.id)
            participants_result = await db.execute(participants_query)
            participants = participants_result.scalars().all()
            
            workflow_responses.append(WorkflowResponse(
                id=str(workflow.id),
                name=workflow.name,
                description=workflow.description,
                status=workflow.status.value,
                document_id=str(workflow.document_id),
                envelope_id=str(workflow.envelope_id) if workflow.envelope_id else None,
                created_by=str(workflow.created_by),
                created_at=workflow.created_at,
                started_at=workflow.started_at,
                completed_at=workflow.completed_at,
                participants=[
                    WorkflowParticipantResponse(
                        id=str(participant.id),
                        email=participant.email,
                        signingOrder=participant.signingOrder,
                        role=participant.role,
                        permissions=participant.permissions,
                        workflow_id=str(participant.workflow_id),
                        user_id=str(participant.user_id) if participant.user_id else None,
                        status=participant.status,
                        signed_at=participant.signed_at,
                        signature_data=participant.signature_data,
                        ip_address=participant.ip_address,
                        user_agent=participant.user_agent,
                        created_at=participant.created_at,
                        updated_at=participant.updated_at
                    ) for participant in participants
                ]
            ))
        
        return WorkflowListResponse(
            workflows=workflow_responses,
            total=total,
            skip=skip,
            limit=limit,
            has_more=(skip + limit) < total
        )
        
    except Exception as e:
        logger.error(f"List workflows error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list workflows"
        )

@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get workflow by ID"""
    try:
        result = await db.execute(
            select(Workflow).where(
                and_(
                    Workflow.id == workflow_id,
                    Workflow.created_by == uuid.UUID(current_user["user_id"])
                )
            )
        )
        workflow = result.scalar_one_or_none()
        
        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow not found"
            )
        
        # Get participants for this workflow
        participants_query = select(WorkflowParticipant).where(WorkflowParticipant.workflow_id == workflow.id)
        participants_result = await db.execute(participants_query)
        participants = participants_result.scalars().all()
        
        return WorkflowResponse(
            id=str(workflow.id),
            name=workflow.name,
            description=workflow.description,
            status=workflow.status.value,
            document_id=str(workflow.document_id),
            envelope_id=str(workflow.envelope_id) if workflow.envelope_id else None,
            created_by=str(workflow.created_by),
            created_at=workflow.created_at,
            started_at=workflow.started_at,
            completed_at=workflow.completed_at,
            participants=[
                WorkflowParticipantResponse(
                    id=str(participant.id),
                    email=participant.email,
                    signingOrder=participant.signingOrder,
                    role=participant.role,
                    permissions=participant.permissions,
                    workflow_id=str(participant.workflow_id),
                    user_id=str(participant.user_id) if participant.user_id else None,
                    status=participant.status,
                    signed_at=participant.signed_at,
                    signature_data=participant.signature_data,
                    ip_address=participant.ip_address,
                    user_agent=participant.user_agent,
                    created_at=participant.created_at,
                    updated_at=participant.updated_at
                ) for participant in participants
            ]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get workflow error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get workflow"
        )

@router.post("/{workflow_id}/steps", response_model=WorkflowStepResponse)
async def add_workflow_step(
    workflow_id: str,
    step_data: WorkflowStepCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Add a step to a workflow"""
    try:
        # Verify workflow exists and user has access
        result = await db.execute(
            select(Workflow).where(
                and_(
                    Workflow.id == workflow_id,
                    Workflow.created_by == uuid.UUID(current_user["user_id"])
                )
            )
        )
        workflow = result.scalar_one_or_none()
        
        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow not found"
            )
        
        # Create workflow step
        step = WorkflowStep(
            workflow_id=workflow_id,
            step_name=step_data.step_name,
            step_type=step_data.step_type,
            step_order=step_data.step_order,
            step_data=step_data.step_data,
            is_required=step_data.is_required,
            is_parallel=step_data.is_parallel,
            assigned_to=step_data.assigned_to,
            due_date=step_data.due_date
        )
        
        db.add(step)
        await db.commit()
        await db.refresh(step)
        
        return WorkflowStepResponse(
            id=str(step.id),
            step_name=step.step_name,
            step_type=step.step_type.value,
            step_order=step.step_order,
            status=step.status.value,
            is_required=step.is_required,
            is_parallel=step.is_parallel,
            assigned_to=str(step.assigned_to) if step.assigned_to else None,
            due_date=step.due_date,
            created_at=step.created_at,
            started_at=step.started_at,
            completed_at=step.completed_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add workflow step error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add workflow step"
        )

@router.post("/{workflow_id}/participants", response_model=WorkflowParticipantResponse)
async def add_workflow_participant(
    workflow_id: str,
    participant_data: WorkflowParticipantCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Add a participant to a workflow"""
    try:
        # Verify workflow exists and user has access
        result = await db.execute(
            select(Workflow).where(
                and_(
                    Workflow.id == workflow_id,
                    Workflow.created_by == uuid.UUID(current_user["user_id"])
                )
            )
        )
        workflow = result.scalar_one_or_none()
        
        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow not found"
            )
        
        # Create workflow participant
        participant = WorkflowParticipant(
            workflow_id=workflow_id,
            email=participant_data.email,
            signingOrder=participant_data.signingOrder,
            role=participant_data.role,
            permissions=participant_data.permissions,
            user_id=None  # Will be set when user signs up or is found
        )
        
        db.add(participant)

        # Auto-save the recipient to the owner's address book (DocuSign-style).
        try:
            from app.api.v1.contacts import upsert_contact
            await upsert_contact(db, uuid.UUID(current_user["user_id"]), participant_data.email)
        except Exception as e:
            logger.warning(f"Failed to auto-save contact: {e}")

        await db.commit()
        await db.refresh(participant)

        return WorkflowParticipantResponse(
            id=str(participant.id),
            workflow_id=str(participant.workflow_id),
            email=participant.email,
            signingOrder=participant.signingOrder,
            role=participant.role,
            user_id=str(participant.user_id) if participant.user_id else None,
            permissions=participant.permissions,
            status=participant.status,
            signed_at=participant.signed_at,
            signature_data=participant.signature_data,
            ip_address=participant.ip_address,
            user_agent=participant.user_agent,
            created_at=participant.created_at,
            updated_at=participant.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add workflow participant error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add workflow participant"
        )

@router.put("/{workflow_id}/participants/{participant_id}", response_model=WorkflowParticipantResponse)
async def update_workflow_participant(
    workflow_id: str,
    participant_id: str,
    payload: WorkflowParticipantUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a participant (e.g. change their email) and sync the envelope recipient."""
    try:
        workflow = (await db.execute(
            select(Workflow).where(and_(
                Workflow.id == workflow_id,
                Workflow.created_by == uuid.UUID(current_user["user_id"]),
            ))
        )).scalar_one_or_none()
        if not workflow:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")

        participant = await db.get(WorkflowParticipant, uuid.UUID(participant_id))
        if not participant or str(participant.workflow_id) != str(workflow_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")

        # Keep the envelope recipient (which owns the sign link) in sync.
        from app.models.envelope import Recipient
        recipient = (await db.execute(
            select(Recipient).where(Recipient.workflow_participant_id == participant.id)
        )).scalar_one_or_none()

        if payload.email is not None:
            new_email = payload.email.strip()
            if not new_email:
                raise HTTPException(status_code=400, detail="Email cannot be empty")
            participant.email = new_email
            if recipient:
                recipient.email = new_email
                recipient.name = new_email.split("@")[0]
            try:
                from app.api.v1.contacts import upsert_contact
                await upsert_contact(db, uuid.UUID(current_user["user_id"]), new_email)
            except Exception as e:
                logger.warning(f"Failed to auto-save contact: {e}")
        if payload.signingOrder is not None:
            participant.signingOrder = payload.signingOrder
            if recipient:
                recipient.routing_order = payload.signingOrder
        if payload.role is not None:
            participant.role = payload.role

        await db.commit()
        await db.refresh(participant)
        return WorkflowParticipantResponse(
            id=str(participant.id),
            workflow_id=str(participant.workflow_id),
            email=participant.email,
            signingOrder=participant.signingOrder,
            role=participant.role,
            user_id=str(participant.user_id) if participant.user_id else None,
            permissions=participant.permissions,
            status=participant.status,
            signed_at=participant.signed_at,
            signature_data=participant.signature_data,
            ip_address=participant.ip_address,
            user_agent=participant.user_agent,
            created_at=participant.created_at,
            updated_at=participant.updated_at,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update workflow participant error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update participant")


@router.post("/{workflow_id}/participants/{participant_id}/resend")
async def resend_workflow_participant(
    workflow_id: str,
    participant_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Re-email the signing link to one participant (e.g. after changing their email)."""
    try:
        workflow = (await db.execute(
            select(Workflow).where(and_(
                Workflow.id == workflow_id,
                Workflow.created_by == uuid.UUID(current_user["user_id"]),
            ))
        )).scalar_one_or_none()
        if not workflow:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
        if not workflow.envelope_id:
            raise HTTPException(status_code=400, detail="Workflow has not been sent yet")

        from app.models.envelope import Envelope, Recipient, RecipientStatus
        participant = await db.get(WorkflowParticipant, uuid.UUID(participant_id))
        if not participant or str(participant.workflow_id) != str(workflow_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
        recipient = (await db.execute(
            select(Recipient).where(Recipient.workflow_participant_id == participant.id)
        )).scalar_one_or_none()
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient not found for this participant")
        if recipient.status in (RecipientStatus.COMPLETED, RecipientStatus.DECLINED):
            raise HTTPException(status_code=400, detail="This recipient has already finished signing")

        envelope = await db.get(Envelope, workflow.envelope_id)
        document = await db.get(Document, envelope.document_id)
        from app.services.envelope_dispatch import dispatch_envelope
        await dispatch_envelope(db, envelope, [recipient], document)
        await db.commit()
        return {"message": f"Signing link sent to {recipient.email}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Resend participant error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to resend signing link")


@router.get("/{workflow_id}/participants/{participant_id}/link")
async def get_participant_signing_link(
    workflow_id: str,
    participant_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Return a recipient's signing-link URL so the operator can share it manually
    (e.g. paste into a text message if email isn't reaching them)."""
    try:
        workflow = (await db.execute(
            select(Workflow).where(and_(
                Workflow.id == workflow_id,
                Workflow.created_by == uuid.UUID(current_user["user_id"]),
            ))
        )).scalar_one_or_none()
        if not workflow:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
        if not workflow.envelope_id:
            raise HTTPException(status_code=400, detail="Workflow has not been sent yet")

        from app.models.envelope import Recipient, SignLink
        from app.core.config import settings
        participant = await db.get(WorkflowParticipant, uuid.UUID(participant_id))
        if not participant or str(participant.workflow_id) != str(workflow_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
        recipient = (await db.execute(
            select(Recipient).where(Recipient.workflow_participant_id == participant.id)
        )).scalar_one_or_none()
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient not found for this participant")
        link = (await db.execute(
            select(SignLink).where(SignLink.recipient_id == recipient.id)
        )).scalar_one_or_none()
        if not link:
            raise HTTPException(status_code=404, detail="No signing link found for this recipient")

        base = (settings.FRONTEND_URL or "").rstrip("/")
        return {"email": recipient.email, "url": f"{base}/sign/{link.token_jti}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get participant link error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get signing link")


@router.post("/{workflow_id}/complete")
async def force_complete_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Finalize the workflow NOW using whatever signatures have been collected,
    without waiting for the remaining recipients."""
    try:
        workflow = (await db.execute(
            select(Workflow).where(and_(
                Workflow.id == workflow_id,
                Workflow.created_by == uuid.UUID(current_user["user_id"]),
            ))
        )).scalar_one_or_none()
        if not workflow:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
        if not workflow.envelope_id:
            raise HTTPException(status_code=400, detail="Workflow has not been sent yet")

        from app.models.envelope import Envelope, EnvelopeStatus, AuditEvent, ActorType
        from app.workers.queue import enqueue_finalize
        envelope = await db.get(Envelope, workflow.envelope_id)
        if not envelope:
            raise HTTPException(status_code=404, detail="Envelope not found")
        if envelope.status == EnvelopeStatus.COMPLETED:
            return {"message": "Workflow is already completed"}
        if envelope.status != EnvelopeStatus.SENT:
            raise HTTPException(status_code=400, detail="This workflow cannot be completed in its current state")

        workflow.status = WorkflowStatus.COMPLETED
        workflow.completed_at = datetime.now(timezone.utc)
        db.add(AuditEvent(
            envelope_id=envelope.id, actor_type=ActorType.SYSTEM,
            event="envelope.force_completed",
            event_metadata={"by": current_user.get("email")},
        ))
        await db.commit()
        try:
            enqueue_finalize(str(envelope.id))
        except Exception as e:
            logger.error(f"Failed to enqueue finalize for {envelope.id}: {e}")
            raise HTTPException(status_code=500, detail="Failed to start finalization")
        return {"message": "Completing the workflow with current signatures. The signed copy will be emailed shortly."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Force complete workflow error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to complete workflow")


@router.post("/{workflow_id}/cancel")
async def cancel_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Cancel the workflow and invalidate ALL signing links so no one can sign."""
    try:
        workflow = (await db.execute(
            select(Workflow).where(and_(
                Workflow.id == workflow_id,
                Workflow.created_by == uuid.UUID(current_user["user_id"]),
            ))
        )).scalar_one_or_none()
        if not workflow:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")

        now = datetime.now(timezone.utc)
        from app.models.envelope import Envelope, EnvelopeStatus, SignLink, AuditEvent, ActorType
        if workflow.envelope_id:
            envelope = await db.get(Envelope, workflow.envelope_id)
            if envelope and envelope.status == EnvelopeStatus.COMPLETED:
                raise HTTPException(status_code=400, detail="Workflow is already completed and cannot be cancelled")
            if envelope:
                envelope.status = EnvelopeStatus.VOIDED
                # Expire every signing link so opening one shows an expired/closed page.
                links = (await db.execute(
                    select(SignLink).where(SignLink.envelope_id == envelope.id)
                )).scalars().all()
                for l in links:
                    l.expires_at = now
                db.add(AuditEvent(
                    envelope_id=envelope.id, actor_type=ActorType.SYSTEM,
                    event="envelope.cancelled",
                    event_metadata={"by": current_user.get("email")},
                ))
        workflow.status = WorkflowStatus.CANCELLED
        await db.commit()
        return {"message": "Workflow cancelled. All signing links are now invalid."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cancel workflow error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to cancel workflow")


@router.get("/{workflow_id}/preview")
async def preview_signed_document(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Return the document flattened with whatever signatures/values have been
    collected SO FAR (in-progress preview for the owner), without finalizing."""
    try:
        from fastapi.responses import Response
        workflow = (await db.execute(
            select(Workflow).where(and_(
                Workflow.id == workflow_id,
                Workflow.created_by == uuid.UUID(current_user["user_id"]),
            ))
        )).scalar_one_or_none()
        if not workflow:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
        document = await db.get(Document, workflow.document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        import os
        # Not sent yet: no signatures, just return the document's PDF rendition.
        if not workflow.envelope_id:
            if document.mime_type == "application/pdf" and os.path.exists(document.file_path):
                with open(document.file_path, "rb") as f:
                    return Response(content=f.read(), media_type="application/pdf")
            import tempfile
            from app.core.document_converter import DocumentConverter
            tmp = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}.pdf")
            ok = await DocumentConverter.convert_to_pdf(document.file_path, tmp, document.mime_type, document.title or document.filename)
            data = b""
            if ok and os.path.exists(tmp):
                with open(tmp, "rb") as f:
                    data = f.read()
                os.remove(tmp)
            return Response(content=data, media_type="application/pdf")

        from app.models.envelope import Envelope, Field, FieldValue
        from app.services.pdf_flattener import pdf_flattener
        envelope = await db.get(Envelope, workflow.envelope_id)
        fields = (await db.execute(select(Field).where(Field.envelope_id == envelope.id))).scalars().all()
        field_values = (await db.execute(select(FieldValue).where(FieldValue.envelope_id == envelope.id))).scalars().all()
        pdf_bytes = await pdf_flattener.flatten_envelope(envelope, document, fields, field_values)
        return Response(content=pdf_bytes, media_type="application/pdf")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Preview document error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to render document preview")


@router.delete("/{workflow_id}/participants/{participant_id}")
async def remove_workflow_participant(
    workflow_id: str,
    participant_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a participant from a workflow"""
    try:
        # Verify workflow exists and user has access
        result = await db.execute(
            select(Workflow).where(
                and_(
                    Workflow.id == workflow_id,
                    Workflow.created_by == uuid.UUID(current_user["user_id"])
                )
            )
        )
        workflow = result.scalar_one_or_none()
        
        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow not found"
            )
        
        if workflow.status != WorkflowStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only draft workflows can be modified"
            )
        
        # Find and remove the participant
        participant_result = await db.execute(
            select(WorkflowParticipant).where(
                and_(
                    WorkflowParticipant.id == participant_id,
                    WorkflowParticipant.workflow_id == workflow_id
                )
            )
        )
        participant = participant_result.scalar_one_or_none()
        
        if not participant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Participant not found"
            )
        
        await db.delete(participant)
        await db.commit()
        
        return {"message": "Participant removed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Remove workflow participant error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove workflow participant"
        )

@router.post("/{workflow_id}/send")
async def send_workflow(
    workflow_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send workflow to participants for signing"""
    try:
        # Verify workflow exists and user has access
        result = await db.execute(
            select(Workflow).where(
                and_(
                    Workflow.id == workflow_id,
                    Workflow.created_by == uuid.UUID(current_user["user_id"])
                )
            )
        )
        workflow = result.scalar_one_or_none()
        
        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow not found"
            )
        
        if workflow.status not in [WorkflowStatus.DRAFT, WorkflowStatus.ACTIVE]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only draft or active workflows can be sent"
            )
        
        # Update workflow status to active (only set started_at for draft workflows)
        if workflow.status == WorkflowStatus.DRAFT:
            workflow.status = WorkflowStatus.ACTIVE
            workflow.started_at = datetime.utcnow()

        # Load participants and document
        participants = (await db.execute(
            select(WorkflowParticipant).where(WorkflowParticipant.workflow_id == workflow_id)
        )).scalars().all()
        document = (await db.execute(
            select(Document).where(Document.id == workflow.document_id)
        )).scalar_one_or_none()

        if not participants:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Add at least one participant before sending")

        # Bridge to the DocuSign-style envelope: sending a workflow creates an
        # envelope (recipients from participants, fields from the document),
        # issues per-recipient token sign-links, and emails them. The signed PDF
        # is produced by the finalize worker once all recipients complete.
        from app.services.envelope_dispatch import create_envelope_from_workflow, dispatch_envelope

        if not workflow.envelope_id:
            envelope, recipients = await create_envelope_from_workflow(db, workflow, participants, document)
            workflow.envelope_id = envelope.id
            await db.flush()
            await dispatch_envelope(db, envelope, recipients, document)

        await db.commit()
        return {"message": "Workflow sent successfully", "workflow_id": workflow_id,
                "envelope_id": str(workflow.envelope_id)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Send workflow error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send workflow"
        )


@router.post("/{workflow_id}/remind")
async def remind_pending(
    workflow_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-email the signing link to recipients who haven't signed yet."""
    workflow = (await db.execute(
        select(Workflow).where(and_(
            Workflow.id == workflow_id,
            Workflow.created_by == uuid.UUID(current_user["user_id"]),
        ))
    )).scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    if not workflow.envelope_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workflow has not been sent")

    from app.models.envelope import Envelope, Recipient, RecipientStatus
    from app.services.envelope_dispatch import dispatch_envelope

    envelope = await db.get(Envelope, workflow.envelope_id)
    recipients = (await db.execute(
        select(Recipient).where(Recipient.envelope_id == workflow.envelope_id)
    )).scalars().all()
    pending = [r for r in recipients
               if r.status not in (RecipientStatus.COMPLETED, RecipientStatus.DECLINED)]
    if not pending:
        return {"message": "All recipients have already signed", "reminded": 0}

    document = await db.get(Document, envelope.document_id)
    await dispatch_envelope(db, envelope, pending, document)
    await db.commit()
    return {"message": f"Reminder sent to {len(pending)} recipient(s)", "reminded": len(pending)}

@router.get("/{workflow_id}/sign/{participant_id}")
async def get_workflow_signing_page(
    workflow_id: str,
    participant_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get workflow signing page for a participant (public endpoint)"""
    try:
        # Verify workflow and participant exist
        workflow_result = await db.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        workflow = workflow_result.scalar_one_or_none()
        
        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow not found"
            )
        
        participant_result = await db.execute(
            select(WorkflowParticipant).where(
                and_(
                    WorkflowParticipant.id == participant_id,
                    WorkflowParticipant.workflow_id == workflow_id
                )
            )
        )
        participant = participant_result.scalar_one_or_none()
        
        if not participant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Participant not found"
            )
        
        # Get document details
        document_result = await db.execute(
            select(Document).where(Document.id == workflow.document_id)
        )
        document = document_result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        # Debug: Log document fields for workflow signing
        logger.info(f"Workflow signing - Document ID: {document.id}, Fields: {document.fields}")
        
        # Check if already signed
        if participant.status == 'completed':
            return {
                "message": "Document already signed",
                "signed_at": participant.signed_at,
                "workflow": {
                    "id": str(workflow.id),
                    "name": workflow.name,
                    "status": workflow.status.value
                },
                "participant": {
                    "email": participant.email,
                    "signing_order": participant.signingOrder,
                    "status": participant.status
                },
                "document": {
                    "id": str(document.id),
                    "title": document.title
                }
            }
        
        # Generate a temporary access token for the document (valid for 1 hour)
        from app.core.security.auth import AuthHandler
        auth_handler = AuthHandler()
        document_token = auth_handler.create_access_token(
            {"sub": str(document.id), "type": "document_access"},
            expires_delta=timedelta(hours=1)
        )
        
        return {
            "workflow": {
                "id": str(workflow.id),
                "name": workflow.name,
                "status": workflow.status.value,
                "description": workflow.description
            },
            "participant": {
                "id": str(participant.id),
                "email": participant.email,
                "signing_order": participant.signingOrder,
                "status": participant.status or 'pending'
            },
            "document": {
                "id": str(document.id),
                "title": document.title,
                "filename": document.filename,
                "mime_type": document.mime_type,
                "fields": document.fields or [],
                "file_url": f"/api/v1/documents/public/{document.id}/file?token={document_token}"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get workflow signing page error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get signing page"
        )

async def handle_participant_decline(workflow_id: str, participant_id: str, decline_data: dict, db: AsyncSession):
    """Handle participant declining to sign"""
    try:
        # Verify workflow and participant exist
        workflow_result = await db.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        workflow = workflow_result.scalar_one_or_none()
        
        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow not found"
            )
        
        participant_result = await db.execute(
            select(WorkflowParticipant).where(
                and_(
                    WorkflowParticipant.id == participant_id,
                    WorkflowParticipant.workflow_id == workflow_id
                )
            )
        )
        participant = participant_result.scalar_one_or_none()
        
        if not participant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Participant not found"
            )
        
        # Check if already completed or declined
        if participant.status in ['completed', 'declined']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Participant has already {participant.status}"
            )
        
        # Update participant status to declined
        participant.status = 'declined'
        participant.declined_at = datetime.utcnow()
        participant.decline_reason = decline_data.get('reason', 'Participant declined to sign')
        
        await db.commit()
        await db.refresh(participant)
        
        # Check if workflow should be marked as failed due to decline
        all_participants_result = await db.execute(
            select(WorkflowParticipant).where(WorkflowParticipant.workflow_id == workflow_id)
        )
        all_participants = all_participants_result.scalars().all()
        
        # If any participant declined, mark workflow as failed
        if any(p.status == 'declined' for p in all_participants):
            workflow.status = WorkflowStatus.FAILED
            workflow.completed_at = datetime.utcnow()
            await db.commit()
        
        return {
            "message": "Document signing declined successfully",
            "participant": {
                "id": str(participant.id),
                "email": participant.email,
                "status": participant.status,
                "declined_at": participant.declined_at,
                "decline_reason": participant.decline_reason
            },
            "workflow": {
                "id": str(workflow.id),
                "name": workflow.name,
                "status": workflow.status.value
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error handling participant decline: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process decline"
        )

@router.post("/{workflow_id}/sign/{participant_id}")
async def sign_workflow_document(
    workflow_id: str,
    participant_id: str,
    signature_data: dict,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Sign a workflow document (public endpoint)"""
    try:
        # Check if this is a decline action
        if signature_data.get("action") == "decline":
            return await handle_participant_decline(workflow_id, participant_id, signature_data, db)
        # Verify workflow and participant exist
        workflow_result = await db.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        workflow = workflow_result.scalar_one_or_none()
        
        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow not found"
            )
        
        participant_result = await db.execute(
            select(WorkflowParticipant).where(
                and_(
                    WorkflowParticipant.id == participant_id,
                    WorkflowParticipant.workflow_id == workflow_id
                )
            )
        )
        participant = participant_result.scalar_one_or_none()
        
        if not participant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Participant not found"
            )
        
        # Check if already signed
        if participant.status == 'completed':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Document already signed"
            )
        
        # Check if workflow is still active
        if workflow.status != WorkflowStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow is not active"
            )
        
        # Get document for non-repudiation
        document_result = await db.execute(
            select(Document).where(Document.id == workflow.document_id)
        )
        document = document_result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        # Create legally binding signature with non-repudiation
        from app.core.legal_signature import legal_signature_service
        from app.core.config import settings
        
        # Collect signing context for non-repudiation
        signing_context = {
            "participant_email": participant.email,
            "participant_id": str(participant.id),
            "workflow_id": str(workflow.id),
            "workflow_name": workflow.name,
            "document_id": str(document.id),
            "document_title": document.title,
            "signing_order": participant.signingOrder,
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get('user-agent'),
            "timestamp": datetime.utcnow().isoformat(),
            "signature_type": signature_data.get('type', 'unknown'),
            "fields_signed": signature_data.get('fields', []) if signature_data.get('type') == 'field_signatures' else [],
            "consent_given": signature_data.get('consent_given', False),
            "privacy_accepted": signature_data.get('privacy_accepted', False),
            "legal_binding_accepted": signature_data.get('legal_binding_accepted', False),
            "consent_timestamp": signature_data.get('consent_timestamp')
        }
        
        # Read document content for hashing
        import os
        document_content = b""
        if os.path.exists(document.file_path):
            with open(document.file_path, 'rb') as f:
                document_content = f.read()
        
        # Create legally binding signature
        legal_signature_metadata = None
        if legal_signature_service.is_available():
            try:
                # Convert signature data to string for signing
                signature_data_str = str(signature_data)
                legal_signature_metadata = legal_signature_service.create_legal_signature(
                    document_content=document_content,
                    user_id=str(participant.id),
                    signature_data=signature_data_str,
                    signing_context=signing_context
                )
                logger.info(f"Created legal signature for participant {participant.id}")
            except Exception as e:
                logger.error(f"Failed to create legal signature: {e}")
        
        # Update participant status with enhanced data
        participant.status = 'completed'
        participant.signed_at = datetime.utcnow()
        participant.signature_data = {
            **signature_data,
            "legal_signature_metadata": legal_signature_metadata,
            "signing_context": signing_context
        }
        participant.ip_address = request.client.host if request.client else None
        participant.user_agent = request.headers.get('user-agent')
        
        # Create individual signature records for each field signed (for admin tracking)
        created_signature_ids = []
        if signature_data.get('fields') and isinstance(signature_data['fields'], list):
            try:
                from app.models.signature import Signature, SignatureType, SignatureStatus
                from app.models.user import User
                
                logger.info(f"Creating signature records for {len(signature_data['fields'])} fields")
                
                # Check if participant has a valid user account
                signer_id = None
                if participant.user_id:
                    # Participant already has a user account, use that
                    signer_id = participant.user_id
                    logger.info(f"Using existing user account for participant {participant.email}")
                else:
                    # Check if a user account exists for this email
                    user_result = await db.execute(
                        select(User).where(User.email == participant.email)
                    )
                    existing_user = user_result.scalar_one_or_none()
                    
                    if existing_user:
                        # User account exists, link participant to it
                        participant.user_id = existing_user.id
                        signer_id = existing_user.id
                        await db.commit()
                        logger.info(f"Linked participant {participant.email} to existing user account")
                    else:
                        # No user account exists, use NULL for signer_id
                        # This allows us to track signatures without requiring user accounts
                        signer_id = None
                        logger.info(f"Using NULL signer_id for participant {participant.email} (no user account)")
                logger.info(f"Using signer_id: {signer_id} for participant {participant.email}")
                
                for field_signature in signature_data['fields']:
                    if field_signature.get('fieldId') and field_signature.get('signature'):
                        # Create signature record for admin tracking
                        signature_record = Signature(
                            document_id=workflow.document_id,
                            signer_id=signer_id,  # Use user ID as signer (NULL if no user account)
                            signature_type=SignatureType.ELECTRONIC,
                            status=SignatureStatus.SIGNED,
                            signature_data=field_signature.get('signature', ''),
                            signature_image=field_signature.get('image'),
                            signature_position=field_signature.get('position', {}),  # Store full field position data
                            field_id=field_signature.get('fieldId'),  # Store field ID for reliable matching
                            signing_reason=signing_context.get('signing_reason', 'Workflow signature'),
                            signing_location=signing_context.get('signing_location', 'Online'),
                            ip_address=request.client.host if request.client else None,
                            user_agent=request.headers.get('user-agent'),
                            participant_email=participant.email,  # Track participant email for signatures without user accounts
                            signed_at=datetime.utcnow(),
                            # Digital signature fields
                            digital_signature=legal_signature_metadata.get("digital_signature") if legal_signature_metadata else None,
                            document_hash=legal_signature_metadata.get("document_hash") if legal_signature_metadata else None,
                            certificate_thumbprint=legal_signature_metadata.get("certificate_thumbprint") if legal_signature_metadata else None,
                            signature_metadata=legal_signature_metadata,
                            verification_status="verified" if legal_signature_metadata else "pending",
                            signature_level="advanced" if legal_signature_metadata else "simple",
                            is_legally_binding=legal_signature_metadata.get("is_legally_binding", True) if legal_signature_metadata else False,
                            compliance_standard=legal_signature_metadata.get("compliance_standard", "ESIGN_UETA") if legal_signature_metadata else "ESIGN",
                            certificate_chain=legal_signature_metadata.get("certificate_chain", []) if legal_signature_metadata else None,
                            timestamp_data=legal_signature_metadata.get("timestamp_data", {}) if legal_signature_metadata else None,
                            legal_metadata=legal_signature_metadata.get("legal_metadata", {}) if legal_signature_metadata else None
                        )
                        db.add(signature_record)
                        created_signature_ids.append(str(signature_record.id))
                        logger.info(f"Created signature record for field {field_signature.get('fieldId')} by participant {participant.email}")
                    else:
                        logger.warning(f"Skipping field signature - missing data: fieldId={field_signature.get('fieldId')}, signature={bool(field_signature.get('signature'))}, signer_id={signer_id}")
                        
            except Exception as e:
                logger.error(f"Error creating signature records: {str(e)}")
                # Don't fail the entire signing process if signature record creation fails
        
        await db.commit()
        await db.refresh(participant)
        
        logger.info(f"Signature creation completed. Created {len(created_signature_ids)} signature records: {created_signature_ids}")
        
        # Check if all participants have signed
        all_participants_result = await db.execute(
            select(WorkflowParticipant).where(WorkflowParticipant.workflow_id == workflow_id)
        )
        all_participants = all_participants_result.scalars().all()
        
        all_signed = all(participant.status == 'completed' for participant in all_participants)
        
        if all_signed:
            # Mark workflow as completed
            workflow.status = WorkflowStatus.COMPLETED
            workflow.completed_at = datetime.utcnow()
            
            # Update document status to completed
            if document:
                from app.models.document import DocumentStatus
                document.status = DocumentStatus.COMPLETED
                document.updated_at = datetime.utcnow()
                logger.info(f"Updated document {document.id} status to COMPLETED")
            
            # Validate that all required fields have signatures
            if document and hasattr(document, 'fields') and document.fields:
                required_fields = [f for f in document.fields if f.get('required', True)]
                signature_count = len(created_signature_ids)
                
                if signature_count < len(required_fields):
                    logger.warning(f"Workflow completed but only {signature_count} signatures created for {len(required_fields)} required fields")
                else:
                    logger.info(f"Workflow completed with {signature_count} signatures for {len(required_fields)} required fields")
            
            await db.commit()
            await db.refresh(workflow)
            
            logger.info(f"Workflow {workflow_id} completed - all participants signed")
        
        # Get document details for response
        document_result = await db.execute(
            select(Document).where(Document.id == workflow.document_id)
        )
        document = document_result.scalar_one_or_none()
        
        return {
            "message": "Document signed successfully",
            "workflow": {
                "id": str(workflow.id),
                "name": workflow.name,
                "status": workflow.status.value,
                "completed": all_signed
            },
            "participant": {
                "email": participant.email,
                "signing_order": participant.signingOrder,
                "status": participant.status,
                "signed_at": participant.signed_at
            },
            "document": {
                "id": str(document.id) if document else None,
                "title": document.title if document else None
            },
            "signatures": {
                "created_signature_ids": created_signature_ids,
                "digital_signature": legal_signature_metadata.get("digital_signature") if legal_signature_metadata else None,
                "document_hash": legal_signature_metadata.get("document_hash") if legal_signature_metadata else None,
                "certificate_thumbprint": legal_signature_metadata.get("certificate_thumbprint") if legal_signature_metadata else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Sign workflow document error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to sign document"
        )

@router.put("/{workflow_id}")
async def update_workflow(
    workflow_id: str,
    workflow_data: WorkflowCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update workflow"""
    try:
        # Verify workflow exists and user has access
        result = await db.execute(
            select(Workflow).where(
                and_(
                    Workflow.id == workflow_id,
                    Workflow.created_by == uuid.UUID(current_user["user_id"])
                )
            )
        )
        workflow = result.scalar_one_or_none()
        
        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow not found"
            )
        
        if workflow.status != WorkflowStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only draft workflows can be updated"
            )
        
        # Update workflow fields
        workflow.name = workflow_data.name
        workflow.description = workflow_data.description
        workflow.workflow_data = workflow_data.workflow_data
        
        await db.commit()
        await db.refresh(workflow)
        
        return WorkflowResponse(
            id=str(workflow.id),
            name=workflow.name,
            description=workflow.description,
            status=workflow.status.value,
            document_id=str(workflow.document_id),
            envelope_id=str(workflow.envelope_id) if workflow.envelope_id else None,
            created_by=str(workflow.created_by),
            created_at=workflow.created_at,
            started_at=workflow.started_at,
            completed_at=workflow.completed_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update workflow error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update workflow"
        )

@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete workflow"""
    try:
        # Verify workflow exists and user has access
        result = await db.execute(
            select(Workflow).where(
                and_(
                    Workflow.id == workflow_id,
                    Workflow.created_by == uuid.UUID(current_user["user_id"])
                )
            )
        )
        workflow = result.scalar_one_or_none()
        
        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow not found"
            )
        
        if workflow.status == WorkflowStatus.ACTIVE:
            # Cancel the workflow first, then delete it
            workflow.status = WorkflowStatus.CANCELLED
            workflow.updated_at = datetime.utcnow()
            await db.commit()
        
        await db.delete(workflow)
        await db.commit()
        
        return {"message": "Workflow deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete workflow error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete workflow"
        )