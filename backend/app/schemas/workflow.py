"""
VistaSign Workflow Schemas
"""

from pydantic import BaseModel, validator
from typing import Optional, List, Dict, Any
from datetime import datetime

class WorkflowCreate(BaseModel):
    """Workflow creation schema"""
    name: str
    description: Optional[str] = None
    workflow_data: Dict[str, Any]
    document_id: str

class WorkflowResponse(BaseModel):
    """Workflow response schema"""
    id: str
    name: str
    description: Optional[str] = None
    status: str
    document_id: str
    created_by: str
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    participants: Optional[List[WorkflowParticipantResponse]] = []
    
    class Config:
        from_attributes = True

class WorkflowListResponse(BaseModel):
    """Workflow list response schema"""
    workflows: List[WorkflowResponse]
    total: int
    skip: int
    limit: int
    has_more: bool

class WorkflowStepCreate(BaseModel):
    """Workflow step creation schema"""
    step_name: str
    step_type: str
    step_order: int
    step_data: Dict[str, Any]
    is_required: bool = True
    is_parallel: bool = False
    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None

class WorkflowStepResponse(BaseModel):
    """Workflow step response schema"""
    id: str
    step_name: str
    step_type: str
    step_order: int
    status: str
    is_required: bool
    is_parallel: bool
    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class WorkflowParticipantCreate(BaseModel):
    """Workflow participant creation schema"""
    email: str
    signingOrder: int
    role: str = "signer"
    permissions: Optional[Dict[str, Any]] = None

class WorkflowParticipantResponse(BaseModel):
    """Workflow participant response schema"""
    id: str
    workflow_id: str
    email: str
    signingOrder: int
    role: str
    user_id: Optional[str] = None
    permissions: Optional[Dict[str, Any]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
