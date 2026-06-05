"""
VistaSign Workflow Models
"""

from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, Integer, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from app.core.database import Base

class WorkflowStatus(str, PyEnum):
    """Workflow status"""
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"

class WorkflowStepStatus(str, PyEnum):
    """Workflow step status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"
    REJECTED = "rejected"

class WorkflowStepType(str, PyEnum):
    """Workflow step type"""
    SIGNATURE = "signature"
    APPROVAL = "approval"
    REVIEW = "review"
    NOTIFICATION = "notification"

class Workflow(Base):
    """Workflow model for document signing processes"""
    __tablename__ = "workflows"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Workflow information
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(WorkflowStatus), default=WorkflowStatus.DRAFT)
    
    # Workflow configuration
    workflow_data = Column(JSON, nullable=False)  # Workflow configuration
    is_template = Column(Boolean, default=False)
    template_id = Column(UUID(as_uuid=True), nullable=True)
    
    # Document relationship
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    
    # Creator
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    document = relationship("Document", back_populates="workflows")
    creator = relationship("User", back_populates="workflows")
    steps = relationship("WorkflowStep", back_populates="workflow", cascade="all, delete-orphan")
    participants = relationship("WorkflowParticipant", back_populates="workflow", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Workflow(id={self.id}, name='{self.name}', status='{self.status.value}')>"

class WorkflowStep(Base):
    """Workflow step model"""
    __tablename__ = "workflow_steps"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Step information
    step_name = Column(String(255), nullable=False)
    step_type = Column(Enum(WorkflowStepType), nullable=False)
    step_order = Column(Integer, nullable=False)
    status = Column(Enum(WorkflowStepStatus), default=WorkflowStepStatus.PENDING)
    
    # Step configuration
    step_data = Column(JSON, nullable=False)  # Step-specific configuration
    is_required = Column(Boolean, default=True)
    is_parallel = Column(Boolean, default=False)
    
    # Relationships
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id"), nullable=False)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    workflow = relationship("Workflow", back_populates="steps")
    assignee = relationship("User")
    
    def __repr__(self):
        return f"<WorkflowStep(id={self.id}, name='{self.step_name}', type='{self.step_type.value}')>"

class WorkflowParticipant(Base):
    """Workflow participant model"""
    __tablename__ = "workflow_participants"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Participant information
    email = Column(String(255), nullable=False)  # Email address of participant
    signingOrder = Column(Integer, nullable=False)  # Signing order number
    role = Column(String(50), nullable=False)  # signer, approver, reviewer, etc.
    permissions = Column(JSON, nullable=True)  # Participant-specific permissions
    
    # Public signing access token (opaque, per-recipient). Mirrors UnitVista's
    # VistaSignSignLink.token_jti: signing links carry this token instead of raw IDs.
    signing_token = Column(String(255), nullable=True, unique=True, index=True)

    # Signing status and data
    status = Column(String(50), default='pending')  # pending, completed, declined
    signed_at = Column(DateTime(timezone=True), nullable=True)  # When they signed
    signature_data = Column(JSON, nullable=True)  # Signature data (image, coordinates, etc.)
    ip_address = Column(String(45), nullable=True)  # IP address when signing
    user_agent = Column(Text, nullable=True)  # User agent when signing
    
    # Relationships
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # Optional - may be null if user doesn't exist yet
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    workflow = relationship("Workflow", back_populates="participants")
    user = relationship("User", back_populates="workflow_participants")
    
    def __repr__(self):
        return f"<WorkflowParticipant(id={self.id}, email='{self.email}', signingOrder={self.signingOrder}, role='{self.role}')>"
