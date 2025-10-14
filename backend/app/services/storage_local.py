"""
Local filesystem storage backend (default).
Files are stored under settings.UPLOAD_DIR using UUID-based names.
"""

import os
import uuid
from typing import Optional, Tuple

from app.core.config import settings


def _ensure_dirs() -> None:
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(os.path.join(settings.UPLOAD_DIR, "originals"), exist_ok=True)
    os.makedirs(os.path.join(settings.UPLOAD_DIR, "pdf"), exist_ok=True)
    os.makedirs(os.path.join(settings.UPLOAD_DIR, "signed"), exist_ok=True)


def save_original(content: bytes, original_ext: str) -> Tuple[str, str]:
    """Save an original upload. Returns (abs_path, storage_key)."""
    _ensure_dirs()
    ext = original_ext if original_ext.startswith(".") else f".{original_ext}"
    name = f"{uuid.uuid4()}{ext}"
    abs_path = os.path.join(settings.UPLOAD_DIR, "originals", name)
    with open(abs_path, "wb") as f:
        f.write(content)
    storage_key = f"originals/{name}"
    return abs_path, storage_key


def save_pdf(content: bytes) -> Tuple[str, str]:
    _ensure_dirs()
    name = f"{uuid.uuid4()}.pdf"
    abs_path = os.path.join(settings.UPLOAD_DIR, "pdf", name)
    with open(abs_path, "wb") as f:
        f.write(content)
    storage_key = f"pdf/{name}"
    return abs_path, storage_key


def save_signed_pdf(content: bytes) -> Tuple[str, str]:
    _ensure_dirs()
    name = f"{uuid.uuid4()}.pdf"
    abs_path = os.path.join(settings.UPLOAD_DIR, "signed", name)
    with open(abs_path, "wb") as f:
        f.write(content)
    storage_key = f"signed/{name}"
    return abs_path, storage_key


def resolve_path(storage_key: str) -> Optional[str]:
    candidate = os.path.join(settings.UPLOAD_DIR, storage_key)
    return candidate if os.path.exists(candidate) else None


