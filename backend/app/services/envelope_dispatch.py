"""
Bridge: turn a sent workflow into a DocuSign-style envelope.

When a workflow is sent we create an Envelope from it (recipients from the
workflow participants, fields from the document's placed fields), issue a
per-recipient SignLink token, and email each recipient a `/sign/{token}` link.
The recipient then signs the envelope; when all recipients complete, the
finalize worker produces the signed PDF + evidence.
"""

import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.envelope import (
    Envelope, Recipient, Field, SignLink,
    EnvelopeStatus, RecipientRole, RecipientStatus,
)
from app.core.config import settings
from app.core.email import send_email

logger = logging.getLogger(__name__)

SIGN_LINK_TTL_DAYS = 30

# Map editor palette labels / loose strings to canonical envelope field types
# (which pdf_flattener understands).
_FIELD_TYPE_MAP = {
    "signature": "signature",
    "initials": "initials",
    "full name": "full_name",
    "full_name": "full_name",
    "email": "email",
    "date signed": "date_signed",
    "date_signed": "date_signed",
    "text": "text",
    "checkbox": "checkbox",
    "company": "company",
    "title": "title",
}


def _norm_type(t) -> str:
    if not t:
        return "text"
    key = str(t).strip().lower()
    return _FIELD_TYPE_MAP.get(key, key.replace(" ", "_"))


def _map_fields(envelope_id, document_fields, recipients_by_order, default_recipient_id) -> List[Field]:
    """Map document.fields (JSONB list) to envelope Field rows.

    Accepts the field editor shape, which may carry coordinates either flat
    ({x,y,w,h}) or nested ({rect:{...}} / {rect_pts:{...}}), a 1-based `page` or
    0-based `page_index`, and a `signingOrder`/`recipient_order` used to assign
    the field to the matching recipient. Unmatched fields go to the first
    recipient.
    """
    fields: List[Field] = []
    for f in (document_fields or []):
        rect = f.get("rect_pts") or f.get("rect") or f  # flat shape falls back to f itself
        page = f.get("page_index")
        if page is None:
            page = max(0, int(f.get("page", 1) or 1) - 1)
        order = f.get("signingOrder") or f.get("recipient_order")
        recipient_id = f.get("recipient_id")
        if not recipient_id and order is not None:
            recipient_id = recipients_by_order.get(int(order))
        fields.append(Field(
            envelope_id=envelope_id,
            recipient_id=recipient_id or default_recipient_id,
            page_index=int(page),
            type=_norm_type(f.get("type")),
            rect_pts={
                "x": float(rect.get("x", 72)),
                "y": float(rect.get("y", 72)),
                "w": float(rect.get("w", rect.get("width", 144))),
                "h": float(rect.get("h", rect.get("height", 32))),
            },
            rotation=int(f.get("rotation", 0) or 0),
            required=bool(f.get("required", False)),
        ))
    return fields


async def create_envelope_from_workflow(
    db: AsyncSession, workflow, participants, document
) -> Tuple[Envelope, List[Recipient]]:
    """Create an Envelope (+ recipients + fields) from a workflow. Not committed."""
    envelope = Envelope(
        tenant_id=workflow.created_by,
        document_id=workflow.document_id,
        subject=workflow.name or (document.title if document else "Document"),
        message=workflow.description,
        created_by=workflow.created_by,
        status=EnvelopeStatus.SENT,
    )
    db.add(envelope)
    await db.flush()  # assign envelope.id

    recipients: List[Recipient] = []
    for p in sorted(participants, key=lambda x: (x.signingOrder or 1)):
        recipient = Recipient(
            envelope_id=envelope.id,
            workflow_participant_id=p.id,
            name=(p.email.split("@")[0] if p.email else "Signer"),
            email=p.email,
            role=RecipientRole.SIGNER,
            routing_order=p.signingOrder or 1,
            status=RecipientStatus.PENDING,
        )
        db.add(recipient)
        recipients.append(recipient)
    await db.flush()  # assign recipient ids

    default_recipient_id = recipients[0].id if recipients else None
    recipients_by_order = {r.routing_order: r.id for r in recipients}
    for fld in _map_fields(envelope.id, getattr(document, "fields", None),
                           recipients_by_order, default_recipient_id):
        db.add(fld)
    await db.flush()

    return envelope, recipients


async def dispatch_envelope(
    db: AsyncSession, envelope: Envelope, recipients: List[Recipient], document
) -> List[Tuple[Recipient, str]]:
    """Issue a SignLink token per recipient and email the signing URL.

    Reuses an existing unused link if one is already present. Not committed.
    """
    base_url = (settings.FRONTEND_URL or "").rstrip("/")
    expires_at = datetime.now(timezone.utc) + timedelta(days=SIGN_LINK_TTL_DAYS)
    title = document.title if document else "Document"

    links: List[Tuple[Recipient, str]] = []
    for recipient in recipients:
        existing = (await db.execute(
            select(SignLink).where(SignLink.recipient_id == recipient.id)
        )).scalar_one_or_none()
        token = existing.token_jti if existing else secrets.token_urlsafe(32)
        if not existing:
            db.add(SignLink(
                envelope_id=envelope.id,
                recipient_id=recipient.id,
                token_jti=token,
                expires_at=expires_at,
            ))
        links.append((recipient, f"{base_url}/sign/{token}"))
    await db.flush()

    for recipient, url in links:
        try:
            _send_signing_email(recipient.email, title, envelope.message, url)
            logger.info(f"Sent envelope signing link to {recipient.email}")
        except Exception as e:  # email failures shouldn't abort the send
            logger.error(f"Failed to email signing link to {recipient.email}: {e}")

    return links


def send_completed_copy(email: str, doc_title: str, pdf_bytes: bytes) -> None:
    """Email the finished, signed PDF to a party once all recipients have signed."""
    subject = f"Completed: {doc_title}"
    filename = f"{doc_title}.pdf" if not doc_title.lower().endswith('.pdf') else doc_title
    html = f"""
    <html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #7E3AF2;">All parties have signed</h2>
        <p>Hello,</p>
        <p>Everyone has completed signing <strong>{doc_title}</strong>. The finished,
           signed copy is attached to this email for your records.</p>
        <p style="color: #666; font-size: 14px;">This completed document includes a
           signature certificate page with the audit trail.</p>
      </div>
    </body></html>
    """
    send_email(email, subject, html, attachments=[(filename, pdf_bytes, "pdf")])


def _send_signing_email(email: str, doc_title: str, message, url: str) -> None:
    subject = f"Document Signing Request: {doc_title}"
    desc = f'<p>{message}</p>' if message else ''
    html = f"""
    <html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #7E3AF2;">Document Signing Request</h2>
        <p>Hello,</p>
        <p>You have been requested to sign a document.</p>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #7E3AF2;">{doc_title}</h3>
          {desc}
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{url}" style="background-color: #7E3AF2; color: white; padding: 12px 30px;
             text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Sign Document</a>
        </div>
        <p style="color: #666; font-size: 14px;">If the button doesn't work, paste this link into your browser:<br>
          <a href="{url}">{url}</a></p>
      </div>
    </body></html>
    """
    send_email(email, subject, html)
