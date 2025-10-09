"""
VistaSign Workflows API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
import logging
from datetime import datetime

from app.core.database import get_db
from app.core.security.auth import get_current_user
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
        
        # Get workflows with pagination
        result = await db.execute(query.offset(skip).limit(limit))
        workflows = result.scalars().all()
        
        return WorkflowListResponse(
            workflows=[
                WorkflowResponse(
                    id=str(workflow.id),
                    name=workflow.name,
                    description=workflow.description,
                    status=workflow.status.value,
                    document_id=str(workflow.document_id),
                    created_by=str(workflow.created_by),
                    created_at=workflow.created_at,
                    started_at=workflow.started_at,
                    completed_at=workflow.completed_at
                ) for workflow in workflows
            ],
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
            user_id=participant_data.user_id,
            role=participant_data.role,
            permissions=participant_data.permissions
        )
        
        db.add(participant)
        await db.commit()
        await db.refresh(participant)
        
        return WorkflowParticipantResponse(
            id=str(participant.id),
            workflow_id=str(participant.workflow_id),
            user_id=str(participant.user_id),
            role=participant.role,
            permissions=participant.permissions,
            created_at=participant.created_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add workflow participant error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add workflow participant"
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
        
        if workflow.status != WorkflowStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only draft workflows can be sent"
            )
        
        # Update workflow status to active
        workflow.status = WorkflowStatus.ACTIVE
        workflow.started_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(workflow)
        
        # TODO: Send emails to participants
        # This would integrate with the email service to send signing invitations
        
        return {"message": "Workflow sent successfully", "workflow_id": workflow_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Send workflow error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send workflow"
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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete active workflows"
            )
        
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