"""
PDF signing utilities built on pyHanko, integrating existing PKCS#12 certs
configured via SIGNATURE_CERT_PATH / SIGNATURE_PASSWORD.
"""

import io
import logging
from typing import Optional

from pyhanko.sign import signers
from pyhanko_certvalidator import ValidationContext
from pyhanko.sign.fields import SigFieldSpec

from app.core.config import settings

logger = logging.getLogger(__name__)


def sign_pdf_pades(pdf_bytes: bytes, reason: str = "VistaSign - Document Signed") -> Optional[bytes]:
    """Sign a PDF using PKCS#12 container from settings. Returns signed bytes or None."""
    try:
        if not settings.SIGNATURE_CERT_PATH:
            logger.error("SIGNATURE_CERT_PATH not configured")
            return None

        pfx = signers.pkcs12.load_pkcs12(
            settings.SIGNATURE_CERT_PATH,
            settings.SIGNATURE_PASSWORD or "",
        )

        signer = signers.SimpleSigner.load_pkcs12(
            pfx,
            key_passphrase=(settings.SIGNATURE_PASSWORD or "").encode() if settings.SIGNATURE_PASSWORD else None,
        )

        # Basic validation context (offline). Production: add trust roots/TSA if needed.
        vc = ValidationContext(allow_fetching=False)

        with io.BytesIO(pdf_bytes) as inf, io.BytesIO() as outf:
            signers.PdfSigner(
                signers.PdfSignatureMetadata(
                    field_name="VistaSign", reason=reason, validation_context=vc
                ),
                signer=signer,
                new_field_spec=SigFieldSpec(sig_field_name="VistaSign"),
            ).sign_pdf(inf, output=outf)
            return outf.getvalue()
    except Exception as e:
        logger.error(f"PDF signing failed: {e}")
        return None
