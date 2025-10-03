"""
VistaSign Signatures API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
import logging
from datetime import datetime

from app.core.database import get_db
from app.core.security.auth import get_current_user
from app.models.signature import Signature, SignatureTemplate, SignatureStatus, SignatureType
from app.models.document import Document
from app.schemas.signature import (
    SignatureCreate, SignatureResponse, SignatureListResponse,
    SignatureTemplateCreate, SignatureTemplateResponse
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/", response_model=SignatureResponse)
async def create_signature(
    signature_data: SignatureCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new signature"""
    try:
        # Verify document exists and user has access
        result = await db.execute(
            select(Document).where(
                and_(
                    Document.id == signature_data.document_id,
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
        
        # Create signature
        signature = Signature(
            document_id=signature_data.document_id,
            signer_id=current_user["user_id"],
            signature_type=SignatureType.ELECTRONIC,
            status=SignatureStatus.PENDING,
            signature_data=signature_data.signature_data,
            signature_image=signature_data.signature_image,
            signature_position=signature_data.signature_position,
            signing_reason=signature_data.signing_reason,
            signing_location=signature_data.signing_location
        )
        
        db.add(signature)
        await db.commit()
        await db.refresh(signature)
        
        return SignatureResponse(
            id=str(signature.id),
            document_id=str(signature.document_id),
            signer_id=str(signature.signer_id),
            signature_type=signature.signature_type.value,
            status=signature.status.value,
            signature_position=signature.signature_position,
            signing_reason=signature.signing_reason,
            signing_location=signature.signing_location,
            created_at=signature.created_at,
            signed_at=signature.signed_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create signature error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create signature"
        )

@router.get("/", response_model=SignatureListResponse)
async def list_signatures(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    document_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List signatures"""
    try:
        # Build query
        query = select(Signature).where(Signature.signer_id == current_user["user_id"])
        
        # Apply filters
        if status:
            query = query.where(Signature.status == status)
        if document_id:
            query = query.where(Signature.document_id == document_id)
        
        # Get total count
        count_query = select(Signature).where(Signature.signer_id == current_user["user_id"])
        if status:
            count_query = count_query.where(Signature.status == status)
        if document_id:
            count_query = count_query.where(Signature.document_id == document_id)
        
        total_result = await db.execute(count_query)
        total = len(total_result.scalars().all())
        
        # Get signatures with pagination
        result = await db.execute(query.offset(skip).limit(limit))
        signatures = result.scalars().all()
        
        return SignatureListResponse(
            signatures=[
                SignatureResponse(
                    id=str(sig.id),
                    document_id=str(sig.document_id),
                    signer_id=str(sig.signer_id),
                    signature_type=sig.signature_type.value,
                    status=sig.status.value,
                    signature_position=sig.signature_position,
                    signing_reason=sig.signing_reason,
                    signing_location=sig.signing_location,
                    created_at=sig.created_at,
                    signed_at=sig.signed_at
                ) for sig in signatures
            ],
            total=total,
            skip=skip,
            limit=limit,
            has_more=(skip + limit) < total
        )
        
    except Exception as e:
        logger.error(f"List signatures error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list signatures"
        )

@router.get("/{signature_id}", response_model=SignatureResponse)
async def get_signature(
    signature_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get signature by ID"""
    try:
        result = await db.execute(
            select(Signature).where(
                and_(
                    Signature.id == signature_id,
                    Signature.signer_id == current_user["user_id"]
                )
            )
        )
        signature = result.scalar_one_or_none()
        
        if not signature:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Signature not found"
            )
        
        return SignatureResponse(
            id=str(signature.id),
            document_id=str(signature.document_id),
            signer_id=str(signature.signer_id),
            signature_type=signature.signature_type.value,
            status=signature.status.value,
            signature_position=signature.signature_position,
            signing_reason=signature.signing_reason,
            signing_location=signature.signing_location,
            created_at=signature.created_at,
            signed_at=signature.signed_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get signature error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get signature"
        )

@router.post("/templates", response_model=SignatureTemplateResponse)
async def create_signature_template(
    template_data: SignatureTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a signature template"""
    try:
        template = SignatureTemplate(
            name=template_data.name,
            description=template_data.description,
            template_data=template_data.template_data,
            signature_style=template_data.signature_style,
            created_by=current_user["user_id"]
        )
        
        db.add(template)
        await db.commit()
        await db.refresh(template)
        
        return SignatureTemplateResponse(
            id=str(template.id),
            name=template.name,
            description=template.description,
            signature_style=template.signature_style,
            is_default=template.is_default,
            is_active=template.is_active,
            created_at=template.created_at
        )
        
    except Exception as e:
        logger.error(f"Create signature template error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create signature template"
        )

@router.get("/templates", response_model=List[SignatureTemplateResponse])
async def list_signature_templates(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List signature templates"""
    try:
        result = await db.execute(
            select(SignatureTemplate).where(
                and_(
                    SignatureTemplate.created_by == current_user["user_id"],
                    SignatureTemplate.is_active == True
                )
            )
        )
        templates = result.scalars().all()
        
        return [
            SignatureTemplateResponse(
                id=str(template.id),
                name=template.name,
                description=template.description,
                signature_style=template.signature_style,
                is_default=template.is_default,
                is_active=template.is_active,
                created_at=template.created_at
            ) for template in templates
        ]
        
    except Exception as e:
        logger.error(f"List signature templates error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list signature templates"
        )
