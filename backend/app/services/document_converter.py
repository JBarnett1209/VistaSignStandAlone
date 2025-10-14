"""
Document Conversion Service for VistaSign
"""

import os
import subprocess
import tempfile
import logging
from typing import Optional, Tuple
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

class DocumentConverter:
    """Document conversion service using LibreOffice and other tools"""
    
    def __init__(self):
        self.libreoffice_path = settings.LIBREOFFICE_PATH or "libreoffice"
        self.ghostscript_path = settings.GHOSTSCRIPT_PATH or "gs"
        self.imagemagick_path = settings.IMAGEMAGICK_PATH or "convert"
    
    async def convert_to_pdf(self, input_path: str, output_path: str) -> bool:
        """Convert document to PDF using LibreOffice"""
        try:
            # Get file extension
            file_ext = Path(input_path).suffix.lower()
            
            if file_ext == '.pdf':
                # Already a PDF, just copy
                import shutil
                shutil.copy2(input_path, output_path)
                return True
            
            elif file_ext in ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.rtf', '.odt', '.ods', '.odp']:
                # Use LibreOffice for Office documents
                return await self._convert_with_libreoffice(input_path, output_path)
            
            elif file_ext in ['.png', '.jpg', '.jpeg', '.gif', '.tiff', '.tif']:
                # Use ImageMagick for images
                return await self._convert_image_to_pdf(input_path, output_path)
            
            elif file_ext == '.txt':
                # Use Ghostscript for text files
                return await self._convert_text_to_pdf(input_path, output_path)
            
            else:
                logger.error(f"Unsupported file type: {file_ext}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to convert document: {e}")
            return False
    
    async def _convert_with_libreoffice(self, input_path: str, output_path: str) -> bool:
        """Convert document using LibreOffice"""
        try:
            # Create temporary directory for LibreOffice output
            with tempfile.TemporaryDirectory() as temp_dir:
                # Run LibreOffice conversion
                cmd = [
                    self.libreoffice_path,
                    "--headless",
                    "--convert-to", "pdf",
                    "--outdir", temp_dir,
                    input_path
                ]
                
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=300  # 5 minute timeout
                )
                
                if result.returncode != 0:
                    logger.error(f"LibreOffice conversion failed: {result.stderr}")
                    return False
                
                # Find the converted PDF file
                input_filename = Path(input_path).stem
                pdf_path = Path(temp_dir) / f"{input_filename}.pdf"
                
                if not pdf_path.exists():
                    logger.error(f"Converted PDF not found: {pdf_path}")
                    return False
                
                # Move to final output path
                import shutil
                shutil.move(str(pdf_path), output_path)
                logger.info(f"Successfully converted document to PDF: {output_path}")
                return True
                
        except subprocess.TimeoutExpired:
            logger.error("LibreOffice conversion timed out")
            return False
        except Exception as e:
            logger.error(f"LibreOffice conversion error: {e}")
            return False
    
    async def _convert_image_to_pdf(self, input_path: str, output_path: str) -> bool:
        """Convert image to PDF using ImageMagick"""
        try:
            cmd = [
                self.imagemagick_path,
                input_path,
                "-density", "300",
                "-quality", "100",
                output_path
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120  # 2 minute timeout
            )
            
            if result.returncode != 0:
                logger.error(f"ImageMagick conversion failed: {result.stderr}")
                return False
            
            logger.info(f"Successfully converted image to PDF: {output_path}")
            return True
            
        except subprocess.TimeoutExpired:
            logger.error("ImageMagick conversion timed out")
            return False
        except Exception as e:
            logger.error(f"ImageMagick conversion error: {e}")
            return False
    
    async def _convert_text_to_pdf(self, input_path: str, output_path: str) -> bool:
        """Convert text file to PDF using Ghostscript"""
        try:
            # Read text content
            with open(input_path, 'r', encoding='utf-8') as f:
                text_content = f.read()
            
            # Create a simple PDF using reportlab
            from reportlab.pdfgen import canvas
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.utils import ImageReader
            
            c = canvas.Canvas(output_path, pagesize=letter)
            width, height = letter
            
            # Set font and margins
            c.setFont("Helvetica", 12)
            margin = 50
            line_height = 14
            y_position = height - margin
            
            # Split text into lines and draw
            lines = text_content.split('\n')
            for line in lines:
                if y_position < margin:
                    c.showPage()
                    y_position = height - margin
                
                # Wrap long lines
                if len(line) > 80:
                    words = line.split()
                    current_line = ""
                    for word in words:
                        if len(current_line + word) > 80:
                            c.drawString(margin, y_position, current_line)
                            y_position -= line_height
                            current_line = word + " "
                        else:
                            current_line += word + " "
                    if current_line:
                        c.drawString(margin, y_position, current_line)
                        y_position -= line_height
                else:
                    c.drawString(margin, y_position, line)
                    y_position -= line_height
            
            c.save()
            logger.info(f"Successfully converted text to PDF: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Text to PDF conversion error: {e}")
            return False
    
    async def get_page_count(self, pdf_path: str) -> int:
        """Get page count of PDF file"""
        try:
            import PyPDF2
            
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                return len(pdf_reader.pages)
                
        except Exception as e:
            logger.error(f"Failed to get page count: {e}")
            return 0
    
    async def validate_pdf(self, pdf_path: str) -> bool:
        """Validate PDF file integrity"""
        try:
            import PyPDF2
            
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                # Try to read the first page to validate
                if len(pdf_reader.pages) > 0:
                    pdf_reader.pages[0]
                return True
                
        except Exception as e:
            logger.error(f"PDF validation failed: {e}")
            return False

# Create singleton instance
document_converter = DocumentConverter()
