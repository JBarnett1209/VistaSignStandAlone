"""
VistaSign Documents API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query, Form, Request
from fastapi.responses import FileResponse
import jwt
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
from app.core.document_converter import DocumentConverter
from app.models.document import Document, DocumentVersion, DocumentStatus, DocumentType
from app.models.user import User
from app.schemas.document import (
    DocumentCreate, DocumentResponse, DocumentListResponse,
    DocumentUpdate, DocumentVersionResponse
)

router = APIRouter()
logger = logging.getLogger(__name__)

def generate_file_access_token(document_id: str, user_id: str) -> str:
    """Generate a signed token for accessing a document file"""
    payload = {
        "sub": user_id,
        "document_id": document_id,
        "exp": datetime.utcnow().timestamp() + 3600  # 1 hour expiry
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

@router.get("/test")
async def test_documents_endpoint():
    """Test endpoint to verify routing works"""
    return {"message": "Documents API is working"}

@router.get("/{document_id}/file")
async def get_document_file(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Serve document file"""
    try:
        logger.info(f"Serving file for document {document_id}, user {current_user.get('id')}")
        
        # Get document from database
        result = await db.execute(
            select(Document).where(
                and_(
                    Document.id == document_id,
                    Document.owner_id == current_user["id"]
                )
            )
        )
        document = result.scalar_one_or_none()
        
        if not document:
            logger.warning(f"Document {document_id} not found for user {current_user.get('id')}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        logger.info(f"Found document: {document.filename}, path: {document.file_path}")
        
        # Check if file exists
        if not os.path.exists(document.file_path):
            logger.error(f"File not found at path: {document.file_path}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document file not found"
            )
        
        logger.info(f"Serving file: {document.file_path}")
        logger.info(f"File exists: {os.path.exists(document.file_path)}")
        logger.info(f"File size: {os.path.getsize(document.file_path) if os.path.exists(document.file_path) else 'N/A'}")
        logger.info(f"MIME type: {document.mime_type}")
        logger.info(f"Filename: {document.filename}")
        
        # Return file
        return FileResponse(
            path=document.file_path,
            filename=document.filename,
            media_type=document.mime_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving document file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to serve document file"
        )

@router.get("/public/{document_id}/file")
async def get_document_file_public(
    document_id: str,
    token: str = Query(..., description="Access token"),
    db: AsyncSession = Depends(get_db)
):
    """Serve document file with public access using signed token"""
    try:
        # Verify the token
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(status_code=403, detail="Invalid token")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=403, detail="Invalid token")
        
        logger.info(f"Public file access for document {document_id}, user {user_id}")
        
        # Get document from database
        result = await db.execute(
            select(Document).where(
                and_(
                    Document.id == document_id,
                    Document.owner_id == user_id
                )
            )
        )
        document = result.scalar_one_or_none()
        
        if not document:
            logger.warning(f"Document {document_id} not found for user {user_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        logger.info(f"Found document: {document.filename}, path: {document.file_path}")
        
        # Check if file exists
        if not os.path.exists(document.file_path):
            logger.error(f"File not found at path: {document.file_path}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document file not found"
            )
        
        logger.info(f"Serving file: {document.file_path}")
        logger.info(f"File exists: {os.path.exists(document.file_path)}")
        logger.info(f"File size: {os.path.getsize(document.file_path) if os.path.exists(document.file_path) else 'N/A'}")
        logger.info(f"MIME type: {document.mime_type}")
        logger.info(f"Filename: {document.filename}")
        
        # Return file
        return FileResponse(
            path=document.file_path,
            filename=document.filename,
            media_type=document.mime_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving document file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to serve document file"
        )

@router.get("/{document_id}/convert")
async def convert_document_to_pdf(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Convert document to PDF for viewing"""
    try:
        logger.info(f"Converting document {document_id} to PDF for user {current_user.get('id')}")
        
        # Get document from database
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
            logger.warning(f"Document {document_id} not found for user {current_user.get('id')}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        # Check if conversion is needed
        if not DocumentConverter.needs_conversion(document.mime_type):
            logger.info(f"Document {document_id} does not need conversion")
            return {
                "converted": False,
                "message": "Document does not need conversion",
                "file_url": f"/api/v1/documents/public/{document.id}/file?token={generate_file_access_token(str(document.id), str(document.owner_id))}"
            }
        
        # Create PDF version
        pdf_filename = f"{os.path.splitext(document.filename)[0]}.pdf"
        pdf_path = os.path.join(settings.UPLOAD_DIR, f"{uuid.uuid4()}.pdf")
        
        # Convert to PDF
        conversion_success = await DocumentConverter.convert_to_pdf(
            document.file_path, pdf_path, document.mime_type, document.title
        )
        
        if conversion_success:
            # Create a new document record for the converted PDF
            converted_document = Document(
                title=f"{document.title} (PDF)",
                description=f"PDF version of {document.title}",
                filename=pdf_filename,
                file_path=pdf_path,
                file_size=os.path.getsize(pdf_path),
                file_hash=hashlib.sha256(open(pdf_path, 'rb').read()).hexdigest(),
                document_type=DocumentType.PDF,
                status=DocumentStatus.DRAFT,
                mime_type="application/pdf",
                created_by=current_user["user_id"],
                owner_id=current_user["user_id"]
            )
            
            db.add(converted_document)
            await db.commit()
            await db.refresh(converted_document)
            
            logger.info(f"Document converted successfully: {pdf_filename}")
            
            return {
                "converted": True,
                "message": "Document converted to PDF successfully",
                "document_id": str(converted_document.id),
                "file_url": f"/api/v1/documents/public/{converted_document.id}/file?token={generate_file_access_token(str(converted_document.id), str(converted_document.owner_id))}"
            }
        else:
            logger.error(f"Document conversion failed for {document_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Document conversion failed"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document conversion error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to convert document"
        )

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(..., description="Document title"),
    description: Optional[str] = Form(None, description="Document description"),
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
        
        # Save original file
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
        
        # Calculate file hash
        file_hash = hashlib.sha256(file_content).hexdigest()
        
        # Determine document type and convert to PDF if needed
        document_type = DocumentType.OTHER
        content_type = file.content_type.lower()
        final_file_path = file_path
        final_mime_type = file.content_type
        final_filename = file.filename
        
        if content_type == "application/pdf":
            document_type = DocumentType.PDF
        else:
            # Check if conversion is needed
            if DocumentConverter.needs_conversion(content_type):
                logger.info(f"Converting document to PDF: {file.filename}")
                
                # Generate PDF filename
                pdf_filename = f"{uuid.uuid4()}.pdf"
                pdf_path = os.path.join(settings.UPLOAD_DIR, pdf_filename)
                
                # Convert to PDF
                logger.info(f"Attempting to convert {file.filename} from {content_type} to PDF")
                conversion_success = await DocumentConverter.convert_to_pdf(
                    file_path, pdf_path, content_type, title
                )
                
                if conversion_success:
                    # Use the converted PDF
                    final_file_path = pdf_path
                    final_mime_type = "application/pdf"
                    final_filename = f"{os.path.splitext(file.filename)[0]}.pdf"
                    document_type = DocumentType.PDF
                    logger.info(f"Document converted successfully: {final_filename} -> {final_mime_type}")
                    logger.info(f"Converted file exists: {os.path.exists(final_file_path)}")
                    logger.info(f"Converted file size: {os.path.getsize(final_file_path) if os.path.exists(final_file_path) else 'N/A'}")
                else:
                    # Conversion failed - raise an error with details
                    logger.error(f"Conversion failed for {file.filename}")
                    logger.error(f"Input file exists: {os.path.exists(file_path)}")
                    logger.error(f"Input file size: {os.path.getsize(file_path) if os.path.exists(file_path) else 'N/A'}")
                    logger.error(f"Output file exists: {os.path.exists(pdf_path)}")
                    logger.error(f"Output file size: {os.path.getsize(pdf_path) if os.path.exists(pdf_path) else 'N/A'}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Document conversion failed for {file.filename}. Please check server logs for details."
                    )
            else:
                # No conversion needed, determine type
                if content_type in ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]:
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
        
        # Get final file size (for converted files)
        final_file_size = len(file_content)
        if final_file_path != file_path:
            final_file_size = os.path.getsize(final_file_path)
        
        # Create document record
        document = Document(
            title=title,
            description=description,
            filename=final_filename,
            file_path=final_file_path,
            file_size=final_file_size,
            file_hash=file_hash,
            document_type=document_type,
            status=DocumentStatus.DRAFT,
            mime_type=final_mime_type,
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
            file_url=f"/api/v1/documents/public/{document.id}/file?token={generate_file_access_token(str(document.id), str(document.owner_id))}",
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
        
        # Debug: Log document details
        for doc in documents:
            logger.info(f"Document {doc.id}: filename={doc.filename}, mime_type={doc.mime_type}, document_type={doc.document_type.value}")
        
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
            file_url=f"/api/v1/documents/public/{doc.id}/file?token={generate_file_access_token(str(doc.id), str(doc.owner_id))}",
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
            file_url=f"/api/v1/documents/public/{document.id}/file?token={generate_file_access_token(str(document.id), str(document.owner_id))}",
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
        if document_update.fields is not None:
            document.fields = document_update.fields
        if document_update.status is not None:
            # Convert string status to enum
            try:
                document.status = DocumentStatus(document_update.status)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status: {document_update.status}"
                )
        
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
            file_url=f"/api/v1/documents/public/{document.id}/file?token={generate_file_access_token(str(document.id), str(document.owner_id))}",
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
