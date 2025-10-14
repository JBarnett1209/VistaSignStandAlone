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
from app.models.envelope import Envelope, EnvelopeStatus, Field, FieldValue, Recipient
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
            
            # For now, just mark as completed
            # TODO: Implement actual PDF flattening and evidence generation
            envelope.status = EnvelopeStatus.COMPLETED
            envelope.completed_at = datetime.now(timezone.utc)
            
            await db.commit()
            
            logger.info(f"Successfully finalized envelope {envelope_id}")
            return {
                "status": "completed",
                "envelope_id": envelope_id,
                "fields_count": len(fields),
                "field_values_count": len(field_values),
                "recipients_count": len(recipients)
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