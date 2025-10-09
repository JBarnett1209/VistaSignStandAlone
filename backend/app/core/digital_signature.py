"""
Digital Signature Service for VistaSign
Provides cryptographic non-repudiation for document signatures
"""

import hashlib
import base64
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple
from pathlib import Path
import logging

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.exceptions import InvalidSignature
from cryptography.x509.oid import NameOID

from app.core.config import settings

logger = logging.getLogger(__name__)


class DigitalSignatureService:
    """Service for creating and verifying digital signatures with non-repudiation"""
    
    def __init__(self):
        self._private_key = None
        self._certificate = None
        self._load_certificates()
    
    def _load_certificates(self):
        """Load the signing certificate and private key"""
        try:
            cert_path = Path(settings.SIGNATURE_CERT_PATH or "certs/vistasign_cert.p12")
            password = (settings.SIGNATURE_PASSWORD or "change-this-strong-password").encode()
            
            if not cert_path.exists():
                logger.error(f"Certificate file not found: {cert_path}")
                return
            
            # Load PKCS#12 certificate
            with open(cert_path, "rb") as f:
                p12_data = f.read()
            
            # Parse PKCS#12
            private_key, certificate, additional_certificates = pkcs12.load_key_and_certificates(
                p12_data, password
            )
            
            if private_key is None or certificate is None:
                logger.error("Failed to load private key or certificate from PKCS#12")
                return
            
            self._private_key = private_key
            self._certificate = certificate
            
            logger.info("Digital signature certificates loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load certificates: {str(e)}")
            self._private_key = None
            self._certificate = None
    
    def is_available(self) -> bool:
        """Check if digital signature service is available"""
        return self._private_key is not None and self._certificate is not None
    
    def get_certificate_info(self) -> Optional[Dict[str, Any]]:
        """Get certificate information for verification"""
        if not self._certificate:
            return None
        
        try:
            # Get certificate details
            subject = self._certificate.subject
            issuer = self._certificate.issuer
            
            # Extract common name
            cn = None
            for name in subject.get_attributes_for_oid(NameOID.COMMON_NAME):
                cn = name.value
                break
            
            # Get certificate thumbprint (SHA-1 hash)
            cert_der = self._certificate.public_bytes(serialization.Encoding.DER)
            thumbprint = hashlib.sha1(cert_der).hexdigest().upper()
            
            return {
                "subject": {
                    "common_name": cn,
                    "organization": self._get_name_attribute(subject, NameOID.ORGANIZATION_NAME),
                    "country": self._get_name_attribute(subject, NameOID.COUNTRY_NAME),
                },
                "issuer": {
                    "common_name": self._get_name_attribute(issuer, NameOID.COMMON_NAME),
                    "organization": self._get_name_attribute(issuer, NameOID.ORGANIZATION_NAME),
                },
                "thumbprint": thumbprint,
                "serial_number": str(self._certificate.serial_number),
                "not_valid_before": self._certificate.not_valid_before.isoformat(),
                "not_valid_after": self._certificate.not_valid_after.isoformat(),
                "public_key": base64.b64encode(
                    self._certificate.public_key().public_bytes(
                        encoding=serialization.Encoding.DER,
                        format=serialization.PublicFormat.SubjectPublicKeyInfo
                    )
                ).decode()
            }
        except Exception as e:
            logger.error(f"Failed to get certificate info: {str(e)}")
            return None
    
    def _get_name_attribute(self, name: x509.Name, oid: NameOID) -> Optional[str]:
        """Helper to extract name attribute"""
        for attr in name.get_attributes_for_oid(oid):
            return attr.value
        return None
    
    def create_document_hash(self, document_content: bytes) -> str:
        """Create SHA-256 hash of document content for integrity verification"""
        return hashlib.sha256(document_content).hexdigest()
    
    def create_signature_data(
        self,
        document_hash: str,
        user_id: str,
        signature_data: str,
        signing_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create the data structure that will be cryptographically signed"""
        return {
            "document_hash": document_hash,
            "user_id": user_id,
            "signature_data": signature_data,
            "signing_context": signing_context,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": "1.0"
        }
    
    def sign_data(self, data: Dict[str, Any]) -> Optional[str]:
        """Create a digital signature of the provided data"""
        if not self.is_available():
            logger.error("Digital signature service not available")
            return None
        
        try:
            # Convert data to JSON string for signing
            data_json = json.dumps(data, sort_keys=True, separators=(',', ':'))
            data_bytes = data_json.encode('utf-8')
            
            # Create signature using private key
            signature = self._private_key.sign(
                data_bytes,
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            
            # Return base64 encoded signature
            return base64.b64encode(signature).decode()
            
        except Exception as e:
            logger.error(f"Failed to create digital signature: {str(e)}")
            return None
    
    def verify_signature(self, data: Dict[str, Any], signature: str) -> bool:
        """Verify a digital signature"""
        if not self.is_available():
            logger.error("Digital signature service not available")
            return False
        
        try:
            # Convert data to JSON string (same format as signing)
            data_json = json.dumps(data, sort_keys=True, separators=(',', ':'))
            data_bytes = data_json.encode('utf-8')
            
            # Decode signature
            signature_bytes = base64.b64decode(signature)
            
            # Verify signature using public key
            self._certificate.public_key().verify(
                signature_bytes,
                data_bytes,
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            
            return True
            
        except InvalidSignature:
            logger.warning("Invalid digital signature")
            return False
        except Exception as e:
            logger.error(f"Signature verification failed: {str(e)}")
            return False
    
    def create_complete_signature(
        self,
        document_content: bytes,
        user_id: str,
        signature_data: str,
        signing_context: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Create a complete digital signature with all non-repudiation data"""
        if not self.is_available():
            logger.error("Digital signature service not available")
            return None
        
        try:
            # Create document hash
            document_hash = self.create_document_hash(document_content)
            
            # Create signature data structure
            sig_data = self.create_signature_data(
                document_hash=document_hash,
                user_id=user_id,
                signature_data=signature_data,
                signing_context=signing_context
            )
            
            # Create digital signature
            digital_signature = self.sign_data(sig_data)
            if not digital_signature:
                return None
            
            # Get certificate info
            cert_info = self.get_certificate_info()
            if not cert_info:
                return None
            
            return {
                "digital_signature": digital_signature,
                "signature_data": sig_data,
                "certificate_info": cert_info,
                "document_hash": document_hash,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to create complete signature: {str(e)}")
            return None
    
    def verify_complete_signature(self, signature_record: Dict[str, Any]) -> Dict[str, Any]:
        """Verify a complete signature record and return verification results"""
        result = {
            "is_valid": False,
            "errors": [],
            "warnings": [],
            "verification_details": {}
        }
        
        try:
            # Check if required fields exist
            required_fields = ["digital_signature", "signature_data", "certificate_info"]
            for field in required_fields:
                if field not in signature_record:
                    result["errors"].append(f"Missing required field: {field}")
            
            if result["errors"]:
                return result
            
            # Verify digital signature
            sig_data = signature_record["signature_data"]
            digital_sig = signature_record["digital_signature"]
            
            if not self.verify_signature(sig_data, digital_sig):
                result["errors"].append("Digital signature verification failed")
            else:
                result["verification_details"]["signature_valid"] = True
            
            # Verify certificate (basic checks)
            cert_info = signature_record["certificate_info"]
            if "thumbprint" in cert_info:
                current_cert_info = self.get_certificate_info()
                if current_cert_info and cert_info["thumbprint"] != current_cert_info["thumbprint"]:
                    result["warnings"].append("Certificate thumbprint mismatch")
                else:
                    result["verification_details"]["certificate_valid"] = True
            
            # Check timestamp
            if "timestamp" in sig_data:
                try:
                    sig_time = datetime.fromisoformat(sig_data["timestamp"].replace('Z', '+00:00'))
                    now = datetime.now(timezone.utc)
                    if sig_time > now:
                        result["warnings"].append("Signature timestamp is in the future")
                    else:
                        result["verification_details"]["timestamp_valid"] = True
                except ValueError:
                    result["errors"].append("Invalid timestamp format")
            
            # Overall validation
            result["is_valid"] = len(result["errors"]) == 0
            
        except Exception as e:
            logger.error(f"Signature verification failed: {str(e)}")
            result["errors"].append(f"Verification error: {str(e)}")
        
        return result


# Global instance
digital_signature_service = DigitalSignatureService()
