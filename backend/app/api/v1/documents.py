"""
VistaSign Documents API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from typing import List, Optional
import os
import hashlib
import uuid
from datetime import datetime
import logging

from app.core.database import get_db
from app.core.config import settings
from app.core.security.auth import get_current_user
from app.models.document import Document, DocumentVersion, DocumentStatus, DocumentType
from app.models.user import User
from app.schemas.document import (
    DocumentCreate, DocumentResponse, DocumentListResponse,
    DocumentUpdate, DocumentVersionResponse
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Query(..., description="Document title"),
    description: Optional[str] = Query(None, description="Document description"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Upload a new document"""
    try:
        # Validate file type
        if file.content_type not in settings.ALLOWED_FILE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type {file.content_type} not allowed"
            )
        
        # Validate file size
        file_content = await file.read()
        if len(file_content) > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds maximum allowed size"
            )
        
        # Create upload directory if it doesn't exist
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        
        # Generate unique filename
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
        
        # Calculate file hash
        file_hash = hashlib.sha256(file_content).hexdigest()
        
        # Determine document type based on MIME type
        document_type = DocumentType.OTHER
        content_type = file.content_type.lower()
        
        if content_type == "application/pdf":
            document_type = DocumentType.PDF
        elif content_type in ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]:
            document_type = DocumentType.WORD
        elif content_type in ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]:
            document_type = DocumentType.EXCEL
        elif content_type in ["application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]:
            document_type = DocumentType.POWERPOINT
        elif content_type.startswith("image/"):
            document_type = DocumentType.IMAGE
        elif content_type in ["text/plain"]:
            document_type = DocumentType.TEXT
        elif content_type == "text/csv":
            document_type = DocumentType.CSV
        elif content_type == "application/rtf":
            document_type = DocumentType.RTF
        elif content_type in ["application/vnd.oasis.opendocument.text", "application/vnd.oasis.opendocument.spreadsheet", "application/vnd.oasis.opendocument.presentation"]:
            document_type = DocumentType.OPEN_DOCUMENT
        
        # Create document record
        document = Document(
            title=title,
            description=description,
            filename=file.filename,
            file_path=file_path,
            file_size=len(file_content),
            file_hash=file_hash,
            document_type=document_type,
            status=DocumentStatus.DRAFT,
            mime_type=file.content_type,
            created_by=current_user["user_id"],
            owner_id=current_user["user_id"]
        )
        
        db.add(document)
        await db.commit()
        await db.refresh(document)
        
        return DocumentResponse(
            id=str(document.id),
            title=document.title,
            description=document.description,
            filename=document.filename,
            file_size=document.file_size,
            document_type=document.document_type.value,
            status=document.status.value,
            mime_type=document.mime_type,
            created_at=document.created_at,
            updated_at=document.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document upload error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document upload failed"
        )

@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    document_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List user's documents"""
    try:
        # Build query
        query = select(Document).where(Document.owner_id == current_user["user_id"])
        
        # Apply filters
        if status:
            query = query.where(Document.status == status)
        if document_type:
            query = query.where(Document.document_type == document_type)
        if search:
            query = query.where(
                or_(
                    Document.title.ilike(f"%{search}%"),
                    Document.description.ilike(f"%{search}%")
                )
            )
        
        # Get total count
        count_query = select(Document).where(Document.owner_id == current_user["user_id"])
        if status:
            count_query = count_query.where(Document.status == status)
        if document_type:
            count_query = count_query.where(Document.document_type == document_type)
        if search:
            count_query = count_query.where(
                or_(
                    Document.title.ilike(f"%{search}%"),
                    Document.description.ilike(f"%{search}%")
                )
            )
        
        total_result = await db.execute(count_query)
        total = len(total_result.scalars().all())
        
        # Get documents with pagination
        result = await db.execute(query.offset(skip).limit(limit))
        documents = result.scalars().all()
        
        return DocumentListResponse(
            documents=[
                DocumentResponse(
                    id=str(doc.id),
                    title=doc.title,
                    description=doc.description,
                    filename=doc.filename,
                    file_size=doc.file_size,
                    document_type=doc.document_type.value,
                    status=doc.status.value,
                    mime_type=doc.mime_type,
                    created_at=doc.created_at,
                    updated_at=doc.updated_at
                ) for doc in documents
            ],
            total=total,
            skip=skip,
            limit=limit,
            has_more=(skip + limit) < total
        )
        
    except Exception as e:
        logger.error(f"List documents error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list documents"
        )

@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get document by ID"""
    try:
        result = await db.execute(
            select(Document).where(
                and_(
                    Document.id == document_id,
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
        
        return DocumentResponse(
            id=str(document.id),
            title=document.title,
            description=document.description,
            filename=document.filename,
            file_size=document.file_size,
            document_type=document.document_type.value,
            status=document.status.value,
            mime_type=document.mime_type,
            created_at=document.created_at,
            updated_at=document.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get document error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get document"
        )

@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: str,
    document_update: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update document"""
    try:
        result = await db.execute(
            select(Document).where(
                and_(
                    Document.id == document_id,
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
        
        # Update fields
        if document_update.title is not None:
            document.title = document_update.title
        if document_update.description is not None:
            document.description = document_update.description
        
        document.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(document)
        
        return DocumentResponse(
            id=str(document.id),
            title=document.title,
            description=document.description,
            filename=document.filename,
            file_size=document.file_size,
            document_type=document.document_type.value,
            status=document.status.value,
            mime_type=document.mime_type,
            created_at=document.created_at,
            updated_at=document.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update document error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update document"
        )

@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete document"""
    try:
        result = await db.execute(
            select(Document).where(
                and_(
                    Document.id == document_id,
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
        
        # Delete file from filesystem
        if os.path.exists(document.file_path):
            os.remove(document.file_path)
        
        # Delete from database
        await db.delete(document)
        await db.commit()
        
        return {"message": "Document deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete document error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document"
        )
