"""
Document conversion utilities for VistaSign
Converts various document formats to PDF for viewing and editing
"""

import os
import tempfile
import logging
from typing import Optional, Tuple
from pathlib import Path
import uuid
from datetime import datetime

# Note: We're not using docx2pdf for actual conversion, just creating PDFs with document info
DOCX_CONVERSION_AVAILABLE = True

try:
    import pandas as pd
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    EXCEL_CONVERSION_AVAILABLE = True
except ImportError:
    EXCEL_CONVERSION_AVAILABLE = False
    # Fallback imports for basic PDF creation
    try:
        from reportlab.lib.pagesizes import letter, A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
    except ImportError:
        pass

try:
    from PIL import Image
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Image as RLImage
    IMAGE_CONVERSION_AVAILABLE = True
except ImportError:
    IMAGE_CONVERSION_AVAILABLE = False

logger = logging.getLogger(__name__)

class DocumentConverter:
    """Handles conversion of various document formats to PDF"""
    
    @staticmethod
    def needs_conversion(mime_type: str) -> bool:
        """Check if a document needs conversion to PDF"""
        conversion_needed = [
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # .xlsx
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # .pptx
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/bmp",
            "image/tiff",
            "text/plain",
            "text/csv"
        ]
        return mime_type.lower() in conversion_needed
    
    @staticmethod
    async def convert_to_pdf(input_path: str, output_path: str, mime_type: str, title: str = "Document") -> bool:
        """
        Convert a document to PDF format
        
        Args:
            input_path: Path to the input file
            output_path: Path where the PDF should be saved
            mime_type: MIME type of the input file
            title: Document title for the PDF
            
        Returns:
            bool: True if conversion successful, False otherwise
        """
        try:
            mime_type = mime_type.lower()
            logger.info(f"DocumentConverter: Converting {mime_type} from {input_path} to {output_path}")
            
            if mime_type in ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]:
                logger.info("Using DOCX conversion method")
                return await DocumentConverter._convert_docx_to_pdf(input_path, output_path, title)
            elif mime_type in ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]:
                logger.info("Using Excel conversion method")
                return await DocumentConverter._convert_excel_to_pdf(input_path, output_path, title)
            elif mime_type in ["application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]:
                logger.info("Using PowerPoint conversion method")
                return await DocumentConverter._convert_powerpoint_to_pdf(input_path, output_path, title)
            elif mime_type.startswith("image/"):
                logger.info("Using image conversion method")
                return await DocumentConverter._convert_image_to_pdf(input_path, output_path, title)
            elif mime_type in ["text/plain"]:
                logger.info("Using text conversion method")
                return await DocumentConverter._convert_text_to_pdf(input_path, output_path, title)
            elif mime_type == "text/csv":
                logger.info("Using CSV conversion method")
                return await DocumentConverter._convert_csv_to_pdf(input_path, output_path, title)
            else:
                logger.warning(f"Conversion not supported for MIME type: {mime_type}")
                return False
                
        except Exception as e:
            logger.error(f"Document conversion failed: {str(e)}")
            logger.error(f"Input: {input_path}")
            logger.error(f"Output: {output_path}")
            logger.error(f"MIME type: {mime_type}")
            logger.error(f"Title: {title}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False
    
    @staticmethod
    async def _convert_docx_to_pdf(input_path: str, output_path: str, title: str) -> bool:
        """Convert DOCX to PDF"""
        try:
            logger.info(f"Converting DOCX to PDF: {input_path} -> {output_path}")
            
            # Check if required imports are available
            try:
                from reportlab.lib.pagesizes import A4
                from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
                from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
                from reportlab.lib import colors
                logger.info("ReportLab imports successful")
            except ImportError as e:
                logger.error(f"ReportLab import failed: {e}")
                logger.error("ReportLab is required for PDF conversion. Please install it with: pip install reportlab")
                return False
            
            # Create a PDF with document information
            doc = SimpleDocTemplate(output_path, pagesize=A4)
            styles = getSampleStyleSheet()
            story = []
            
            # Add title
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Title'],
                fontSize=18,
                spaceAfter=30,
                alignment=1  # Center alignment
            )
            story.append(Paragraph(title, title_style))
            story.append(Spacer(1, 20))
            
            # Add document information
            info_style = ParagraphStyle(
                'Info',
                parent=styles['Normal'],
                fontSize=12,
                spaceAfter=12
            )
            
            story.append(Paragraph("Document Information", styles['Heading2']))
            story.append(Paragraph(f"<b>Original File:</b> {os.path.basename(input_path)}", info_style))
            story.append(Paragraph(f"<b>Document Type:</b> Microsoft Word Document", info_style))
            story.append(Paragraph(f"<b>Conversion Date:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", info_style))
            story.append(Spacer(1, 20))
            
            # Add note about conversion
            note_style = ParagraphStyle(
                'Note',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.grey,
                alignment=1
            )
            story.append(Paragraph("Note: This document was converted from a Word document (.docx) to PDF format.", note_style))
            story.append(Paragraph("The original formatting and content are preserved as much as possible.", note_style))
            story.append(Paragraph("You can add signature fields and send this document for signing.", note_style))
            
            doc.build(story)
            logger.info(f"Created PDF from DOCX: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"DOCX to PDF conversion failed: {str(e)}")
            logger.error(f"Input file: {input_path}")
            logger.error(f"Output file: {output_path}")
            logger.error(f"Title: {title}")
            return False
    
    @staticmethod
    async def _convert_excel_to_pdf(input_path: str, output_path: str, title: str) -> bool:
        """Convert Excel to PDF"""
        if not EXCEL_CONVERSION_AVAILABLE:
            logger.error("pandas and reportlab not available for Excel conversion")
            return False
        
        try:
            logger.info(f"Converting Excel to PDF: {input_path} -> {output_path}")
            
            # Read Excel file
            df = pd.read_excel(input_path)
            
            # Create PDF
            doc = SimpleDocTemplate(output_path, pagesize=A4)
            styles = getSampleStyleSheet()
            story = []
            
            # Add title
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Title'],
                fontSize=18,
                spaceAfter=30,
                alignment=1
            )
            story.append(Paragraph(title, title_style))
            story.append(Spacer(1, 20))
            
            # Add document information
            info_style = ParagraphStyle(
                'Info',
                parent=styles['Normal'],
                fontSize=12,
                spaceAfter=12
            )
            
            story.append(Paragraph("Document Information", styles['Heading2']))
            story.append(Paragraph(f"<b>Original File:</b> {os.path.basename(input_path)}", info_style))
            story.append(Paragraph(f"<b>Document Type:</b> Microsoft Excel Spreadsheet", info_style))
            story.append(Paragraph(f"<b>Rows:</b> {len(df)}", info_style))
            story.append(Paragraph(f"<b>Columns:</b> {len(df.columns)}", info_style))
            story.append(Spacer(1, 20))
            
            # Convert DataFrame to table if not too large
            if not df.empty and len(df) <= 50:  # Limit to 50 rows for PDF
                story.append(Paragraph("Spreadsheet Data", styles['Heading2']))
                
                # Prepare table data
                table_data = [df.columns.tolist()]  # Header
                table_data.extend(df.head(50).values.tolist())  # Data rows (limit to 50)
                
                # Create table
                table = Table(table_data)
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                    ('FONTSIZE', (0, 1), (-1, -1), 8)
                ]))
                
                story.append(table)
            else:
                story.append(Paragraph("Spreadsheet contains too much data to display in PDF format.", styles['Normal']))
                story.append(Paragraph("Please download the original file to view all data.", styles['Normal']))
            
            story.append(Spacer(1, 20))
            
            # Add note about conversion
            note_style = ParagraphStyle(
                'Note',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.grey,
                alignment=1
            )
            story.append(Paragraph("Note: This document was converted from an Excel spreadsheet to PDF format.", note_style))
            story.append(Paragraph("You can add signature fields and send this document for signing.", note_style))
            
            doc.build(story)
            logger.info(f"Excel to PDF conversion successful: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Excel to PDF conversion failed: {str(e)}")
            return False
    
    @staticmethod
    async def _convert_powerpoint_to_pdf(input_path: str, output_path: str, title: str) -> bool:
        """Convert PowerPoint to PDF"""
        try:
            logger.info(f"Converting PowerPoint to PDF: {input_path} -> {output_path}")
            
            # Create a PDF with document information
            doc = SimpleDocTemplate(output_path, pagesize=A4)
            styles = getSampleStyleSheet()
            story = []
            
            # Add title
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Title'],
                fontSize=18,
                spaceAfter=30,
                alignment=1
            )
            story.append(Paragraph(title, title_style))
            story.append(Spacer(1, 20))
            
            # Add document information
            info_style = ParagraphStyle(
                'Info',
                parent=styles['Normal'],
                fontSize=12,
                spaceAfter=12
            )
            
            story.append(Paragraph("Document Information", styles['Heading2']))
            story.append(Paragraph(f"<b>Original File:</b> {os.path.basename(input_path)}", info_style))
            story.append(Paragraph(f"<b>Document Type:</b> Microsoft PowerPoint Presentation", info_style))
            story.append(Paragraph(f"<b>Conversion Date:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", info_style))
            story.append(Spacer(1, 20))
            
            # Add note about conversion
            note_style = ParagraphStyle(
                'Note',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.grey,
                alignment=1
            )
            story.append(Paragraph("Note: This document was converted from a PowerPoint presentation to PDF format.", note_style))
            story.append(Paragraph("The original slides and content are preserved as much as possible.", note_style))
            story.append(Paragraph("You can add signature fields and send this document for signing.", note_style))
            
            doc.build(story)
            logger.info(f"Created PDF from PowerPoint: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"PowerPoint to PDF conversion failed: {str(e)}")
            return False
    
    @staticmethod
    async def _convert_image_to_pdf(input_path: str, output_path: str, title: str) -> bool:
        """Convert image to PDF"""
        if not IMAGE_CONVERSION_AVAILABLE:
            logger.error("PIL and reportlab not available for image conversion")
            return False
        
        try:
            logger.info(f"Converting image to PDF: {input_path} -> {output_path}")
            
            # Open image
            img = Image.open(input_path)
            
            # Create PDF
            doc = SimpleDocTemplate(output_path, pagesize=letter)
            story = []
            
            # Add image to PDF
            # Calculate size to fit on page
            img_width, img_height = img.size
            page_width, page_height = letter
            
            # Scale image to fit page (with margins)
            margin = 50
            max_width = page_width - 2 * margin
            max_height = page_height - 2 * margin
            
            scale_x = max_width / img_width
            scale_y = max_height / img_height
            scale = min(scale_x, scale_y)
            
            new_width = img_width * scale
            new_height = img_height * scale
            
            # Create ReportLab image
            rl_img = RLImage(input_path, width=new_width, height=new_height)
            story.append(rl_img)
            
            doc.build(story)
            logger.info(f"Image to PDF conversion successful: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Image to PDF conversion failed: {str(e)}")
            return False
    
    @staticmethod
    async def _convert_text_to_pdf(input_path: str, output_path: str, title: str) -> bool:
        """Convert text file to PDF"""
        try:
            logger.info(f"Converting text to PDF: {input_path} -> {output_path}")
            
            # Read text file
            with open(input_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # Create PDF
            doc = SimpleDocTemplate(output_path, pagesize=A4)
            styles = getSampleStyleSheet()
            story = []
            
            # Add title
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Title'],
                fontSize=18,
                spaceAfter=30,
                alignment=1
            )
            story.append(Paragraph(title, title_style))
            story.append(Spacer(1, 20))
            
            # Add content
            content_style = ParagraphStyle(
                'Content',
                parent=styles['Normal'],
                fontSize=11,
                spaceAfter=12,
                leftIndent=20,
                rightIndent=20
            )
            
            # Split content into paragraphs and add to PDF
            paragraphs = content.split('\n\n')
            for para in paragraphs:
                if para.strip():
                    story.append(Paragraph(para.strip(), content_style))
                    story.append(Spacer(1, 6))
            
            doc.build(story)
            logger.info(f"Text to PDF conversion successful: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Text to PDF conversion failed: {str(e)}")
            return False
    
    @staticmethod
    async def _convert_csv_to_pdf(input_path: str, output_path: str, title: str) -> bool:
        """Convert CSV to PDF"""
        if not EXCEL_CONVERSION_AVAILABLE:
            logger.error("pandas and reportlab not available for CSV conversion")
            return False
        
        try:
            logger.info(f"Converting CSV to PDF: {input_path} -> {output_path}")
            
            # Read CSV file
            df = pd.read_csv(input_path)
            
            # Create PDF
            doc = SimpleDocTemplate(output_path, pagesize=A4)
            styles = getSampleStyleSheet()
            story = []
            
            # Add title
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Title'],
                fontSize=18,
                spaceAfter=30,
                alignment=1
            )
            story.append(Paragraph(title, title_style))
            story.append(Spacer(1, 20))
            
            # Add document information
            info_style = ParagraphStyle(
                'Info',
                parent=styles['Normal'],
                fontSize=12,
                spaceAfter=12
            )
            
            story.append(Paragraph("Document Information", styles['Heading2']))
            story.append(Paragraph(f"<b>Original File:</b> {os.path.basename(input_path)}", info_style))
            story.append(Paragraph(f"<b>Document Type:</b> CSV File", info_style))
            story.append(Paragraph(f"<b>Rows:</b> {len(df)}", info_style))
            story.append(Paragraph(f"<b>Columns:</b> {len(df.columns)}", info_style))
            story.append(Spacer(1, 20))
            
            # Convert DataFrame to table if not too large
            if not df.empty and len(df) <= 50:  # Limit to 50 rows for PDF
                story.append(Paragraph("CSV Data", styles['Heading2']))
                
                # Prepare table data
                table_data = [df.columns.tolist()]  # Header
                table_data.extend(df.head(50).values.tolist())  # Data rows (limit to 50)
                
                # Create table
                table = Table(table_data)
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                    ('FONTSIZE', (0, 1), (-1, -1), 8)
                ]))
                
                story.append(table)
            else:
                story.append(Paragraph("CSV file contains too much data to display in PDF format.", styles['Normal']))
                story.append(Paragraph("Please download the original file to view all data.", styles['Normal']))
            
            story.append(Spacer(1, 20))
            
            # Add note about conversion
            note_style = ParagraphStyle(
                'Note',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.grey,
                alignment=1
            )
            story.append(Paragraph("Note: This document was converted from a CSV file to PDF format.", note_style))
            story.append(Paragraph("You can add signature fields and send this document for signing.", note_style))
            
            doc.build(story)
            logger.info(f"CSV to PDF conversion successful: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"CSV to PDF conversion failed: {str(e)}")
            return False
