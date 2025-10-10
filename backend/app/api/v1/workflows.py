"""
VistaSign Workflows API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
import logging
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security.auth import get_current_user
from app.core.legal_signature import legal_signature_service
from app.core.config import settings
from app.models.workflow import Workflow, WorkflowStep, WorkflowParticipant, WorkflowStatus
from app.models.document import Document
from app.schemas.workflow import (
    WorkflowCreate, WorkflowResponse, WorkflowListResponse,
    WorkflowStepCreate, WorkflowStepResponse,
    WorkflowParticipantCreate, WorkflowParticipantResponse
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
                    Document.owner_id == current_user["user_id"]
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
            created_by=current_user["user_id"],
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
    status: Optional[str] = Query(None),
    document_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List workflows"""
    try:
        # Build query
        query = select(Workflow).where(Workflow.created_by == current_user["user_id"])
        
        # Apply filters
        if status:
            query = query.where(Workflow.status == status)
        if document_id:
            query = query.where(Workflow.document_id == document_id)
        
        # Get total count
        count_query = select(Workflow).where(Workflow.created_by == current_user["user_id"])
        if status:
            count_query = count_query.where(Workflow.status == status)
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
                    Workflow.created_by == current_user["user_id"]
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
                    Workflow.created_by == current_user["user_id"]
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
                    Workflow.created_by == current_user["user_id"]
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
                    Workflow.created_by == current_user["user_id"]
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
                    Workflow.created_by == current_user["user_id"]
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
        
        await db.commit()
        await db.refresh(workflow)
        
        # Send emails to participants
        participants_result = await db.execute(
            select(WorkflowParticipant).where(WorkflowParticipant.workflow_id == workflow_id)
        )
        participants = participants_result.scalars().all()
        
        # Get document details
        document_result = await db.execute(
            select(Document).where(Document.id == workflow.document_id)
        )
        document = document_result.scalar_one_or_none()
        
        if participants and document:
            from app.core.email import send_email
            
            # Send email to each participant
            for participant in participants:
                try:
                    # Create signing URL based on environment
                    base_url = settings.FRONTEND_URL.rstrip('/')
                    signing_url = f"{base_url}/sign/{workflow_id}/{participant.id}"
                    
                    subject = f"Document Signing Request: {document.title}"
                    
                    html_body = f"""
                    <html>
                    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #7E3AF2;">Document Signing Request</h2>
                            
                            <p>Hello,</p>
                            
                            <p>You have been requested to sign a document.</p>
                            
                            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <h3 style="margin-top: 0; color: #7E3AF2;">Document Details:</h3>
                                <p><strong>Document:</strong> {document.title}</p>
                                {f'<p><strong>Description:</strong> {workflow.description}</p>' if workflow.description else ''}
                            </div>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="{signing_url}" 
                                   style="background-color: #7E3AF2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                    Sign Document
                                </a>
                            </div>
                            
                            <p style="color: #666; font-size: 14px;">
                                If the button doesn't work, you can copy and paste this link into your browser:<br>
                                <a href="{signing_url}">{signing_url}</a>
                            </p>
                            
                            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                            <p style="color: #666; font-size: 12px;">
                                This email was sent by VistaSign. If you have any questions, please contact the document owner.
                            </p>
                        </div>
                    </body>
                    </html>
                    """
                    
                    # Send the email
                    email_sent = send_email(participant.email, subject, html_body)
                    
                    if email_sent:
                        logger.info(f"Successfully sent signing invitation to {participant.email}")
                    else:
                        logger.error(f"Failed to send signing invitation to {participant.email}")
                        
                except Exception as e:
                    logger.error(f"Error sending email to {participant.email}: {str(e)}")
        
        return {"message": "Workflow sent successfully", "workflow_id": workflow_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Send workflow error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send workflow"
        )

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
        
        await db.commit()
        await db.refresh(participant)
        
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
                    Workflow.created_by == current_user["user_id"]
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
                    Workflow.created_by == current_user["user_id"]
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