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
    SignatureTemplateCreate, SignatureTemplateResponse, SignatureVerificationResponse,
    LegalSignatureVerificationResponse
)
from app.core.digital_signature import digital_signature_service
from app.core.legal_signature import legal_signature_service, SignatureLevel

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
        
        # Get document content for hashing
        document_content = b""  # TODO: Load actual document content
        if hasattr(document, 'file_path') and document.file_path:
            try:
                with open(document.file_path, 'rb') as f:
                    document_content = f.read()
            except Exception as e:
                logger.warning(f"Could not read document content: {str(e)}")
        
        # Create signing context
        signing_context = {
            "ip_address": "127.0.0.1",  # TODO: Get from request
            "user_agent": "VistaSign",  # TODO: Get from request
            "signing_reason": signature_data.signing_reason,
            "signing_location": signature_data.signing_location,
            "timestamp": datetime.now().isoformat()
        }
        
        # Create legal signature if service is available
        legal_sig_data = None
        document_hash = None
        certificate_thumbprint = None
        verification_status = "pending"
        signature_level = "simple"
        is_legally_binding = False
        compliance_standard = "ESIGN"
        
        if legal_signature_service.is_available():
            try:
                legal_sig_data = legal_signature_service.create_legal_signature(
                    document_content=document_content,
                    user_id=str(current_user["user_id"]),
                    signature_data=signature_data.signature_data or "",
                    signing_context=signing_context,
                    signature_level=SignatureLevel.ADVANCED  # Use advanced level for legal binding
                )
                
                if legal_sig_data:
                    document_hash = legal_sig_data["document_hash"]
                    certificate_thumbprint = legal_sig_data["certificate_chain"]["fingerprints"]["sha256"]
                    verification_status = "verified"
                    signature_level = legal_sig_data["signature_data"]["signature_level"]
                    is_legally_binding = legal_sig_data["legal_binding"]["is_legally_binding"]
                    compliance_standard = legal_sig_data["signature_data"]["legal_metadata"]["compliance_standard"]
                    logger.info(f"Legal signature created for user {current_user['user_id']} - Level: {signature_level}")
                else:
                    logger.warning("Failed to create legal signature")
                    verification_status = "failed"
            except Exception as e:
                logger.error(f"Legal signature creation failed: {str(e)}")
                verification_status = "failed"
        
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
            signing_location=signature_data.signing_location,
            # Digital signature fields
            digital_signature=legal_sig_data["digital_signature"] if legal_sig_data else None,
            document_hash=document_hash,
            certificate_thumbprint=certificate_thumbprint,
            signature_metadata=legal_sig_data if legal_sig_data else None,
            verification_status=verification_status,
            # Legal compliance fields
            signature_level=signature_level,
            is_legally_binding=is_legally_binding,
            compliance_standard=compliance_standard,
            certificate_chain=legal_sig_data["certificate_chain"] if legal_sig_data else None,
            timestamp_data=legal_sig_data["signature_data"]["timestamp"] if legal_sig_data else None,
            legal_metadata=legal_sig_data["signature_data"]["legal_metadata"] if legal_sig_data else None
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
            signed_at=signature.signed_at,
            # Digital signature fields
            digital_signature=signature.digital_signature,
            document_hash=signature.document_hash,
            certificate_thumbprint=signature.certificate_thumbprint,
            verification_status=signature.verification_status,
            # Legal compliance fields
            signature_level=signature.signature_level,
            is_legally_binding=signature.is_legally_binding,
            compliance_standard=signature.compliance_standard
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
            signed_at=signature.signed_at,
            # Digital signature fields
            digital_signature=signature.digital_signature,
            document_hash=signature.document_hash,
            certificate_thumbprint=signature.certificate_thumbprint,
            verification_status=signature.verification_status,
            # Legal compliance fields
            signature_level=signature.signature_level,
            is_legally_binding=signature.is_legally_binding,
            compliance_standard=signature.compliance_standard
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

@router.get("/{signature_id}/verify", response_model=SignatureVerificationResponse)
async def verify_signature(
    signature_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Verify a digital signature"""
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
        
        # Check if digital signature exists
        if not signature.digital_signature or not signature.signature_metadata:
            return SignatureVerificationResponse(
                is_valid=False,
                errors=["No digital signature data available"],
                verification_details={"has_digital_signature": False}
            )
        
        # Verify the signature
        verification_result = digital_signature_service.verify_complete_signature(
            signature.signature_metadata
        )
        
        # Add certificate info if available
        if digital_signature_service.is_available():
            verification_result["certificate_info"] = digital_signature_service.get_certificate_info()
        
        return SignatureVerificationResponse(**verification_result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signature verification error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify signature"
        )

@router.get("/certificate/info")
async def get_certificate_info():
    """Get certificate information for signature verification"""
    try:
        if not digital_signature_service.is_available():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Digital signature service not available"
            )
        
        cert_info = digital_signature_service.get_certificate_info()
        if not cert_info:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get certificate information"
            )
        
        return cert_info
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get certificate info error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get certificate information"
        )

@router.get("/{signature_id}/verify-legal", response_model=LegalSignatureVerificationResponse)
async def verify_legal_signature(
    signature_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Verify a legal signature with comprehensive legal compliance checking"""
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
        
        # Check if legal signature data exists
        if not signature.digital_signature or not signature.signature_metadata:
            return LegalSignatureVerificationResponse(
                is_valid=False,
                is_legally_binding=False,
                errors=["No legal signature data available"],
                verification_details={"has_legal_signature": False}
            )
        
        # Verify the legal signature
        verification_result = legal_signature_service.verify_legal_signature(
            signature.signature_metadata
        )
        
        # Add certificate chain info if available
        if signature.certificate_chain:
            verification_result["certificate_chain"] = signature.certificate_chain
        
        return LegalSignatureVerificationResponse(**verification_result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Legal signature verification error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify legal signature"
        )

@router.get("/certificate/legal-info")
async def get_legal_certificate_info():
    """Get legal certificate information for signature verification"""
    try:
        if not legal_signature_service.is_available():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Legal signature service not available"
            )
        
        cert_info = legal_signature_service.get_certificate_chain_info()
        if not cert_info:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get legal certificate information"
            )
        
        return cert_info
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get legal certificate info error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get legal certificate information"
        )
