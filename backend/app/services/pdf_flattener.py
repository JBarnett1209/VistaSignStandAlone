"""
PDF Flattening Service for VistaSign
"""

import logging
from typing import List, Dict, Any, Optional
import uuid
from pathlib import Path

from app.models.envelope import Field, FieldValue, Recipient
from app.models.document import Document

logger = logging.getLogger(__name__)

class PDFFlattener:
    """PDF flattening service using PyMuPDF"""
    
    def __init__(self):
        self.temp_dir = Path("/tmp/vistasign")
        self.temp_dir.mkdir(exist_ok=True)
    
    async def flatten_envelope(self, envelope, document: Document, field_values: List[FieldValue]) -> bytes:
        """
        Flatten envelope fields into PDF
        
        Args:
            envelope: Envelope object
            document: Document object
            field_values: List of FieldValue objects
            
        Returns:
            bytes: Flattened PDF content
        """
        try:
            import fitz  # PyMuPDF
            
            # Load the original PDF
            pdf_doc = fitz.open(document.file_path)
            
            # Create a mapping of field values by field ID
            field_value_map = {fv.field_id: fv for fv in field_values}
            
            # Process each field
            for field in envelope.fields:
                if field.id not in field_value_map:
                    continue
                
                field_value = field_value_map[field.id]
                if not field_value.value:
                    continue
                
                # Get the page
                if field.page_index >= len(pdf_doc):
                    logger.warning(f"Field page index {field.page_index} out of range")
                    continue
                
                page = pdf_doc[field.page_index]
                
                # Flatten the field based on its type
                await self._flatten_field(page, field, field_value)
            
            # Save the flattened PDF
            flattened_pdf_bytes = pdf_doc.write()
            pdf_doc.close()
            
            logger.info(f"Successfully flattened envelope: {envelope.id}")
            return flattened_pdf_bytes
            
        except Exception as e:
            logger.error(f"Failed to flatten envelope {envelope.id}: {e}", exc_info=True)
            raise
    
    async def _flatten_field(self, page, field: Field, field_value: FieldValue):
        """Flatten a single field onto the PDF page"""
        try:
            import fitz
            
            # Get field rectangle
            rect = fitz.Rect(
                field.rect_pts["x"],
                field.rect_pts["y"],
                field.rect_pts["x"] + field.rect_pts["w"],
                field.rect_pts["y"] + field.rect_pts["h"]
            )
            
            # Handle different field types
            if field.type.value == "signature":
                await self._flatten_signature(page, rect, field_value)
            elif field.type.value == "initials":
                await self._flatten_initials(page, rect, field_value)
            elif field.type.value == "text":
                await self._flatten_text(page, rect, field_value)
            elif field.type.value == "date_signed":
                await self._flatten_date(page, rect, field_value)
            elif field.type.value == "full_name":
                await self._flatten_full_name(page, rect, field_value)
            elif field.type.value == "email":
                await self._flatten_email(page, rect, field_value)
            elif field.type.value == "company":
                await self._flatten_company(page, rect, field_value)
            elif field.type.value == "title":
                await self._flatten_title(page, rect, field_value)
            elif field.type.value == "checkbox":
                await self._flatten_checkbox(page, rect, field_value)
            else:
                # Default to text
                await self._flatten_text(page, rect, field_value)
                
        except Exception as e:
            logger.error(f"Failed to flatten field {field.id}: {e}")
            raise
    
    async def _flatten_signature(self, page, rect, field_value: FieldValue):
        """Flatten signature field"""
        try:
            import fitz
            
            # If signature is an image (base64), embed it
            if field_value.value.startswith('data:image/'):
                # Extract base64 image data
                import base64
                header, data = field_value.value.split(',', 1)
                image_data = base64.b64decode(data)
                
                # Create image from bytes
                img = fitz.Pixmap(image_data)
                
                # Insert image into PDF
                page.insert_image(rect, pixmap=img)
                
            else:
                # Text signature - draw as text
                page.insert_text(
                    (rect.x0 + rect.x1) / 2,
                    (rect.y0 + rect.y1) / 2,
                    field_value.value,
                    fontsize=12,
                    color=(0, 0, 0),
                    align=1  # Center alignment
                )
                
        except Exception as e:
            logger.error(f"Failed to flatten signature: {e}")
            raise
    
    async def _flatten_initials(self, page, rect, field_value: FieldValue):
        """Flatten initials field"""
        try:
            import fitz
            
            page.insert_text(
                (rect.x0 + rect.x1) / 2,
                (rect.y0 + rect.y1) / 2,
                field_value.value,
                fontsize=14,
                color=(0, 0, 0),
                align=1  # Center alignment
            )
            
        except Exception as e:
            logger.error(f"Failed to flatten initials: {e}")
            raise
    
    async def _flatten_text(self, page, rect, field_value: FieldValue):
        """Flatten text field"""
        try:
            import fitz
            
            # Get font size from tab settings or use default
            font_size = 10
            if field_value.field.tab_settings and "size" in field_value.field.tab_settings:
                font_size = field_value.field.tab_settings["size"]
            
            page.insert_text(
                rect.x0 + 2,  # Small margin from left
                rect.y1 - 2,  # Small margin from bottom
                field_value.value,
                fontsize=font_size,
                color=(0, 0, 0)
            )
            
        except Exception as e:
            logger.error(f"Failed to flatten text: {e}")
            raise
    
    async def _flatten_date(self, page, rect, field_value: FieldValue):
        """Flatten date field"""
        await self._flatten_text(page, rect, field_value)
    
    async def _flatten_full_name(self, page, rect, field_value: FieldValue):
        """Flatten full name field"""
        await self._flatten_text(page, rect, field_value)
    
    async def _flatten_email(self, page, rect, field_value: FieldValue):
        """Flatten email field"""
        await self._flatten_text(page, rect, field_value)
    
    async def _flatten_company(self, page, rect, field_value: FieldValue):
        """Flatten company field"""
        await self._flatten_text(page, rect, field_value)
    
    async def _flatten_title(self, page, rect, field_value: FieldValue):
        """Flatten title field"""
        await self._flatten_text(page, rect, field_value)
    
    async def _flatten_checkbox(self, page, rect, field_value: FieldValue):
        """Flatten checkbox field"""
        try:
            import fitz
            
            if field_value.value and field_value.value.lower() in ['true', '1', 'yes', 'checked']:
                # Draw a checkmark
                page.draw_line(
                    fitz.Point(rect.x0 + 2, rect.y0 + 2),
                    fitz.Point(rect.x1 - 2, rect.y1 - 2),
                    color=(0, 0, 0),
                    width=2
                )
                page.draw_line(
                    fitz.Point(rect.x1 - 2, rect.y0 + 2),
                    fitz.Point(rect.x0 + 2, rect.y1 - 2),
                    color=(0, 0, 0),
                    width=2
                )
            
        except Exception as e:
            logger.error(f"Failed to flatten checkbox: {e}")
            raise
    
    async def add_certificate_page(self, pdf_bytes: bytes, envelope, audit_events: List) -> bytes:
        """Add certificate of completion page to PDF"""
        try:
            import fitz
            from reportlab.pdfgen import canvas
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.utils import ImageReader
            import io
            
            # Load the flattened PDF
            pdf_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            # Create certificate page
            cert_buffer = io.BytesIO()
            c = canvas.Canvas(cert_buffer, pagesize=letter)
            width, height = letter
            
            # Title
            c.setFont("Helvetica-Bold", 24)
            c.drawString(50, height - 100, "Certificate of Completion")
            
            # Document information
            c.setFont("Helvetica", 12)
            y_pos = height - 150
            
            c.drawString(50, y_pos, f"Document: {envelope.document.title}")
            y_pos -= 25
            
            c.drawString(50, y_pos, f"Envelope ID: {envelope.id}")
            y_pos -= 25
            
            c.drawString(50, y_pos, f"Subject: {envelope.subject}")
            y_pos -= 25
            
            c.drawString(50, y_pos, f"Completed: {envelope.completed_at}")
            y_pos -= 50
            
            # Recipients
            c.setFont("Helvetica-Bold", 14)
            c.drawString(50, y_pos, "Recipients:")
            y_pos -= 30
            
            c.setFont("Helvetica", 12)
            for recipient in envelope.recipients:
                c.drawString(70, y_pos, f"• {recipient.name} ({recipient.email}) - {recipient.status.value}")
                y_pos -= 20
            
            y_pos -= 30
            
            # Audit trail
            c.setFont("Helvetica-Bold", 14)
            c.drawString(50, y_pos, "Audit Trail:")
            y_pos -= 30
            
            c.setFont("Helvetica", 10)
            for event in audit_events[-10:]:  # Last 10 events
                c.drawString(70, y_pos, f"{event.occurred_at}: {event.event}")
                y_pos -= 15
                if y_pos < 100:  # Start new page if needed
                    c.showPage()
                    y_pos = height - 50
            
            c.save()
            
            # Add certificate page to PDF
            cert_pdf = fitz.open(stream=cert_buffer.getvalue(), filetype="pdf")
            pdf_doc.insert_pdf(cert_pdf)
            cert_pdf.close()
            
            # Return final PDF
            final_pdf_bytes = pdf_doc.write()
            pdf_doc.close()
            
            logger.info(f"Added certificate page to envelope: {envelope.id}")
            return final_pdf_bytes
            
        except Exception as e:
            logger.error(f"Failed to add certificate page: {e}", exc_info=True)
            raise

# Create singleton instance
pdf_flattener = PDFFlattener()
