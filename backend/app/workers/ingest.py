"""
Ingest worker: scan uploads with ClamAV, convert to PDF with LibreOffice/ImageMagick,
and update metadata (page count, sizes). This module provides stubs ready for RQ.
"""

import os
import logging
import subprocess
from typing import Optional

import fitz  # PyMuPDF

from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.document import Document, DocumentType, DocumentStatus
from app.core.document_converter import DocumentConverter

logger = logging.getLogger(__name__)


def clamav_scan(path: str) -> bool:
    """Return True if file is clean (stub: attempts clamscan if available)."""
    try:
        result = subprocess.run(["clamscan", path], capture_output=True, text=True)
        logger.info(result.stdout)
        return result.returncode == 0
    except Exception as e:
        logger.warning(f"ClamAV scan skipped/failed: {e}")
        return True  # allow in dev if scanner not present


async def convert_to_pdf_if_needed(input_path: str, mime_type: str, title: str) -> Optional[str]:
    if not DocumentConverter.needs_conversion(mime_type):
        return input_path if mime_type == "application/pdf" else None
    pdf_path = os.path.join(settings.UPLOAD_DIR, f"{os.path.basename(input_path)}.pdf")
    ok = await DocumentConverter.convert_to_pdf(input_path, pdf_path, mime_type, title)
    return pdf_path if ok else None


def get_pdf_page_count(pdf_path: str) -> int:
    try:
        with fitz.open(pdf_path) as doc:
            return doc.page_count
    except Exception:
        return 0


def ingest_document(document_id: str, path: str, mime_type: str, title: str) -> bool:
    """RQ job: scan, convert, update DB metadata."""
    if not clamav_scan(path):
        logger.error("ClamAV scan failed")
        return False
    # convert if necessary (run loop for async converter)
    import asyncio
    async def run():
        pdf_path = await convert_to_pdf_if_needed(path, mime_type, title)
        final_path = pdf_path or path
        pages = get_pdf_page_count(final_path) if (pdf_path or mime_type == 'application/pdf') else 0
        async with AsyncSessionLocal() as db:  # type: AsyncSession
            res = await db.execute(select(Document).where(Document.id == document_id))
            doc = res.scalar_one_or_none()
            if not doc:
                return False
            doc.file_path = final_path
            doc.document_type = DocumentType.PDF if final_path.endswith('.pdf') else doc.document_type
            doc.mime_type = 'application/pdf' if final_path.endswith('.pdf') else mime_type
            doc.page_count = pages
            doc.status = DocumentStatus.DRAFT
            await db.commit()
        return True
    return asyncio.run(run())


