"""
Digital Signature Service for VistaSign using pyHanko
"""

import logging
from typing import Optional, Dict, Any
from pathlib import Path
import tempfile

from app.core.config import settings

logger = logging.getLogger(__name__)

class DigitalSignatureService:
    """Digital signature service using pyHanko for PAdES signatures"""
    
    def __init__(self):
        self.cert_path = settings.SIGNING_CERT_PATH
        self.key_path = settings.SIGNING_KEY_PATH
        self.cert_password = settings.SIGNING_CERT_PASSWORD
    
    async def sign_pdf(self, pdf_bytes: bytes, signature_data: Dict[str, Any]) -> bytes:
        """
        Sign PDF with digital signature
        
        Args:
            pdf_bytes: PDF content as bytes
            signature_data: Signature metadata
            
        Returns:
            bytes: Signed PDF content
        """
        try:
            from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
            from pyhanko.sign import signers, fields
            from pyhanko.sign.fields import SigFieldSpec
            from pyhanko.pdf_utils.reader import PdfFileReader
            from pyhanko.pdf_utils.writer import BasePdfFileWriter
            from pyhanko.pdf_utils import text, images
            from pyhanko.pdf_utils.font import opentype
            from pyhanko.pdf_utils.font.api import FontEngine
            from pyhanko.pdf_utils.font.opentype import GlyphAccumulator
            from pyhanko.pdf_utils.font.simple import SimpleFontEngine
            from pyhanko.pdf_utils.font.type1 import Type1FontEngine
            from pyhanko.pdf_utils.font.ttf import TTFontEngine
            from pyhanko.pdf_utils.font.cid import CIDFontEngine
            from pyhanko.pdf_utils.font.ps import PSFontEngine
            from pyhanko.pdf_utils.font.otf import OTFFontEngine
            from pyhanko.pdf_utils.font.woff import WOFFFontEngine
            from pyhanko.pdf_utils.font.woff2 import WOFF2FontEngine
            from pyhanko.pdf_utils.font.eot import EOTFontEngine
            from pyhanko.pdf_utils.font.svg import SVGFontEngine
            from pyhanko.pdf_utils.font.bitmap import BitmapFontEngine
            from pyhanko.pdf_utils.font.monospace import MonospaceFontEngine
            from pyhanko.pdf_utils.font.sans import SansFontEngine
            from pyhanko.pdf_utils.font.serif import SerifFontEngine
            from pyhanko.pdf_utils.font.script import ScriptFontEngine
            from pyhanko.pdf_utils.font.symbol import SymbolFontEngine
            from pyhanko.pdf_utils.font.decorative import DecorativeFontEngine
            from pyhanko.pdf_utils.font.display import DisplayFontEngine
            from pyhanko.pdf_utils.font.handwriting import HandwritingFontEngine
            from pyhanko.pdf_utils.font.blackletter import BlackletterFontEngine
            from pyhanko.pdf_utils.font.gothic import GothicFontEngine
            from pyhanko.pdf_utils.font.oldstyle import OldstyleFontEngine
            from pyhanko.pdf_utils.font.transitional import TransitionalFontEngine
            from pyhanko.pdf_utils.font.modern import ModernFontEngine
            from pyhanko.pdf_utils.font.slab import SlabFontEngine
            from pyhanko.pdf_utils.font.script import ScriptFontEngine
            from pyhanko.pdf_utils.font.symbol import SymbolFontEngine
            from pyhanko.pdf_utils.font.decorative import DecorativeFontEngine
            from pyhanko.pdf_utils.font.display import DisplayFontEngine
            from pyhanko.pdf_utils.font.handwriting import HandwritingFontEngine
            from pyhanko.pdf_utils.font.blackletter import BlackletterFontEngine
            from pyhanko.pdf_utils.font.gothic import GothicFontEngine
            from pyhanko.pdf_utils.font.oldstyle import OldstyleFontEngine
            from pyhanko.pdf_utils.font.transitional import TransitionalFontEngine
            from pyhanko.pdf_utils.font.modern import ModernFontEngine
            from pyhanko.pdf_utils.font.slab import SlabFontEngine
            
            # Load the PDF
            reader = PdfFileReader(io.BytesIO(pdf_bytes))
            writer = IncrementalPdfFileWriter(reader)
            
            # Load signing certificate
            signer = self._load_signer()
            
            # Create signature field
            sig_field = SigFieldSpec(
                sig_field_name="VistaSign_Signature",
                on_page=0,
                box=(100, 100, 200, 150)
            )
            
            # Sign the PDF
            signed_pdf_bytes = await self._sign_with_pyhanko(writer, signer, sig_field, signature_data)
            
            logger.info("PDF signed successfully with digital signature")
            return signed_pdf_bytes
            
        except Exception as e:
            logger.error(f"Failed to sign PDF: {e}", exc_info=True)
            raise
    
    def _load_signer(self):
        """Load signing certificate and key"""
        try:
            from pyhanko.sign import signers
            from pyhanko.sign.signers.pdf_cms import PdfCMSSigner
            
            # Load PKCS#12 certificate
            if self.cert_path and self.cert_path.endswith('.p12'):
                signer = PdfCMSSigner.load_pkcs12(
                    self.cert_path,
                    self.cert_password
                )
            else:
                # Load separate cert and key files
                signer = PdfCMSSigner.load(
                    self.cert_path,
                    self.key_path,
                    self.cert_password
                )
            
            return signer
            
        except Exception as e:
            logger.error(f"Failed to load signing certificate: {e}")
            raise
    
    async def _sign_with_pyhanko(self, writer, signer, sig_field, signature_data):
        """Sign PDF using pyHanko"""
        try:
            from pyhanko.sign import signers
            from pyhanko.sign.signers.pdf_cms import PdfCMSSigner
            from pyhanko.sign.fields import SigFieldSpec
            from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
            from pyhanko.pdf_utils.reader import PdfFileReader
            from pyhanko.pdf_utils.writer import BasePdfFileWriter
            from pyhanko.pdf_utils import text, images
            from pyhanko.pdf_utils.font import opentype
            from pyhanko.pdf_utils.font.api import FontEngine
            from pyhanko.pdf_utils.font.opentype import GlyphAccumulator
            from pyhanko.pdf_utils.font.simple import SimpleFontEngine
            from pyhanko.pdf_utils.font.type1 import Type1FontEngine
            from pyhanko.pdf_utils.font.ttf import TTFontEngine
            from pyhanko.pdf_utils.font.cid import CIDFontEngine
            from pyhanko.pdf_utils.font.ps import PSFontEngine
            from pyhanko.pdf_utils.font.otf import OTFFontEngine
            from pyhanko.pdf_utils.font.woff import WOFFFontEngine
            from pyhanko.pdf_utils.font.woff2 import WOFF2FontEngine
            from pyhanko.pdf_utils.font.eot import EOTFontEngine
            from pyhanko.pdf_utils.font.svg import SVGFontEngine
            from pyhanko.pdf_utils.font.bitmap import BitmapFontEngine
            from pyhanko.pdf_utils.font.monospace import MonospaceFontEngine
            from pyhanko.pdf_utils.font.sans import SansFontEngine
            from pyhanko.pdf_utils.font.serif import SerifFontEngine
            from pyhanko.pdf_utils.font.script import ScriptFontEngine
            from pyhanko.pdf_utils.font.symbol import SymbolFontEngine
            from pyhanko.pdf_utils.font.decorative import DecorativeFontEngine
            from pyhanko.pdf_utils.font.display import DisplayFontEngine
            from pyhanko.pdf_utils.font.handwriting import HandwritingFontEngine
            from pyhanko.pdf_utils.font.blackletter import BlackletterFontEngine
            from pyhanko.pdf_utils.font.gothic import GothicFontEngine
            from pyhanko.pdf_utils.font.oldstyle import OldstyleFontEngine
            from pyhanko.pdf_utils.font.transitional import TransitionalFontEngine
            from pyhanko.pdf_utils.font.modern import ModernFontEngine
            from pyhanko.pdf_utils.font.slab import SlabFontEngine
            
            # Add signature field
            writer.add_signature_field(sig_field)
            
            # Sign the PDF
            signed_pdf_bytes = signer.sign_pdf(
                writer,
                signature_data
            )
            
            return signed_pdf_bytes
            
        except Exception as e:
            logger.error(f"Failed to sign PDF with pyHanko: {e}")
            raise
    
    async def verify_signature(self, pdf_bytes: bytes) -> Dict[str, Any]:
        """
        Verify digital signature in PDF
        
        Args:
            pdf_bytes: PDF content as bytes
            
        Returns:
            Dict containing verification results
        """
        try:
            from pyhanko.sign import signers
            from pyhanko.sign.signers.pdf_cms import PdfCMSSigner
            from pyhanko.pdf_utils.reader import PdfFileReader
            from pyhanko.pdf_utils.writer import BasePdfFileWriter
            from pyhanko.pdf_utils import text, images
            from pyhanko.pdf_utils.font import opentype
            from pyhanko.pdf_utils.font.api import FontEngine
            from pyhanko.pdf_utils.font.opentype import GlyphAccumulator
            from pyhanko.pdf_utils.font.simple import SimpleFontEngine
            from pyhanko.pdf_utils.font.type1 import Type1FontEngine
            from pyhanko.pdf_utils.font.ttf import TTFontEngine
            from pyhanko.pdf_utils.font.cid import CIDFontEngine
            from pyhanko.pdf_utils.font.ps import PSFontEngine
            from pyhanko.pdf_utils.font.otf import OTFFontEngine
            from pyhanko.pdf_utils.font.woff import WOFFFontEngine
            from pyhanko.pdf_utils.font.woff2 import WOFF2FontEngine
            from pyhanko.pdf_utils.font.eot import EOTFontEngine
            from pyhanko.pdf_utils.font.svg import SVGFontEngine
            from pyhanko.pdf_utils.font.bitmap import BitmapFontEngine
            from pyhanko.pdf_utils.font.monospace import MonospaceFontEngine
            from pyhanko.pdf_utils.font.sans import SansFontEngine
            from pyhanko.pdf_utils.font.serif import SerifFontEngine
            from pyhanko.pdf_utils.font.script import ScriptFontEngine
            from pyhanko.pdf_utils.font.symbol import SymbolFontEngine
            from pyhanko.pdf_utils.font.decorative import DecorativeFontEngine
            from pyhanko.pdf_utils.font.display import DisplayFontEngine
            from pyhanko.pdf_utils.font.handwriting import HandwritingFontEngine
            from pyhanko.pdf_utils.font.blackletter import BlackletterFontEngine
            from pyhanko.pdf_utils.font.gothic import GothicFontEngine
            from pyhanko.pdf_utils.font.oldstyle import OldstyleFontEngine
            from pyhanko.pdf_utils.font.transitional import TransitionalFontEngine
            from pyhanko.pdf_utils.font.modern import ModernFontEngine
            from pyhanko.pdf_utils.font.slab import SlabFontEngine
            
            # Load the PDF
            reader = PdfFileReader(io.BytesIO(pdf_bytes))
            
            # Verify signatures
            verification_results = []
            for sig_field in reader.get_signature_fields():
                try:
                    # Verify signature
                    verification_result = signer.verify_signature(sig_field)
                    verification_results.append({
                        'field_name': sig_field.field_name,
                        'valid': verification_result.valid,
                        'signer_info': verification_result.signer_info,
                        'signature_time': verification_result.signature_time,
                        'certificate_info': verification_result.certificate_info
                    })
                except Exception as e:
                    verification_results.append({
                        'field_name': sig_field.field_name,
                        'valid': False,
                        'error': str(e)
                    })
            
            return {
                'has_signatures': len(verification_results) > 0,
                'signatures': verification_results,
                'all_valid': all(r.get('valid', False) for r in verification_results)
            }
            
        except Exception as e:
            logger.error(f"Failed to verify signature: {e}", exc_info=True)
            return {
                'has_signatures': False,
                'signatures': [],
                'all_valid': False,
                'error': str(e)
            }
    
    def get_certificate_info(self) -> Optional[Dict[str, Any]]:
        """Get information about the signing certificate"""
        try:
            from cryptography import x509
            from cryptography.hazmat.backends import default_backend
            
            # Load certificate
            with open(self.cert_path, 'rb') as f:
                cert_data = f.read()
            
            # Parse certificate
            cert = x509.load_pem_x509_certificate(cert_data, default_backend())
            
            return {
                'subject': cert.subject.rfc4514_string(),
                'issuer': cert.issuer.rfc4514_string(),
                'serial_number': str(cert.serial_number),
                'not_valid_before': cert.not_valid_before.isoformat(),
                'not_valid_after': cert.not_valid_after.isoformat(),
                'version': cert.version.name,
                'signature_algorithm': cert.signature_algorithm_oid._name
            }
            
        except Exception as e:
            logger.error(f"Failed to get certificate info: {e}")
            return None

# Create singleton instance
digital_signature_service = DigitalSignatureService()
