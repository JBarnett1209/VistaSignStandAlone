"""
Certificate Validation API Endpoints
Provides endpoints to verify certificate loading and signing functionality
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any
import logging

from app.core.database import get_db
from app.core.security.auth import get_current_user
from app.core.legal_signature import legal_signature_service
from app.core.digital_signature import digital_signature_service
from app.core.hybrid_signature import hybrid_signature_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/certificate-status")
async def get_certificate_status(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the status of all certificate services and validate they're working"""
    try:
        # Check if user is admin
        if current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        results = {
            "legal_signature_service": {
                "available": legal_signature_service.is_available(),
                "certificate_loaded": legal_signature_service._certificate is not None,
                "private_key_loaded": legal_signature_service._private_key is not None
            },
            "digital_signature_service": {
                "available": digital_signature_service.is_available(),
                "certificate_loaded": digital_signature_service._certificate is not None,
                "private_key_loaded": digital_signature_service._private_key is not None
            },
            "hybrid_signature_service": {
                "available": hybrid_signature_service.is_available(),
                "system_certificate_loaded": hybrid_signature_service._system_certificate is not None,
                "system_private_key_loaded": hybrid_signature_service._system_private_key is not None
            }
        }
        
        # Get certificate information if available
        if legal_signature_service.is_available():
            cert_info = legal_signature_service.get_certificate_chain_info()
            if cert_info:
                results["legal_signature_service"]["certificate_info"] = {
                    "subject": cert_info.get("subject", {}),
                    "issuer": cert_info.get("issuer", {}),
                    "validity": cert_info.get("validity", {}),
                    "fingerprints": cert_info.get("fingerprints", {})
                }
        
        if digital_signature_service.is_available():
            cert_info = digital_signature_service.get_certificate_info()
            if cert_info:
                results["digital_signature_service"]["certificate_info"] = cert_info
        
        return {
            "status": "success",
            "certificate_services": results,
            "overall_status": "healthy" if all(
                service["available"] for service in results.values()
            ) else "degraded"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Certificate status check error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check certificate status"
        )


@router.post("/test-signature")
async def test_signature_creation(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Test signature creation and verification to ensure certificates are working"""
    try:
        # Check if user is admin
        if current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        # Test data
        test_document_content = b"This is a test document for signature validation"
        test_user_id = str(current_user["user_id"])
        test_signature_data = "Test Signature Data"
        test_signing_context = {
            "ip_address": "127.0.0.1",
            "user_agent": "VistaSign Test",
            "signing_reason": "Certificate validation test",
            "signing_location": "Test Environment",
            "timestamp": "2024-01-01T00:00:00Z"
        }
        
        results = {}
        
        # Test Legal Signature Service
        if legal_signature_service.is_available():
            try:
                legal_sig = legal_signature_service.create_legal_signature(
                    document_content=test_document_content,
                    user_id=test_user_id,
                    signature_data=test_signature_data,
                    signing_context=test_signing_context
                )
                
                if legal_sig:
                    # Verify the signature
                    verification_result = legal_signature_service.verify_legal_signature(legal_sig)
                    
                    results["legal_signature_service"] = {
                        "signature_created": True,
                        "digital_signature": legal_sig.get("digital_signature", "")[:50] + "...",
                        "document_hash": legal_sig.get("document_hash", ""),
                        "certificate_thumbprint": legal_sig.get("certificate_thumbprint", ""),
                        "verification_result": verification_result
                    }
                else:
                    results["legal_signature_service"] = {
                        "signature_created": False,
                        "error": "Failed to create signature"
                    }
            except Exception as e:
                results["legal_signature_service"] = {
                    "signature_created": False,
                    "error": str(e)
                }
        else:
            results["legal_signature_service"] = {
                "signature_created": False,
                "error": "Service not available"
            }
        
        # Test Digital Signature Service
        if digital_signature_service.is_available():
            try:
                digital_sig = digital_signature_service.create_complete_signature(
                    document_content=test_document_content,
                    user_id=test_user_id,
                    signature_data=test_signature_data,
                    signing_context=test_signing_context
                )
                
                if digital_sig:
                    # Verify the signature
                    verification_result = digital_signature_service.verify_complete_signature(digital_sig)
                    
                    results["digital_signature_service"] = {
                        "signature_created": True,
                        "digital_signature": digital_sig.get("digital_signature", "")[:50] + "...",
                        "document_hash": digital_sig.get("document_hash", ""),
                        "verification_result": verification_result
                    }
                else:
                    results["digital_signature_service"] = {
                        "signature_created": False,
                        "error": "Failed to create signature"
                    }
            except Exception as e:
                results["digital_signature_service"] = {
                    "signature_created": False,
                    "error": str(e)
                }
        else:
            results["digital_signature_service"] = {
                "signature_created": False,
                "error": "Service not available"
            }
        
        # Test Hybrid Signature Service
        if hybrid_signature_service.is_available():
            try:
                hybrid_sig = hybrid_signature_service.create_hybrid_signature(
                    document_content=test_document_content,
                    user_id=test_user_id,
                    signature_data=test_signature_data,
                    signing_context=test_signing_context
                )
                
                if hybrid_sig:
                    # Verify the signature
                    verification_result = hybrid_signature_service.verify_hybrid_signature(hybrid_sig)
                    
                    results["hybrid_signature_service"] = {
                        "signature_created": True,
                        "digital_signature": hybrid_sig.get("digital_signature", "")[:50] + "...",
                        "document_hash": hybrid_sig.get("document_hash", ""),
                        "verification_result": verification_result
                    }
                else:
                    results["hybrid_signature_service"] = {
                        "signature_created": False,
                        "error": "Failed to create signature"
                    }
            except Exception as e:
                results["hybrid_signature_service"] = {
                    "signature_created": False,
                    "error": str(e)
                }
        else:
            results["hybrid_signature_service"] = {
                "signature_created": False,
                "error": "Service not available"
            }
        
        # Overall status
        all_working = all(
            result.get("signature_created", False) for result in results.values()
        )
        
        return {
            "status": "success" if all_working else "partial_failure",
            "test_results": results,
            "summary": {
                "total_services": len(results),
                "working_services": sum(1 for result in results.values() if result.get("signature_created", False)),
                "all_certificates_valid": all_working
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signature test error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to test signature creation"
        )


@router.get("/certificate-details")
async def get_certificate_details(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get detailed certificate information for validation"""
    try:
        # Check if user is admin
        if current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        details = {}
        
        # Get legal signature certificate details
        if legal_signature_service.is_available():
            cert_info = legal_signature_service.get_certificate_chain_info()
            if cert_info:
                details["legal_signature_certificate"] = {
                    "subject": cert_info.get("subject", {}),
                    "issuer": cert_info.get("issuer", {}),
                    "validity": cert_info.get("validity", {}),
                    "fingerprints": cert_info.get("fingerprints", {}),
                    "key_usage": cert_info.get("key_usage", {}),
                    "compliance": cert_info.get("compliance", {})
                }
        
        # Get digital signature certificate details
        if digital_signature_service.is_available():
            cert_info = digital_signature_service.get_certificate_info()
            if cert_info:
                details["digital_signature_certificate"] = cert_info
        
        return {
            "status": "success",
            "certificate_details": details,
            "validation_summary": {
                "certificates_loaded": len(details),
                "ready_for_signing": len(details) > 0
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Certificate details error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get certificate details"
        )
