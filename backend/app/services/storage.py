"""
Storage facade that selects local or S3 adapter by configuration.
Currently defaults to local; S3 adapter can be plugged later without API change.
"""

from typing import Tuple, Optional

from app.core.config import settings
from . import storage_local


def save_original(content: bytes, original_ext: str) -> Tuple[str, str]:
    return storage_local.save_original(content, original_ext)


def save_pdf(content: bytes) -> Tuple[str, str]:
    return storage_local.save_pdf(content)


def save_signed_pdf(content: bytes) -> Tuple[str, str]:
    return storage_local.save_signed_pdf(content)


def resolve_path(storage_key: str) -> Optional[str]:
    return storage_local.resolve_path(storage_key)


