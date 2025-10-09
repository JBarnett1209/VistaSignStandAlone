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
from app.models.user import User
from app.schemas.signature import (
    SignatureCreate, SignatureResponse, SignatureListResponse,
    SignatureTemplateCreate, SignatureTemplateResponse, SignatureVerificationResponse,
    LegalSignatureVerificationResponse, SignatureLevelsResponse, HybridSignatureCreate,
    SignatureDeleteRequest, AdminSignatureResponse, AdminSignatureListResponse
)
from app.core.digital_signature import digital_signature_service
from app.core.legal_signature import legal_signature_service, SignatureLevel
from app.core.hybrid_signature import hybrid_signature_service, SignatureLevel as HybridSignatureLevel

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

# Signature Template Routes (must come before parameterized routes)
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

@router.put("/templates/{template_id}", response_model=SignatureTemplateResponse)
async def update_signature_template(
    template_id: str,
    template_data: SignatureTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a signature template"""
    try:
        result = await db.execute(
            select(SignatureTemplate).where(
                and_(
                    SignatureTemplate.id == template_id,
                    SignatureTemplate.created_by == current_user["user_id"]
                )
            )
        )
        template = result.scalar_one_or_none()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Signature template not found"
            )
        
        template.name = template_data.name
        template.description = template_data.description
        template.template_data = template_data.template_data
        template.signature_style = template_data.signature_style
        
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
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update signature template error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update signature template"
        )

@router.delete("/templates/{template_id}")
async def delete_signature_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete a signature template"""
    try:
        result = await db.execute(
            select(SignatureTemplate).where(
                and_(
                    SignatureTemplate.id == template_id,
                    SignatureTemplate.created_by == current_user["user_id"]
                )
            )
        )
        template = result.scalar_one_or_none()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Signature template not found"
            )
        
        await db.delete(template)
        await db.commit()
        
        return {"message": "Signature template deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete signature template error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete signature template"
        )

@router.get("/", response_model=SignatureListResponse)
async def list_signatures(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status_filter: Optional[str] = Query(None),
    document_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List signatures"""
    try:
        # Build query (excluding soft-deleted signatures)
        query = select(Signature).where(
            and_(
                Signature.signer_id == current_user["user_id"],
                Signature.is_deleted == False
            )
        )
        
        # Apply filters
        if status_filter:
            query = query.where(Signature.status == status_filter)
        if document_id:
            query = query.where(Signature.document_id == document_id)
        
        # Get total count (excluding soft-deleted signatures)
        count_query = select(Signature).where(
            and_(
                Signature.signer_id == current_user["user_id"],
                Signature.is_deleted == False
            )
        )
        if status_filter:
            count_query = count_query.where(Signature.status == status_filter)
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

@router.get("/levels", response_model=SignatureLevelsResponse)
async def get_signature_levels():
    """Get available signature levels and their capabilities"""
    try:
        levels_info = hybrid_signature_service.get_signature_level_info()
        return SignatureLevelsResponse(**levels_info)
    except Exception as e:
        logger.error(f"Get signature levels error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get signature levels"
        )

@router.post("/hybrid", response_model=SignatureResponse)
async def create_hybrid_signature(
    signature_data: HybridSignatureCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a hybrid signature with specified signature level"""
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
        document_content = b""
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
        
        # Determine signature level
        try:
            signature_level = HybridSignatureLevel(signature_data.signature_level)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid signature level: {signature_data.signature_level}"
            )
        
        # Create hybrid signature
        hybrid_sig_data = hybrid_signature_service.create_hybrid_signature(
            document_content=document_content,
            user_id=str(current_user["user_id"]),
            signature_data=signature_data.signature_data or "",
            signing_context=signing_context,
            signature_level=signature_level
        )
        
        if not hybrid_sig_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create hybrid signature"
            )
        
        # Create signature record
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
            # Hybrid signature fields
            digital_signature=hybrid_sig_data["digital_signature"],
            document_hash=hybrid_sig_data["document_hash"],
            certificate_thumbprint=hybrid_sig_data["certificate_info"]["fingerprints"]["sha256"],
            signature_metadata=hybrid_sig_data,
            verification_status="verified",
            signature_level=hybrid_sig_data["signature_level"],
            certificate_type=hybrid_sig_data["certificate_type"],
            is_legally_binding=hybrid_sig_data["legal_binding"]["is_legally_binding"],
            compliance_standard=hybrid_sig_data["legal_binding"]["compliance_level"],
            certificate_chain=hybrid_sig_data["certificate_info"],
            user_metadata=hybrid_sig_data.get("user_metadata"),
            qualified_metadata=hybrid_sig_data.get("qualified_metadata")
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
            compliance_standard=signature.compliance_standard,
            # Hybrid signature fields
            certificate_type=signature.certificate_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create hybrid signature error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create hybrid signature"
        )

@router.get("/{signature_id}/verify-hybrid", response_model=LegalSignatureVerificationResponse)
async def verify_hybrid_signature(
    signature_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Verify a hybrid signature with level-specific validation"""
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
        
        # Check if hybrid signature data exists
        if not signature.digital_signature or not signature.signature_metadata:
            return LegalSignatureVerificationResponse(
                is_valid=False,
                is_legally_binding=False,
                errors=["No hybrid signature data available"],
                verification_details={"has_hybrid_signature": False}
            )
        
        # Verify the hybrid signature
        verification_result = hybrid_signature_service.verify_hybrid_signature(
            signature.signature_metadata
        )
        
        # Add certificate chain info if available
        if signature.certificate_chain:
            verification_result["certificate_chain"] = signature.certificate_chain
        
        return LegalSignatureVerificationResponse(**verification_result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Hybrid signature verification error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify hybrid signature"
        )

@router.delete("/{signature_id}")
async def soft_delete_signature(
    signature_id: str,
    delete_request: SignatureDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Soft delete a signature (admin can still access)"""
    try:
        result = await db.execute(
            select(Signature).where(
                and_(
                    Signature.id == signature_id,
                    Signature.signer_id == current_user["user_id"],
                    Signature.is_deleted == False
                )
            )
        )
        signature = result.scalar_one_or_none()
        
        if not signature:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Signature not found"
            )
        
        # Soft delete the signature
        signature.is_deleted = True
        signature.deleted_at = datetime.now(timezone.utc)
        signature.deleted_by = current_user["user_id"]
        signature.deletion_reason = delete_request.deletion_reason
        
        await db.commit()
        
        return {"message": "Signature deleted successfully", "signature_id": signature_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Soft delete signature error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete signature"
        )

@router.post("/{signature_id}/restore")
async def restore_signature(
    signature_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Restore a soft-deleted signature"""
    try:
        result = await db.execute(
            select(Signature).where(
                and_(
                    Signature.id == signature_id,
                    Signature.signer_id == current_user["user_id"],
                    Signature.is_deleted == True
                )
            )
        )
        signature = result.scalar_one_or_none()
        
        if not signature:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deleted signature not found"
            )
        
        # Restore the signature
        signature.is_deleted = False
        signature.deleted_at = None
        signature.deleted_by = None
        signature.deletion_reason = None
        
        await db.commit()
        
        return {"message": "Signature restored successfully", "signature_id": signature_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Restore signature error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to restore signature"
        )

# Admin endpoints
@router.get("/admin/all", response_model=AdminSignatureListResponse)
async def admin_list_all_signatures(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    include_deleted: bool = Query(False),
    status_filter: Optional[str] = Query(None),
    document_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    signature_level: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Admin endpoint to list all signatures with full details"""
    try:
        # Check if user is admin
        if current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        # Build query with joins for user and document info
        query = select(
            Signature,
            User.email.label("signer_email"),
            User.first_name.label("signer_first_name"),
            User.last_name.label("signer_last_name"),
            Document.title.label("document_title")
        ).join(
            User, Signature.signer_id == User.id
        ).join(
            Document, Signature.document_id == Document.id
        )
        
        # Apply filters
        if not include_deleted:
            query = query.where(Signature.is_deleted == False)
        
        if status_filter:
            query = query.where(Signature.status == status_filter)
        if document_id:
            query = query.where(Signature.document_id == document_id)
        if user_id:
            query = query.where(Signature.signer_id == user_id)
        if signature_level:
            query = query.where(Signature.signature_level == signature_level)
        
        # Get total count
        count_query = select(Signature)
        if not include_deleted:
            count_query = count_query.where(Signature.is_deleted == False)
        if status_filter:
            count_query = count_query.where(Signature.status == status_filter)
        if document_id:
            count_query = count_query.where(Signature.document_id == document_id)
        if user_id:
            count_query = count_query.where(Signature.signer_id == user_id)
        if signature_level:
            count_query = count_query.where(Signature.signature_level == signature_level)
        
        total_result = await db.execute(count_query)
        total = len(total_result.scalars().all())
        
        # Get deleted count
        deleted_count = 0
        if include_deleted:
            deleted_result = await db.execute(
                select(Signature).where(Signature.is_deleted == True)
            )
            deleted_count = len(deleted_result.scalars().all())
        
        # Get signatures with pagination
        result = await db.execute(query.offset(skip).limit(limit))
        signatures_data = result.all()
        
        signatures = []
        for sig_data in signatures_data:
            signature = sig_data[0]  # Signature object
            signer_email = sig_data[1]
            signer_first_name = sig_data[2]
            signer_last_name = sig_data[3]
            document_title = sig_data[4]
            
            signer_name = None
            if signer_first_name or signer_last_name:
                signer_name = f"{signer_first_name or ''} {signer_last_name or ''}".strip()
            
            signatures.append(AdminSignatureResponse(
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
                compliance_standard=signature.compliance_standard,
                # Hybrid signature fields
                certificate_type=signature.certificate_type,
                # Soft delete fields
                is_deleted=signature.is_deleted,
                deleted_at=signature.deleted_at,
                deleted_by=str(signature.deleted_by) if signature.deleted_by else None,
                deletion_reason=signature.deletion_reason,
                # User information
                signer_email=signer_email,
                signer_name=signer_name,
                document_title=document_title
            ))
        
        return AdminSignatureListResponse(
            signatures=signatures,
            total=total,
            skip=skip,
            limit=limit,
            has_more=(skip + limit) < total,
            deleted_count=deleted_count
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin list signatures error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list signatures"
        )

@router.get("/admin/{signature_id}", response_model=AdminSignatureResponse)
async def admin_get_signature(
    signature_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Admin endpoint to get signature with full details"""
    try:
        # Check if user is admin
        if current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        # Get signature with user and document info
        result = await db.execute(
            select(
                Signature,
                User.email.label("signer_email"),
                User.first_name.label("signer_first_name"),
                User.last_name.label("signer_last_name"),
                Document.title.label("document_title")
            ).join(
                User, Signature.signer_id == User.id
            ).join(
                Document, Signature.document_id == Document.id
            ).where(Signature.id == signature_id)
        )
        
        signature_data = result.first()
        if not signature_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Signature not found"
            )
        
        signature = signature_data[0]
        signer_email = signature_data[1]
        signer_first_name = signature_data[2]
        signer_last_name = signature_data[3]
        document_title = signature_data[4]
        
        signer_name = None
        if signer_first_name or signer_last_name:
            signer_name = f"{signer_first_name or ''} {signer_last_name or ''}".strip()
        
        return AdminSignatureResponse(
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
            compliance_standard=signature.compliance_standard,
            # Hybrid signature fields
            certificate_type=signature.certificate_type,
            # Soft delete fields
            is_deleted=signature.is_deleted,
            deleted_at=signature.deleted_at,
            deleted_by=str(signature.deleted_by) if signature.deleted_by else None,
            deletion_reason=signature.deletion_reason,
            # User information
            signer_email=signer_email,
            signer_name=signer_name,
            document_title=document_title
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin get signature error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get signature"
        )

@router.post("/admin/{signature_id}/restore")
async def admin_restore_signature(
    signature_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Admin endpoint to restore any soft-deleted signature"""
    try:
        # Check if user is admin
        if current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        result = await db.execute(
            select(Signature).where(
                and_(
                    Signature.id == signature_id,
                    Signature.is_deleted == True
                )
            )
        )
        signature = result.scalar_one_or_none()
        
        if not signature:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deleted signature not found"
            )
        
        # Restore the signature
        signature.is_deleted = False
        signature.deleted_at = None
        signature.deleted_by = None
        signature.deletion_reason = None
        
        await db.commit()
        
        return {"message": "Signature restored successfully by admin", "signature_id": signature_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin restore signature error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to restore signature"
        )
