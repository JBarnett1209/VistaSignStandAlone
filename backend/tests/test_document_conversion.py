"""
Test document conversion functionality
"""

import pytest
import tempfile
import os
from pathlib import Path

from app.services.document_converter import document_converter


class TestDocumentConverter:
    """Test document conversion service"""
    
    def test_pdf_conversion_skip(self):
        """Test that PDF files are skipped (already PDF)"""
        # Create a temporary PDF file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
            temp_pdf.write(b'%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n')
            temp_pdf.flush()
            
            # Create output path
            output_path = temp_pdf.name + '.output.pdf'
            
            # Test conversion
            result = await document_converter.convert_to_pdf(temp_pdf.name, output_path)
            
            assert result is True
            assert os.path.exists(output_path)
            
            # Cleanup
            os.unlink(temp_pdf.name)
            os.unlink(output_path)
    
    def test_unsupported_file_type(self):
        """Test unsupported file types are rejected"""
        with tempfile.NamedTemporaryFile(suffix='.xyz', delete=False) as temp_file:
            temp_file.write(b'Some content')
            temp_file.flush()
            
            output_path = temp_file.name + '.pdf'
            
            result = await document_converter.convert_to_pdf(temp_file.name, output_path)
            
            assert result is False
            assert not os.path.exists(output_path)
            
            # Cleanup
            os.unlink(temp_file.name)
    
    def test_text_to_pdf_conversion(self):
        """Test text file to PDF conversion"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as temp_txt:
            temp_txt.write("This is a test document.\nIt has multiple lines.\nFor testing purposes.")
            temp_txt.flush()
            
            output_path = temp_txt.name + '.pdf'
            
            result = await document_converter.convert_to_pdf(temp_txt.name, output_path)
            
            assert result is True
            assert os.path.exists(output_path)
            
            # Cleanup
            os.unlink(temp_txt.name)
            os.unlink(output_path)
    
    def test_get_page_count(self):
        """Test PDF page count extraction"""
        # Create a simple PDF with known page count
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
            # Write a minimal PDF with 2 pages
            pdf_content = b'''%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R 4 0 R]
/Count 2
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj
4 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000172 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
229
%%EOF'''
            
            temp_pdf.write(pdf_content)
            temp_pdf.flush()
            
            page_count = await document_converter.get_page_count(temp_pdf.name)
            
            assert page_count == 2
            
            # Cleanup
            os.unlink(temp_pdf.name)
    
    def test_validate_pdf(self):
        """Test PDF validation"""
        # Test valid PDF
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
            temp_pdf.write(b'%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n')
            temp_pdf.flush()
            
            is_valid = await document_converter.validate_pdf(temp_pdf.name)
            assert is_valid is True
            
            # Cleanup
            os.unlink(temp_pdf.name)
        
        # Test invalid PDF
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
            temp_pdf.write(b'This is not a PDF file')
            temp_pdf.flush()
            
            is_valid = await document_converter.validate_pdf(temp_pdf.name)
            assert is_valid is False
            
            # Cleanup
            os.unlink(temp_pdf.name)
