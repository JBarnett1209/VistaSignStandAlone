"""
Contacts (address book) API — saved recipients for quick reuse.
"""

import csv
import io
import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security.auth import get_current_user
from app.models.contact import Contact
from app.schemas.contact import ContactCreate, ContactUpdate, ContactResponse, ContactListResponse

logger = logging.getLogger(__name__)
router = APIRouter()


def _to_response(c: Contact) -> ContactResponse:
    return ContactResponse(id=str(c.id), name=c.name, email=c.email,
                           company=c.company, created_at=c.created_at)


async def upsert_contact(db: AsyncSession, owner_id: uuid.UUID, email: str, name: Optional[str] = None,
                         company: Optional[str] = None) -> Optional[Contact]:
    """Create the contact if the owner doesn't already have one for this email.

    Used both by the API and to auto-save recipients. Does not overwrite an
    existing contact's name. Caller commits.
    """
    email = (email or "").strip().lower()
    if not email:
        return None
    existing = (await db.execute(
        select(Contact).where(Contact.owner_id == owner_id, func.lower(Contact.email) == email)
    )).scalar_one_or_none()
    if existing:
        return existing
    contact = Contact(owner_id=owner_id, email=email,
                      name=(name or email.split("@")[0]), company=company)
    db.add(contact)
    return contact


@router.get("/", response_model=ContactListResponse)
async def list_contacts(
    search: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    owner_id = uuid.UUID(current_user["user_id"])
    query = select(Contact).where(Contact.owner_id == owner_id)
    if search:
        like = f"%{search}%"
        query = query.where(or_(Contact.name.ilike(like), Contact.email.ilike(like)))
    query = query.order_by(Contact.name)
    rows = (await db.execute(query.limit(limit))).scalars().all()
    return ContactListResponse(contacts=[_to_response(c) for c in rows], total=len(rows))


@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    payload: ContactCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    owner_id = uuid.UUID(current_user["user_id"])
    email = payload.email.strip().lower()
    existing = (await db.execute(
        select(Contact).where(Contact.owner_id == owner_id, func.lower(Contact.email) == email)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A contact with this email already exists")
    contact = Contact(owner_id=owner_id, name=payload.name, email=email, company=payload.company)
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return _to_response(contact)


def _find_header(lower_headers, *, equals=(), contains=()):
    """Pick a CSV header by exact match first, then substring match."""
    for h in lower_headers:
        if h in equals:
            return h
    for h in lower_headers:
        if any(c in h for c in contains):
            return h
    return None


@router.post("/import")
async def import_contacts(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk-import contacts from a CSV. Flexibly maps columns (handles common
    Google/Outlook exports): finds an email column, a name (or first+last)
    column, and an optional company/organization column."""
    owner_id = uuid.UUID(current_user["user_id"])
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large (max 5MB)")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1", errors="replace")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not read CSV headers")

    # Map lowercased header -> original header.
    orig_by_lower = {(h or "").strip().lower(): h for h in reader.fieldnames}
    lowers = list(orig_by_lower.keys())
    email_h = _find_header(lowers, equals=("email", "e-mail", "email address"), contains=("email", "e-mail"))
    name_h = _find_header(lowers, equals=("name", "full name", "display name", "contact name"))
    first_h = _find_header(lowers, equals=("first name", "given name", "firstname"))
    last_h = _find_header(lowers, equals=("last name", "family name", "surname", "lastname"))
    company_h = _find_header(lowers, equals=("company", "organization", "organisation"),
                             contains=("company", "organization", "organisation"))
    if not email_h:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="No email column found in the CSV")

    def cell(row, lower_h):
        return (row.get(orig_by_lower[lower_h]) or "").strip() if lower_h else ""

    existing = {e.lower() for (e,) in (await db.execute(
        select(Contact.email).where(Contact.owner_id == owner_id)
    )).all()}

    imported = duplicates = skipped = 0
    errors = []
    to_add = []
    for i, row in enumerate(reader, start=2):  # row 1 is the header
        email = cell(row, email_h).lower()
        if not email or "@" not in email or "." not in email.rsplit("@", 1)[-1]:
            skipped += 1
            if email:
                errors.append(f"Row {i}: invalid email '{email}'")
            continue
        if email in existing:
            duplicates += 1
            continue
        existing.add(email)
        name = cell(row, name_h)
        if not name and (first_h or last_h):
            name = f"{cell(row, first_h)} {cell(row, last_h)}".strip()
        company = cell(row, company_h) or None
        to_add.append(Contact(owner_id=owner_id, email=email,
                              name=name or email.split("@")[0], company=company))
        imported += 1

    if to_add:
        db.add_all(to_add)
        await db.commit()

    return {"imported": imported, "duplicates": duplicates, "skipped": skipped,
            "errors": errors[:20]}


@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: str,
    payload: ContactUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    owner_id = uuid.UUID(current_user["user_id"])
    contact = (await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.owner_id == owner_id)
    )).scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    if payload.name is not None:
        contact.name = payload.name
    if payload.email is not None:
        contact.email = payload.email.strip().lower()
    if payload.company is not None:
        contact.company = payload.company
    await db.commit()
    await db.refresh(contact)
    return _to_response(contact)


@router.delete("/{contact_id}")
async def delete_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    owner_id = uuid.UUID(current_user["user_id"])
    contact = (await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.owner_id == owner_id)
    )).scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    await db.delete(contact)
    await db.commit()
    return {"message": "Contact deleted"}
