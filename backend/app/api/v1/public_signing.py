"""
VistaSign Public Signing API Endpoints
DocuSign-style public document signing
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from typing import List, Optional
import logging
import secrets
import string
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security.auth import get_current_user, get_current_user_optional
from app.models.public_signing import (
    PublicDocument, PublicSigningRecipient, PublicSignature, Organization,
    PublicSigningStatus
)
from app.models.subscription import Subscription, SubscriptionTier
from app.schemas.public_signing import (
    PublicDocumentCreate, PublicDocumentResponse, PublicDocumentListResponse,
    PublicSigningRecipientCreate, PublicSigningRecipientResponse,
    PublicSignatureCreate, PublicSignatureResponse,
    PublicSigningRequest, PublicSigningResponse
)

router = APIRouter()
logger = logging.getLogger(__name__)

def generate_public_id():
    """Generate a short public ID for URLs"""
    return ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(8))

def generate_access_token():
    """Generate access token for recipients"""
    return secrets.token_urlsafe(32)

@router.post("/documents", response_model=PublicDocumentResponse)
async def create_public_document(
    document_data: PublicDocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a public document for external signing"""
    try:
        # Check user's subscription limits
        result = await db.execute(
            select(Subscription).where(Subscription.user_id == current_user["user_id"])
        )
        subscription = result.scalar_one_or_none()
        
        if not subscription:
            # Create free subscription if none exists
            subscription = Subscription(
                user_id=current_user["user_id"],
                tier=SubscriptionTier.FREE
            )
            db.add(subscription)
            await db.commit()
        
        # Check if user has reached monthly limit
        from datetime import datetime
        current_month = datetime.utcnow().month
        current_year = datetime.utcnow().year
        
        usage_result = await db.execute(
            select(UsageTracking).where(
                and_(
                    UsageTracking.user_id == current_user["user_id"],
                    UsageTracking.year == current_year,
                    UsageTracking.month == current_month
                )
            )
        )
        usage = usage_result.scalar_one_or_none()
        
        if not usage:
            usage = UsageTracking(
                user_id=current_user["user_id"],
                subscription_id=subscription.id,
                year=current_year,
                month=current_month
            )
            db.add(usage)
        
        # Check limits
        if usage.documents_uploaded >= subscription.max_documents_per_month:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Monthly document limit reached ({subscription.max_documents_per_month}). Upgrade your plan for more documents."
            )
        
        # Create public document
        public_doc = PublicDocument(
            title=document_data.title,
            description=document_data.description,
            document_url=document_data.document_url,
            sender_name=document_data.sender_name,
            sender_email=document_data.sender_email,
            sender_company=document_data.sender_company,
            requires_signature=document_data.requires_signature,
            allow_decline=document_data.allow_decline,
            allow_forward=document_data.allow_forward,
            reminder_frequency=document_data.reminder_frequency,
            expires_at=document_data.expires_at,
            public_id=generate_public_id(),
            access_code=document_data.access_code,
            created_by=current_user["user_id"]
        )
        
        db.add(public_doc)
        await db.commit()
        await db.refresh(public_doc)
        
        # Create recipients
        for recipient_data in document_data.recipients:
            recipient = PublicSigningRecipient(
                document_id=public_doc.id,
                name=recipient_data.name,
                email=recipient_data.email,
                role=recipient_data.role,
                order=recipient_data.order,
                access_token=generate_access_token(),
                custom_fields=recipient_data.custom_fields
            )
            db.add(recipient)
        
        # Update usage
        usage.documents_uploaded += 1
        await db.commit()
        
        return PublicDocumentResponse(
            id=str(public_doc.id),
            title=public_doc.title,
            description=public_doc.description,
            public_id=public_doc.public_id,
            public_url=public_doc.public_url,
            status=public_doc.status.value,
            expires_at=public_doc.expires_at,
            created_at=public_doc.created_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create public document error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create public document"
        )

@router.get("/documents", response_model=PublicDocumentListResponse)
async def list_public_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List user's public documents"""
    try:
        # Build query
        query = select(PublicDocument).where(PublicDocument.created_by == current_user["user_id"])
        
        # Apply filters
        if status:
            query = query.where(PublicDocument.status == status)
        
        # Get total count
        count_query = select(PublicDocument).where(PublicDocument.created_by == current_user["user_id"])
        if status:
            count_query = count_query.where(PublicDocument.status == status)
        
        total_result = await db.execute(count_query)
        total = len(total_result.scalars().all())
        
        # Get documents with pagination
        result = await db.execute(query.offset(skip).limit(limit))
        documents = result.scalars().all()
        
        return PublicDocumentListResponse(
            documents=[
                PublicDocumentResponse(
                    id=str(doc.id),
                    title=doc.title,
                    description=doc.description,
                    public_id=doc.public_id,
                    public_url=doc.public_url,
                    status=doc.status.value,
                    expires_at=doc.expires_at,
                    created_at=doc.created_at
                ) for doc in documents
            ],
            total=total,
            skip=skip,
            limit=limit,
            has_more=(skip + limit) < total
        )
        
    except Exception as e:
        logger.error(f"List public documents error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list public documents"
        )

@router.get("/sign/{public_id}", response_model=PublicSigningResponse)
async def get_public_signing_page(
    public_id: str,
    access_token: Optional[str] = Query(None),
    access_code: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Get public signing page (no authentication required)"""
    try:
        # Find document by public ID
        result = await db.execute(
            select(PublicDocument).where(PublicDocument.public_id == public_id)
        )
        document = result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        # Check if document is expired
        if document.is_expired:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Document has expired"
            )
        
        # Check access code if required
        if document.access_code and access_code != document.access_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid access code"
            )
        
        # Get recipients
        recipients_result = await db.execute(
            select(PublicSigningRecipient).where(
                PublicSigningRecipient.document_id == document.id
            )
        )
        recipients = recipients_result.scalars().all()
        
        return PublicSigningResponse(
            document=PublicDocumentResponse(
                id=str(document.id),
                title=document.title,
                description=document.description,
                public_id=document.public_id,
                public_url=document.public_url,
                status=document.status.value,
                expires_at=document.expires_at,
                created_at=document.created_at
            ),
            recipients=[
                PublicSigningRecipientResponse(
                    id=str(recipient.id),
                    name=recipient.name,
                    email=recipient.email,
                    role=recipient.role,
                    status=recipient.status.value,
                    signed_at=recipient.signed_at
                ) for recipient in recipients
            ],
            requires_access_code=bool(document.access_code),
            access_code_provided=bool(access_code)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get public signing page error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get signing page"
        )

@router.post("/sign/{public_id}/sign", response_model=PublicSignatureResponse)
async def sign_public_document(
    public_id: str,
    signature_data: PublicSignatureCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Sign a public document (no authentication required)"""
    try:
        # Find document
        result = await db.execute(
            select(PublicDocument).where(PublicDocument.public_id == public_id)
        )
        document = result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        # Check if document is expired
        if document.is_expired:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Document has expired"
            )
        
        # Find recipient by access token
        recipient_result = await db.execute(
            select(PublicSigningRecipient).where(
                and_(
                    PublicSigningRecipient.document_id == document.id,
                    PublicSigningRecipient.access_token == signature_data.access_token
                )
            )
        )
        recipient = recipient_result.scalar_one_or_none()
        
        if not recipient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid access token"
            )
        
        # Check if already signed
        if recipient.status == PublicSigningStatus.SIGNED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Document already signed"
            )
        
        # Create signature
        signature = PublicSignature(
            recipient_id=recipient.id,
            signature_data=signature_data.signature_data,
            signature_image=signature_data.signature_image,
            signature_position=signature_data.signature_position,
            signing_reason=signature_data.signing_reason,
            signing_location=signature_data.signing_location,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            timestamp=datetime.utcnow()
        )
        
        db.add(signature)
        
        # Update recipient status
        recipient.status = PublicSigningStatus.SIGNED
        recipient.signed_at = datetime.utcnow()
        recipient.last_accessed = datetime.utcnow()
        
        # Check if all recipients have signed
        all_recipients_result = await db.execute(
            select(PublicSigningRecipient).where(
                PublicSigningRecipient.document_id == document.id
            )
        )
        all_recipients = all_recipients_result.scalars().all()
        
        if all(r.status == PublicSigningStatus.SIGNED for r in all_recipients):
            document.status = PublicSigningStatus.COMPLETED
            document.completed_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(signature)
        
        return PublicSignatureResponse(
            id=str(signature.id),
            signed_at=signature.signed_at,
            status="signed"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Sign public document error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to sign document"
        )

@router.get("/pricing")
async def get_pricing_plans():
    """Get pricing plans (public endpoint)"""
    return {
        "plans": [
            {
                "tier": "free",
                "name": "Free",
                "price_monthly": 0,
                "price_yearly": 0,
                "features": [
                    "5 documents per month",
                    "10 signatures per month",
                    "Basic templates",
                    "Email support"
                ],
                "limits": {
                    "documents_per_month": 5,
                    "signatures_per_month": 10,
                    "storage_gb": 1
                }
            },
            {
                "tier": "basic",
                "name": "Basic",
                "price_monthly": 9.99,
                "price_yearly": 99.99,
                "features": [
                    "50 documents per month",
                    "100 signatures per month",
                    "Advanced templates",
                    "Priority support",
                    "Custom branding"
                ],
                "limits": {
                    "documents_per_month": 50,
                    "signatures_per_month": 100,
                    "storage_gb": 10
                }
            },
            {
                "tier": "professional",
                "name": "Professional",
                "price_monthly": 29.99,
                "price_yearly": 299.99,
                "features": [
                    "Unlimited documents",
                    "Unlimited signatures",
                    "Advanced workflows",
                    "API access",
                    "Team collaboration",
                    "Advanced analytics"
                ],
                "limits": {
                    "documents_per_month": -1,  # Unlimited
                    "signatures_per_month": -1,
                    "storage_gb": 100
                }
            },
            {
                "tier": "enterprise",
                "name": "Enterprise",
                "price_monthly": 99.99,
                "price_yearly": 999.99,
                "features": [
                    "Everything in Professional",
                    "Custom integrations",
                    "Dedicated support",
                    "SLA guarantee",
                    "Custom domain",
                    "Advanced security"
                ],
                "limits": {
                    "documents_per_month": -1,
                    "signatures_per_month": -1,
                    "storage_gb": -1
                }
            }
        ]
    }
