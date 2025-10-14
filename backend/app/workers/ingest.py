"""
Document Ingest Worker for VistaSign
"""

import os
import hashlib
import logging
from pathlib import Path
from typing import Optional
import uuid

from sqlalchemy import select
from app.core.database import get_db_session
from app.models.document import Document, DocumentStatus
from app.services.document_converter import document_converter
# from app.services.antivirus import antivirus_service  # REMOVED - ClamAV
from app.services.storage import storage_service

logger = logging.getLogger(__name__)

async def ingest_document(document_id: str, file_path: str, mime_type: str, title: str):
    """
    Ingest document: scan for viruses, convert to PDF, update database
    
    Args:
        document_id: UUID of the document record
        file_path: Path to the uploaded file
        mime_type: MIME type of the file
        title: Document title
    """
    logger.info(f"Starting document ingest for: {document_id}")
    
    async with get_db_session() as db:
        try:
            # Get document record
            document = await db.get(Document, uuid.UUID(document_id))
            if not document:
                logger.error(f"Document not found: {document_id}")
                return
            
            # Update status to processing
            document.status = DocumentStatus.PENDING_SIGNATURE
            await db.commit()
            
            # Step 1: Antivirus scan - DISABLED (ClamAV removed)
            logger.info(f"Skipping antivirus scan (ClamAV disabled): {file_path}")
            # TODO: Implement alternative antivirus solution or file validation
            
            # Step 2: Calculate file hash
            with open(file_path, 'rb') as f:
                file_content = f.read()
                file_hash = hashlib.sha256(file_content).hexdigest()
            
            # Step 3: Save original file to storage
            file_ext = Path(file_path).suffix
            storage_key, storage_path = storage_service.save_original(file_content, file_ext)
            
            # Step 4: Convert to PDF if needed
            pdf_path = None
            if mime_type != "application/pdf":
                logger.info(f"Converting document to PDF: {file_path}")
                pdf_path = f"{file_path}.pdf"
                
                success = await document_converter.convert_to_pdf(file_path, pdf_path)
                if not success:
                    logger.error(f"Failed to convert document to PDF: {file_path}")
                    document.status = DocumentStatus.REJECTED
                    await db.commit()
                    return
                
                # Validate PDF
                is_valid = await document_converter.validate_pdf(pdf_path)
                if not is_valid:
                    logger.error(f"Generated PDF is invalid: {pdf_path}")
                    document.status = DocumentStatus.REJECTED
                    await db.commit()
                    return
                
                # Get page count
                page_count = await document_converter.get_page_count(pdf_path)
                logger.info(f"PDF conversion successful, pages: {page_count}")
            else:
                # Already a PDF, just copy
                pdf_path = f"{file_path}.pdf"
                import shutil
                shutil.copy2(file_path, pdf_path)
                page_count = await document_converter.get_page_count(pdf_path)
                logger.info(f"PDF file processed, pages: {page_count}")
            
            # Step 5: Save PDF to storage
            with open(pdf_path, 'rb') as f:
                pdf_content = f.read()
            
            pdf_storage_key, pdf_storage_path = storage_service.save_pdf(pdf_content)
            
            # Step 6: Update document record
            document.file_path = storage_path
            document.file_hash = file_hash
            document.mime_type = mime_type
            document.status = DocumentStatus.DRAFT
            document.page_count = page_count
            document.pdf_storage_key = pdf_storage_key
            document.pdf_storage_path = pdf_storage_path
            
            await db.commit()
            
            # Step 7: Cleanup temporary files
            try:
                if pdf_path and os.path.exists(pdf_path):
                    os.remove(pdf_path)
                if file_path and os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as e:
                logger.warning(f"Failed to cleanup temporary files: {e}")
            
            logger.info(f"Document ingest completed successfully: {document_id}")
            
        except Exception as e:
            logger.error(f"Document ingest failed for {document_id}: {e}", exc_info=True)
            
            # Update document status to failed
            try:
                document = await db.get(Document, uuid.UUID(document_id))
                if document:
                    document.status = DocumentStatus.REJECTED
                    await db.commit()
            except Exception as cleanup_error:
                logger.error(f"Failed to update document status after error: {cleanup_error}")
            
            # Cleanup temporary files
            try:
                if file_path and os.path.exists(file_path):
                    os.remove(file_path)
                pdf_path = f"{file_path}.pdf"
                if pdf_path and os.path.exists(pdf_path):
                    os.remove(pdf_path)
            except Exception as cleanup_error:
                logger.warning(f"Failed to cleanup files after error: {cleanup_error}")