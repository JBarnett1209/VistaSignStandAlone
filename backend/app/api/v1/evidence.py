from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Dict, Any
import uuid
import json
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.envelope import Envelope, Recipient, Field, FieldValue, AuditEvent
from app.services.storage import storage_service

router = APIRouter()

@router.get("/envelope/{envelope_id}/evidence")
async def get_envelope_evidence(
    envelope_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get evidence JSON for a completed envelope."""
    # Verify user has access to envelope
    envelope = await db.execute(
        select(Envelope).where(
            and_(Envelope.id == envelope_id, Envelope.tenant_id == current_user.id)
        )
    )
    envelope = envelope.scalar_one_or_none()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    if envelope.status != EnvelopeStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Envelope must be completed to access evidence")
    
    # Get evidence JSON from storage
    if not envelope.storage_key_evidence_json:
        raise HTTPException(status_code=404, detail="Evidence not found")
    
    try:
        evidence_content = await storage_service.get_file_content(envelope.storage_key_evidence_json)
        if not evidence_content:
            raise HTTPException(status_code=404, detail="Evidence file not found")
        
        evidence_data = json.loads(evidence_content.decode('utf-8'))
        return evidence_data
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid evidence format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve evidence: {str(e)}")

@router.get("/envelope/{envelope_id}/certificate")
async def get_envelope_certificate(
    envelope_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Download the signed PDF certificate for a completed envelope."""
    # Verify user has access to envelope
    envelope = await db.execute(
        select(Envelope).where(
            and_(Envelope.id == envelope_id, Envelope.tenant_id == current_user.id)
        )
    )
    envelope = envelope.scalar_one_or_none()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    if envelope.status != EnvelopeStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Envelope must be completed to download certificate")
    
    # Get signed PDF from storage
    if not envelope.storage_key_signed_pdf:
        raise HTTPException(status_code=404, detail="Signed PDF not found")
    
    try:
        pdf_content = await storage_service.get_file_content(envelope.storage_key_signed_pdf)
        if not pdf_content:
            raise HTTPException(status_code=404, detail="Signed PDF file not found")
        
        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=envelope_{envelope_id}_signed.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve signed PDF: {str(e)}")

@router.get("/envelope/{envelope_id}/audit-trail")
async def get_envelope_audit_trail(
    envelope_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get complete audit trail for an envelope."""
    # Verify user has access to envelope
    envelope = await db.execute(
        select(Envelope).where(
            and_(Envelope.id == envelope_id, Envelope.tenant_id == current_user.id)
        )
    )
    envelope = envelope.scalar_one_or_none()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    # Get all audit events
    audit_events = await db.execute(
        select(AuditEvent).where(AuditEvent.envelope_id == envelope_id)
        .order_by(AuditEvent.occurred_at)
    )
    audit_events = audit_events.scalars().all()
    
    # Get recipients and their field values
    recipients = await db.execute(
        select(Recipient).where(Recipient.envelope_id == envelope_id)
    )
    recipients = recipients.scalars().all()
    
    field_values = await db.execute(
        select(FieldValue).where(FieldValue.envelope_id == envelope_id)
    )
    field_values = field_values.scalars().all()
    
    return {
        "envelope_id": envelope_id,
        "envelope_status": envelope.status,
        "created_at": envelope.created_at,
        "completed_at": envelope.completed_at,
        "audit_trail": [
            {
                "id": event.id,
                "event": event.event,
                "actor_type": event.actor_type,
                "actor_id": event.actor_id,
                "occurred_at": event.occurred_at,
                "metadata": event.event_metadata
            }
            for event in audit_events
        ],
        "recipients": [
            {
                "id": recipient.id,
                "name": recipient.name,
                "email": recipient.email,
                "role": recipient.role,
                "routing_order": recipient.routing_order,
                "status": recipient.status,
                "signed_at": recipient.signed_at,
                "signer_ip": recipient.signer_ip,
                "signer_user_agent": recipient.signer_user_agent
            }
            for recipient in recipients
        ],
        "field_values": [
            {
                "id": fv.id,
                "field_id": fv.field_id,
                "recipient_id": fv.recipient_id,
                "value": fv.value,
                "signed_at": fv.signed_at,
                "signer_ip": fv.signer_ip,
                "signer_user_agent": fv.signer_user_agent,
                "evidence_hash": fv.evidence_hash
            }
            for fv in field_values
        ]
    }

@router.get("/envelope/{envelope_id}/verification")
async def verify_envelope_integrity(
    envelope_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Verify the integrity of a completed envelope."""
    # Verify user has access to envelope
    envelope = await db.execute(
        select(Envelope).where(
            and_(Envelope.id == envelope_id, Envelope.tenant_id == current_user.id)
        )
    )
    envelope = envelope.scalar_one_or_none()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
    
    if envelope.status != EnvelopeStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Envelope must be completed to verify integrity")
    
    verification_results = {
        "envelope_id": envelope_id,
        "verification_timestamp": datetime.now(timezone.utc),
        "checks": {}
    }
    
    # Check 1: Verify signed PDF exists and is accessible
    try:
        if envelope.storage_key_signed_pdf:
            pdf_content = await storage_service.get_file_content(envelope.storage_key_signed_pdf)
            verification_results["checks"]["signed_pdf_exists"] = {
                "status": "pass" if pdf_content else "fail",
                "message": "Signed PDF file exists and is accessible" if pdf_content else "Signed PDF file not found"
            }
        else:
            verification_results["checks"]["signed_pdf_exists"] = {
                "status": "fail",
                "message": "No signed PDF storage key found"
            }
    except Exception as e:
        verification_results["checks"]["signed_pdf_exists"] = {
            "status": "fail",
            "message": f"Error accessing signed PDF: {str(e)}"
        }
    
    # Check 2: Verify evidence JSON exists and is valid
    try:
        if envelope.storage_key_evidence_json:
            evidence_content = await storage_service.get_file_content(envelope.storage_key_evidence_json)
            if evidence_content:
                evidence_data = json.loads(evidence_content.decode('utf-8'))
                verification_results["checks"]["evidence_json_valid"] = {
                    "status": "pass",
                    "message": "Evidence JSON exists and is valid"
                }
            else:
                verification_results["checks"]["evidence_json_valid"] = {
                    "status": "fail",
                    "message": "Evidence JSON file not found"
                }
        else:
            verification_results["checks"]["evidence_json_valid"] = {
                "status": "fail",
                "message": "No evidence JSON storage key found"
            }
    except json.JSONDecodeError:
        verification_results["checks"]["evidence_json_valid"] = {
            "status": "fail",
            "message": "Evidence JSON is not valid JSON"
        }
    except Exception as e:
        verification_results["checks"]["evidence_json_valid"] = {
            "status": "fail",
            "message": f"Error accessing evidence JSON: {str(e)}"
        }
    
    # Check 3: Verify all required fields have values
    required_fields = await db.execute(
        select(Field).where(
            and_(Field.envelope_id == envelope_id, Field.required == True)
        )
    )
    required_fields = required_fields.scalars().all()
    
    field_values = await db.execute(
        select(FieldValue).where(FieldValue.envelope_id == envelope_id)
    )
    field_values = field_values.scalars().all()
    
    completed_required_fields = [
        f for f in required_fields 
        if any(fv.field_id == f.id and fv.value for fv in field_values)
    ]
    
    verification_results["checks"]["required_fields_completed"] = {
        "status": "pass" if len(completed_required_fields) == len(required_fields) else "fail",
        "message": f"All {len(required_fields)} required fields completed" if len(completed_required_fields) == len(required_fields) else f"Only {len(completed_required_fields)} of {len(required_fields)} required fields completed",
        "details": {
            "total_required": len(required_fields),
            "completed_required": len(completed_required_fields),
            "missing_fields": [f.id for f in required_fields if f.id not in [cf.id for cf in completed_required_fields]]
        }
    }
    
    # Check 4: Verify all recipients have completed
    recipients = await db.execute(
        select(Recipient).where(Recipient.envelope_id == envelope_id)
    )
    recipients = recipients.scalars().all()
    
    completed_recipients = [r for r in recipients if r.status == RecipientStatus.COMPLETED]
    
    verification_results["checks"]["all_recipients_completed"] = {
        "status": "pass" if len(completed_recipients) == len(recipients) else "fail",
        "message": f"All {len(recipients)} recipients completed" if len(completed_recipients) == len(recipients) else f"Only {len(completed_recipients)} of {len(recipients)} recipients completed",
        "details": {
            "total_recipients": len(recipients),
            "completed_recipients": len(completed_recipients),
            "incomplete_recipients": [r.id for r in recipients if r.status != RecipientStatus.COMPLETED]
        }
    }
    
    # Overall verification status
    all_checks_pass = all(
        check["status"] == "pass" 
        for check in verification_results["checks"].values()
    )
    verification_results["overall_status"] = "pass" if all_checks_pass else "fail"
    
    return verification_results
