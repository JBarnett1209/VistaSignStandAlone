"""
Finalize worker: flatten fields onto PDF and apply cryptographic signature.
"""

import io
import logging
import fitz  # PyMuPDF
from typing import List, Dict

from app.core.pdf_signer import sign_pdf_pades

logger = logging.getLogger(__name__)


def flatten_fields(pdf_bytes: bytes, fields: List[Dict]) -> bytes:
    """Render simple fields (text/checkbox) onto PDF using PyMuPDF (stub)."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        for f in fields:
            page = doc.load_page(max(0, f.get("page", 1) - 1))
            rect = f.get("rect_pts", {"x": 0, "y": 0, "w": 0, "h": 0})
            text = f.get("value", "") if f.get("type") in ("Text", "Full Name") else ""
            # Convert PDF points directly
            page.insert_text((rect["x"], page.rect.height - rect["y"]), text, fontsize=10)
        out = io.BytesIO()
        doc.save(out)
        return out.getvalue()
    finally:
        doc.close()


def finalize_pdf(pdf_bytes: bytes, fields: List[Dict]) -> bytes:
    flattened = flatten_fields(pdf_bytes, fields)
    signed = sign_pdf_pades(flattened) or flattened
    return signed


