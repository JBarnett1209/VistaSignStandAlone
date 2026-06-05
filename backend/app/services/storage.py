"""
Storage facade that selects local or S3 adapter by configuration.
Currently defaults to local; S3 adapter can be plugged later without API change.
"""

from typing import Tuple, Optional
import os

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


class StorageService:
    """Storage service for file operations."""
    
    async def get_file_content(self, storage_key: str) -> Optional[bytes]:
        """Get file content by storage key."""
        if not storage_key:
            return None
            
        # For now, use local storage
        file_path = storage_local.resolve_path(storage_key)
        if not file_path or not os.path.exists(file_path):
            return None
            
        try:
            with open(file_path, 'rb') as f:
                return f.read()
        except Exception:
            return None
    
    async def save_file(self, content: bytes, filename: str) -> str:
        """Save file and return storage key."""
        # save_original returns (abs_path, storage_key) — keep the storage_key,
        # not the abs_path, so resolve_path() can find it later.
        _abs_path, storage_key = storage_local.save_original(content, os.path.splitext(filename)[1])
        return storage_key


# Create singleton instance
storage_service = StorageService()


