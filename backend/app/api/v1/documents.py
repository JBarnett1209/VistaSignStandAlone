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
from app.core.logging_service import get_logger
from app.core.document_converter import DocumentConverter
from app.models.document import Document, DocumentVersion, DocumentStatus, DocumentType
from app.models.user import User
from app.schemas.document import (
    DocumentCreate, DocumentResponse, DocumentListResponse,
    DocumentUpdate, DocumentVersionResponse
)

router = APIRouter()
logger = logging.getLogger(__name__)
comprehensive_logger = get_logger(__name__)

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

@router.post("/upload-debug")
async def upload_debug(
    request: Request
):
    """Debug endpoint to see what's being received"""
    try:
        logger.info(f"Debug upload request received")
        logger.info(f"Content-Type: {request.headers.get('content-type')}")
        logger.info(f"Content-Length: {request.headers.get('content-length')}")
        
        # Try to read the raw body
        body = await request.body()
        logger.info(f"Body length: {len(body)}")
        logger.info(f"Body preview: {body[:200] if body else 'Empty'}")
        
        return {
            "message": "Debug info logged",
            "content_type": request.headers.get('content-type'),
            "content_length": request.headers.get('content-length'),
            "body_length": len(body)
        }
    except Exception as e:
        logger.error(f"Debug upload error: {str(e)}")
        return {"error": str(e)}

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
            token_subject = payload.get("sub")
            token_type = payload.get("type", "user")
            if not token_subject:
                raise HTTPException(status_code=403, detail="Invalid token")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=403, detail="Invalid token")
        
        logger.info(f"Public file access for document {document_id}, token subject {token_subject}, type {token_type}")
        
        # Get document from database
        if token_type == "document_access" and token_subject == document_id:
            # Document-based token (for workflow signing)
            result = await db.execute(
                select(Document).where(Document.id == document_id)
            )
            document = result.scalar_one_or_none()
        else:
            # User-based token (for regular user access)
            result = await db.execute(
                select(Document).where(
                    and_(
                        Document.id == document_id,
                        Document.owner_id == token_subject
                    )
                )
            )
            document = result.scalar_one_or_none()
        
        if not document:
            logger.warning(f"Document {document_id} not found for token subject {token_subject}")
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
    title: Optional[str] = Form(None, description="Document title"),
    description: Optional[str] = Form(None, description="Document description"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Upload a new document"""
    try:
        comprehensive_logger.info(f"Upload request received - User: {current_user.get('user_id')}", extra_data={
            'user_id': current_user.get('user_id'),
            'user_email': current_user.get('email'),
            'file_filename': file.filename if file else None,
            'file_content_type': file.content_type if file else None,
            'file_size': file.size if file else None,
            'title': title,
            'description': description
        })
        
        logger.info(f"Upload request received - User: {current_user.get('user_id')}")
        logger.info(f"File: {file.filename if file else 'None'}, Content-Type: {file.content_type if file else 'None'}")
        logger.info(f"Title: '{title}', Description: '{description}'")
        
        # Validate title - use filename if title is not provided
        if not title or title.strip() == "":
            title = file.filename if file and file.filename else "Untitled Document"
            logger.info(f"Title was empty, using filename: '{title}'")
        
        # Validate file type
        logger.info(f"File content type: {file.content_type}")
        logger.info(f"Allowed file types: {settings.ALLOWED_FILE_TYPES}")
        if file.content_type not in settings.ALLOWED_FILE_TYPES:
            logger.warning(f"File type {file.content_type} not in allowed types")
            # Temporarily allow all file types for debugging
            # raise HTTPException(
            #     status_code=status.HTTP_400_BAD_REQUEST,
            #     detail=f"File type {file.content_type} not allowed"
            # )
        
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
                
                # Attempt conversion with better error handling
                try:
                    conversion_success = await DocumentConverter.convert_to_pdf(
                        file_path, pdf_path, content_type, title
                    )
                    
                    if conversion_success and os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 0:
                        logger.info(f"Document conversion successful: {pdf_path}")
                        final_file_path = pdf_path
                        final_mime_type = "application/pdf"
                        final_filename = f"{os.path.splitext(file.filename)[0]}.pdf"
                        document_type = DocumentType.PDF
                    else:
                        logger.warning(f"Document conversion failed or produced empty file: {file.filename}")
                        # Keep original file but log the issue
                        logger.info(f"Keeping original file: {file_path}")
                        
                except Exception as conv_error:
                    logger.error(f"Document conversion failed with exception: {str(conv_error)}")
                    logger.info(f"Keeping original file: {file_path}")
                    # Continue with original file
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
            fields=document.fields,
            created_at=document.created_at,
            updated_at=document.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document upload error: {str(e)}")
        import traceback
        logger.error(f"Upload traceback: {traceback.format_exc()}")
        
        # Provide more specific error messages
        error_detail = "Document upload failed"
        if "conversion" in str(e).lower():
            error_detail = "Document conversion failed. Please try uploading a PDF file or contact support."
        elif "size" in str(e).lower():
            error_detail = "File size exceeds the maximum allowed limit of 100MB."
        elif "type" in str(e).lower():
            error_detail = "File type not supported. Please upload a supported document format."
        elif "permission" in str(e).lower() or "access" in str(e).lower():
            error_detail = "File access error. Please check file permissions and try again."
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
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
            fields=document.fields,
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
        logger.info(f"Update document request - ID: {document_id}, User: {current_user.get('user_id')}")
        logger.info(f"Update data: {document_update.dict()}")
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
            logger.error(f"Document not found - ID: {document_id}, User: {current_user.get('user_id')}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        logger.info(f"Found document: {document.title}, Current fields: {document.fields}")
        
        # Update fields
        logger.info("Starting field updates...")
        if document_update.title is not None:
            logger.info(f"Updating title: {document_update.title}")
            document.title = document_update.title
        if document_update.description is not None:
            logger.info(f"Updating description: {document_update.description}")
            document.description = document_update.description
        if document_update.fields is not None:
            logger.info(f"Updating fields: {document_update.fields}")
            document.fields = document_update.fields
        if document_update.status is not None:
            logger.info(f"Updating status: {document_update.status}")
            # Convert string status to enum
            try:
                document.status = DocumentStatus(document_update.status)
            except ValueError as e:
                logger.error(f"Invalid status error: {e}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status: {document_update.status}"
                )
        
        logger.info("Committing changes to database...")
        document.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(document)
        logger.info(f"Document updated successfully. New fields: {document.fields}")
        
        response = DocumentResponse(
            id=str(document.id),
            title=document.title,
            description=document.description,
            filename=document.filename,
            file_size=document.file_size,
            document_type=document.document_type.value,
            status=document.status.value,
            mime_type=document.mime_type,
            file_url=f"/api/v1/documents/public/{document.id}/file?token={generate_file_access_token(str(document.id), str(document.owner_id))}",
            fields=document.fields,
            created_at=document.created_at,
            updated_at=document.updated_at
        )
        logger.info(f"Returning response: {response.dict()}")
        return response
        
    except HTTPException as e:
        logger.error(f"HTTP Exception in update document: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"Update document error: {str(e)}", exc_info=True)
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
        
        # First, handle related workflows and signatures
        from app.models.workflow import Workflow
        from app.models.signature import Signature
        
        # Delete or update workflows that reference this document
        workflows_result = await db.execute(
            select(Workflow).where(Workflow.document_id == document_id)
        )
        workflows = workflows_result.scalars().all()
        
        for workflow in workflows:
            logger.info(f"Deleting workflow {workflow.id} that references document {document_id}")
            await db.delete(workflow)
        
        # Delete signatures that reference this document
        signatures_result = await db.execute(
            select(Signature).where(Signature.document_id == document_id)
        )
        signatures = signatures_result.scalars().all()
        
        for signature in signatures:
            logger.info(f"Deleting signature {signature.id} that references document {document_id}")
            await db.delete(signature)
        
        # Delete file from filesystem
        if os.path.exists(document.file_path):
            os.remove(document.file_path)
            logger.info(f"Deleted file: {document.file_path}")
        
        # Delete document from database
        await db.delete(document)
        await db.commit()
        
        logger.info(f"Successfully deleted document {document_id}")
        return {"message": "Document deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete document error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document"
        )

@router.post("/{document_id}/convert")
async def convert_document_to_pdf(
    document_id: str,
    conversion_request: dict,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Convert document to PDF for viewing"""
    try:
        # Get document
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
        
        # Check if file exists
        if not document.file_path or not os.path.exists(document.file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document file not found"
            )
        
        # Check if conversion is needed
        mime_type = conversion_request.get('mime_type', document.mime_type)
        title = conversion_request.get('title', document.title or document.filename)
        
        if not DocumentConverter.needs_conversion(mime_type):
            # Document doesn't need conversion, return original
            return {
                "success": True,
                "converted": False,
                "file_url": document.file_url,
                "message": "Document does not require conversion"
            }
        
        # Create converted file path
        import tempfile
        import shutil
        from pathlib import Path
        
        # Create a unique filename for the converted PDF
        converted_filename = f"{uuid.uuid4()}.pdf"
        converted_path = os.path.join(tempfile.gettempdir(), converted_filename)
        
        # Convert document
        success = await DocumentConverter.convert_to_pdf(
            document.file_path,
            converted_path,
            mime_type,
            title
        )
        
        if success and os.path.exists(converted_path):
            # Move converted file to permanent storage
            upload_dir = getattr(settings, 'UPLOAD_DIR', 'uploads')
            permanent_path = os.path.join(upload_dir, 'converted', converted_filename)
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(permanent_path), exist_ok=True)
            
            # Move file
            shutil.move(converted_path, permanent_path)
            
            # Create URL for the converted file
            converted_url = f"/uploads/converted/{converted_filename}"
            
            return {
                "success": True,
                "converted": True,
                "file_url": converted_url,
                "converted_path": permanent_path,
                "message": "Document converted successfully"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Document conversion failed"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error converting document: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to convert document"
        )