"""
Envelope finalization worker.
Handles flattening fields into PDF and generating evidence.
"""

import logging
from typing import Dict, Any
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db_session
from app.models.envelope import Envelope, EnvelopeStatus, Field, FieldValue, Recipient, AuditEvent
from app.services.storage import storage_service

logger = logging.getLogger(__name__)


async def finalize_envelope(envelope_id: str) -> Dict[str, Any]:
    """
    Finalize an envelope by flattening fields into PDF and generating evidence.
    This is a background job that runs after an envelope is sent.
    """
    logger.info(f"Starting finalization for envelope {envelope_id}")
    
    try:
        async with get_db_session() as db:
            # Get envelope with all relationships
            envelope = await db.get(Envelope, uuid.UUID(envelope_id))
            if not envelope:
                raise ValueError(f"Envelope {envelope_id} not found")
            
            if envelope.status != EnvelopeStatus.SENT:
                logger.warning(f"Envelope {envelope_id} is not in SENT status, current: {envelope.status}")
                return {"status": "skipped", "reason": "not_sent"}
            
            # Get all fields and field values
            fields_query = select(Field).where(Field.envelope_id == envelope.id)
            fields = (await db.execute(fields_query)).scalars().all()
            
            field_values_query = select(FieldValue).where(FieldValue.envelope_id == envelope.id)
            field_values = (await db.execute(field_values_query)).scalars().all()
            
            # Get recipients
            recipients_query = select(Recipient).where(Recipient.envelope_id == envelope.id)
            recipients = (await db.execute(recipients_query)).scalars().all()

            # Get audit events explicitly. Accessing envelope.audit_events lazily
            # raises MissingGreenlet under async SQLAlchemy, so fetch up front.
            audit_query = select(AuditEvent).where(AuditEvent.envelope_id == envelope.id).order_by(AuditEvent.occurred_at)
            audit_events = (await db.execute(audit_query)).scalars().all()

            # 1. Get the original document
            from app.models.document import Document
            document = await db.get(Document, envelope.document_id)
            if not document:
                raise ValueError(f"Document not found for envelope {envelope_id}")
            
            # 2. Flatten fields into PDF
            logger.info(f"Flattening fields for envelope {envelope_id}...")
            from app.services.pdf_flattener import pdf_flattener
            
            # Flatten the PDF (pass fields explicitly; envelope.fields is lazy)
            flattened_pdf_content = await pdf_flattener.flatten_envelope(
                envelope, document, fields, field_values
            )

            # 3. Add certificate page
            logger.info(f"Adding certificate page for envelope {envelope_id}...")
            final_pdf_content = await pdf_flattener.add_certificate_page(
                flattened_pdf_content, envelope, document, recipients, audit_events
            )

            # 4. Apply digital (PAdES) signature using the real pyHanko signer.
            # sign_pdf_pades returns None if no signing cert is configured; in
            # that case fall back to the flattened + certificate PDF so the
            # envelope still completes.
            logger.info(f"Applying digital signature for envelope {envelope_id}...")
            from app.core.pdf_signer import sign_pdf_pades

            signed_pdf_content = await sign_pdf_pades(
                final_pdf_content, reason="Document signing completion"
            )
            if signed_pdf_content is None:
                logger.warning(
                    f"No PAdES signature applied for {envelope_id} "
                    "(signing cert unavailable); storing unsigned flattened PDF"
                )
                signed_pdf_content = final_pdf_content

            # 5. Save signed PDF to storage
            signed_pdf_key = await storage_service.save_file(signed_pdf_content, f"signed_{envelope_id}.pdf")
            
            # 6. Generate evidence JSON
            evidence_data = await _generate_evidence_json(
                envelope, fields, field_values, recipients, audit_events, document
            )
            evidence_json_content = evidence_data.encode('utf-8')
            evidence_json_key = await storage_service.save_file(evidence_json_content, f"evidence_{envelope_id}.json")
            
            # 7. Update envelope with finalization results
            envelope.storage_key_signed_pdf = signed_pdf_key
            envelope.storage_key_evidence_json = evidence_json_key
            envelope.status = EnvelopeStatus.COMPLETED
            envelope.completed_at = datetime.now(timezone.utc)

            # The completed copy is emailed to everyone below, so the signing
            # links are no longer needed — expire them so an old link can't be
            # reopened after completion.
            from app.models.envelope import SignLink
            sign_links = (await db.execute(
                select(SignLink).where(SignLink.envelope_id == envelope.id)
            )).scalars().all()
            for sl in sign_links:
                sl.expires_at = datetime.now(timezone.utc)

            await db.commit()

            # 8. Email the finished, signed copy to everyone (all signers + owner),
            # DocuSign-style. Email failures must not fail the finalization.
            try:
                from app.services.envelope_dispatch import send_completed_copy
                from app.models.user import User
                doc_title = (document.title if document else None) or "Signed Document"
                emails = {r.email for r in recipients if r.email}
                if envelope.created_by:
                    owner = await db.get(User, envelope.created_by)
                    if owner and owner.email:
                        emails.add(owner.email)
                for addr in emails:
                    try:
                        send_completed_copy(addr, doc_title, signed_pdf_content)
                        logger.info(f"Sent completed copy to {addr} for envelope {envelope_id}")
                    except Exception as mail_err:
                        logger.error(f"Failed to email completed copy to {addr}: {mail_err}")
            except Exception as broadcast_err:
                logger.error(f"Completed-copy broadcast failed for {envelope_id}: {broadcast_err}")

            logger.info(f"Successfully finalized envelope {envelope_id}")
            return {
                "status": "completed",
                "envelope_id": envelope_id,
                "fields_count": len(fields),
                "field_values_count": len(field_values),
                "recipients_count": len(recipients),
                "signed_pdf_key": signed_pdf_key,
                "evidence_json_key": evidence_json_key
            }
            
    except Exception as e:
        logger.error(f"Failed to finalize envelope {envelope_id}: {str(e)}")
        
        # Mark envelope as failed
        try:
            async with get_db_session() as db:
                envelope = await db.get(Envelope, uuid.UUID(envelope_id))
                if envelope:
                    envelope.status = EnvelopeStatus.FINALIZATION_FAILED
                    await db.commit()
        except Exception as commit_error:
            logger.error(f"Failed to update envelope status to failed: {str(commit_error)}")
        
        raise e


async def _generate_evidence_json(envelope, fields, field_values, recipients, audit_events, document) -> str:
    """Generate evidence JSON for the envelope.

    All related collections (fields, audit_events, document) are passed in
    explicitly; accessing them as lazy relationships on `envelope` raises
    MissingGreenlet under async SQLAlchemy.
    """
    import json
    
    evidence = {
        "envelope_id": str(envelope.id),
        "subject": envelope.subject,
        "created_at": envelope.created_at.isoformat(),
        "completed_at": envelope.completed_at.isoformat() if envelope.completed_at else None,
        "recipients": [
            {
                "id": str(r.id),
                "name": r.name,
                "email": r.email,
                "role": r.role,
                "status": r.status,
                "signed_at": r.signed_at.isoformat() if r.signed_at else None,
                "signer_ip": r.signer_ip,
                "signer_user_agent": r.signer_user_agent,
            } for r in recipients
        ],
        "fields": [
            {
                "id": str(f.id),
                "type": f.type,
                "page_index": f.page_index,
                "rect_pts": f.rect_pts,
                "recipient_id": str(f.recipient_id) if f.recipient_id else None,
                "value": next((fv.value for fv in field_values if fv.field_id == f.id), None),
                "signed_at": next((fv.signed_at.isoformat() for fv in field_values if fv.field_id == f.id), None),
                "signer_ip": next((fv.signer_ip for fv in field_values if fv.field_id == f.id), None),
                "signer_user_agent": next((fv.signer_user_agent for fv in field_values if fv.field_id == f.id), None),
                "evidence_hash": next((fv.evidence_hash for fv in field_values if fv.field_id == f.id), None),
            } for f in fields
        ],
        "audit_trail": [
            {
                "id": str(ae.id),
                "event": ae.event,
                "actor_type": ae.actor_type,
                "actor_id": str(ae.actor_id) if ae.actor_id else None,
                "occurred_at": ae.occurred_at.isoformat(),
                "metadata": ae.event_metadata,
            } for ae in audit_events
        ],
        "document_hash": document.file_hash if document else None,
        "document_title": document.title if document else None,
    }
    
    return json.dumps(evidence, indent=2)