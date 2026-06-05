"""
PDF signing utilities built on pyHanko.

Uses the PKCS#12 container configured via SIGNATURE_CERT_PATH / SIGNATURE_PASSWORD,
falling back to the auto-generated self-signed bundle that ensure_signature_certs()
creates at startup (so signing works out of the box without extra config).
"""

import io
import os
import logging
from typing import Optional

from pyhanko.sign import signers
from pyhanko.sign.fields import SigFieldSpec
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter

from app.core.config import settings
from app.core.certs import DEFAULT_P12_PATH, DEFAULT_P12_PASSWORD

logger = logging.getLogger(__name__)


async def sign_pdf_pades(pdf_bytes: bytes, reason: str = "VistaSign - Document Signed") -> Optional[bytes]:
    """Sign a PDF with the configured (or auto-generated) PKCS#12 cert.

    Returns the signed PDF bytes, or None if signing isn't possible (no cert on
    disk, bad password, etc.) so callers can fall back to the unsigned document.

    Async because pyHanko's synchronous sign_pdf() calls asyncio.run()
    internally, which fails when we're already inside an event loop (the worker
    runs finalize via asyncio.run). We use the async signing API instead.
    """
    try:
        cert_path = settings.SIGNATURE_CERT_PATH or DEFAULT_P12_PATH
        password = settings.SIGNATURE_PASSWORD or DEFAULT_P12_PASSWORD

        if not os.path.exists(cert_path):
            logger.warning(f"Signing cert not found at {cert_path}; skipping PAdES signature")
            return None

        # SimpleSigner.load_pkcs12 takes the .p12 file path and a passphrase.
        signer = signers.SimpleSigner.load_pkcs12(
            cert_path, passphrase=password.encode()
        )
        if signer is None:
            logger.error("Failed to load signer from PKCS#12 container")
            return None

        meta = signers.PdfSignatureMetadata(field_name="VistaSign", reason=reason)
        pdf_signer = signers.PdfSigner(
            meta, signer=signer, new_field_spec=SigFieldSpec(sig_field_name="VistaSign")
        )

        with io.BytesIO(pdf_bytes) as inf:
            writer = IncrementalPdfFileWriter(inf)
            out = io.BytesIO()
            await pdf_signer.async_sign_pdf(writer, output=out)
            return out.getvalue()
    except Exception as e:
        logger.error(f"PDF signing failed: {e}")
        return None
