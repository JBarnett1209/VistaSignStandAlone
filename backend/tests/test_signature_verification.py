"""
Test digital signature verification functionality
"""

import pytest
import tempfile
import os
from pathlib import Path

from app.services.digital_signature import digital_signature_service


class TestSignatureVerification:
    """Test digital signature verification"""
    
    def setup_method(self):
        """Setup test environment"""
        # Create a test PDF file
        self.test_pdf_content = self._create_test_pdf()
    
    def _create_test_pdf(self) -> bytes:
        """Create a simple test PDF"""
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter
        import io
        
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        c.drawString(100, 750, "Test Document for Signature Verification")
        c.drawString(100, 700, "This is a test document.")
        c.save()
        
        return buffer.getvalue()
    
    def test_verify_unsigned_pdf(self):
        """Test verification of unsigned PDF"""
        result = await digital_signature_service.verify_signature(self.test_pdf_content)
        
        assert result["has_signatures"] is False
        assert result["signatures"] == []
        assert result["all_valid"] is False
    
    def test_verify_corrupted_pdf(self):
        """Test verification of corrupted PDF"""
        corrupted_pdf = b"This is not a valid PDF file"
        
        result = await digital_signature_service.verify_signature(corrupted_pdf)
        
        assert result["has_signatures"] is False
        assert result["signatures"] == []
        assert result["all_valid"] is False
        assert "error" in result
    
    def test_verify_empty_pdf(self):
        """Test verification of empty PDF"""
        empty_pdf = b""
        
        result = await digital_signature_service.verify_signature(empty_pdf)
        
        assert result["has_signatures"] is False
        assert result["signatures"] == []
        assert result["all_valid"] is False
        assert "error" in result
    
    def test_verify_none_pdf(self):
        """Test verification of None PDF"""
        result = await digital_signature_service.verify_signature(None)
        
        assert result["has_signatures"] is False
        assert result["signatures"] == []
        assert result["all_valid"] is False
        assert "error" in result
    
    def test_get_certificate_info_no_cert(self):
        """Test getting certificate info when no certificate is configured"""
        # Temporarily set cert path to None
        original_cert_path = digital_signature_service.cert_path
        digital_signature_service.cert_path = None
        
        try:
            result = digital_signature_service.get_certificate_info()
            assert result is None
        finally:
            # Restore original cert path
            digital_signature_service.cert_path = original_cert_path
    
    def test_get_certificate_info_invalid_cert(self):
        """Test getting certificate info with invalid certificate file"""
        # Create a temporary invalid certificate file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False) as temp_cert:
            temp_cert.write("This is not a valid certificate")
            temp_cert.flush()
            
            # Temporarily set cert path to invalid file
            original_cert_path = digital_signature_service.cert_path
            digital_signature_service.cert_path = temp_cert.name
            
            try:
                result = digital_signature_service.get_certificate_info()
                assert result is None
            finally:
                # Restore original cert path and cleanup
                digital_signature_service.cert_path = original_cert_path
                os.unlink(temp_cert.name)
    
    def test_sign_pdf_no_cert(self):
        """Test signing PDF when no certificate is configured"""
        # Temporarily set cert path to None
        original_cert_path = digital_signature_service.cert_path
        digital_signature_service.cert_path = None
        
        try:
            signature_data = {
                'reason': 'Test signing',
                'location': 'Test location',
                'contact_info': 'test@example.com'
            }
            
            with pytest.raises(Exception):
                await digital_signature_service.sign_pdf(self.test_pdf_content, signature_data)
        finally:
            # Restore original cert path
            digital_signature_service.cert_path = original_cert_path
    
    def test_sign_pdf_invalid_data(self):
        """Test signing PDF with invalid signature data"""
        # Create a temporary certificate file (even if invalid)
        with tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False) as temp_cert:
            temp_cert.write("-----BEGIN CERTIFICATE-----\nInvalid cert data\n-----END CERTIFICATE-----")
            temp_cert.flush()
            
            # Temporarily set cert path
            original_cert_path = digital_signature_service.cert_path
            digital_signature_service.cert_path = temp_cert.name
            
            try:
                signature_data = {
                    'reason': 'Test signing',
                    'location': 'Test location',
                    'contact_info': 'test@example.com'
                }
                
                with pytest.raises(Exception):
                    await digital_signature_service.sign_pdf(self.test_pdf_content, signature_data)
            finally:
                # Restore original cert path and cleanup
                digital_signature_service.cert_path = original_cert_path
                os.unlink(temp_cert.name)
    
    def test_sign_pdf_empty_data(self):
        """Test signing PDF with empty signature data"""
        with pytest.raises(Exception):
            await digital_signature_service.sign_pdf(self.test_pdf_content, {})
    
    def test_sign_pdf_none_data(self):
        """Test signing PDF with None signature data"""
        with pytest.raises(Exception):
            await digital_signature_service.sign_pdf(self.test_pdf_content, None)
    
    def test_sign_pdf_empty_content(self):
        """Test signing empty PDF content"""
        signature_data = {
            'reason': 'Test signing',
            'location': 'Test location',
            'contact_info': 'test@example.com'
        }
        
        with pytest.raises(Exception):
            await digital_signature_service.sign_pdf(b"", signature_data)
    
    def test_sign_pdf_none_content(self):
        """Test signing None PDF content"""
        signature_data = {
            'reason': 'Test signing',
            'location': 'Test location',
            'contact_info': 'test@example.com'
        }
        
        with pytest.raises(Exception):
            await digital_signature_service.sign_pdf(None, signature_data)
