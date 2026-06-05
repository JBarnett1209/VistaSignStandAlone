"""
Ensure document-signing certificates exist; generate self-signed cert/P12 if missing.
Note: This is for document signing, not HTTPS. Use a reverse proxy (e.g., Caddy) for Let's Encrypt.
"""

from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives.serialization import pkcs12

from app.core.config import settings

# Shared defaults so the generator (here) and the signer (pdf_signer) agree on
# where the auto-generated PKCS#12 lives and how it's encrypted when no explicit
# SIGNATURE_* settings are provided.
DEFAULT_KEY_PATH = "certs/vistasign_key.pem"
DEFAULT_P12_PATH = "certs/vistasign_cert.p12"
DEFAULT_P12_PASSWORD = "change-this-strong-password"


def _write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)


def ensure_signature_certs() -> None:
    """Create RSA key, self-signed cert, and PKCS#12 bundle if paths are missing."""
    key_path = Path(settings.SIGNATURE_KEY_PATH or DEFAULT_KEY_PATH)
    p12_path = Path(settings.SIGNATURE_CERT_PATH or DEFAULT_P12_PATH)
    password = (settings.SIGNATURE_PASSWORD or DEFAULT_P12_PASSWORD).encode()

    # If both exist, nothing to do
    if key_path.exists() and p12_path.exists():
        return

    # Generate new RSA key
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=4096)

    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "CA"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, "San Francisco"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, settings.APP_NAME or "VistaSign"),
        x509.NameAttribute(NameOID.COMMON_NAME, "VistaSign Document Signing"),
    ])

    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.utcnow() - timedelta(minutes=1))
        .not_valid_after(datetime.utcnow() + timedelta(days=365))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(private_key, hashes.SHA256())
    )

    # Write PEM key
    pem_key = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    )
    _write_bytes(key_path, pem_key)

    # Create PKCS#12 bundle
    p12_bytes = pkcs12.serialize_key_and_certificates(
        name=b"VistaSign",
        key=private_key,
        cert=cert,
        cas=None,
        encryption_algorithm=serialization.BestAvailableEncryption(password),
    )
    _write_bytes(p12_path, p12_bytes)


