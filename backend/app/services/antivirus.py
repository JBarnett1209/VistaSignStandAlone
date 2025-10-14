"""
Antivirus Service for VistaSign using ClamAV
"""

import clamd
import logging
from typing import Optional, Tuple
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

class AntivirusService:
    """Antivirus service using ClamAV"""
    
    def __init__(self):
        self.clamd_host = settings.CLAMAV_HOST or "localhost"
        self.clamd_port = settings.CLAMAV_PORT or 3310
        self.clamd_socket = settings.CLAMAV_SOCKET
        self.client = None
        self._connect()
    
    def _connect(self):
        """Connect to ClamAV daemon"""
        try:
            if self.clamd_socket:
                # Connect via Unix socket
                self.client = clamd.ClamdUnixSocket(self.clamd_socket)
            else:
                # Connect via TCP
                self.client = clamd.ClamdNetworkSocket(self.clamd_host, self.clamd_port)
            
            # Test connection
            version = self.client.version()
            logger.info(f"Connected to ClamAV daemon: {version}")
            
        except Exception as e:
            logger.error(f"Failed to connect to ClamAV daemon: {e}")
            self.client = None
    
    def scan_file(self, file_path: str) -> Tuple[bool, Optional[str]]:
        """
        Scan file for viruses
        
        Returns:
            Tuple[bool, Optional[str]]: (is_clean, virus_name)
            - is_clean: True if file is clean, False if infected
            - virus_name: Name of virus if infected, None if clean
        """
        if not self.client:
            logger.warning("ClamAV client not available, skipping scan")
            return True, None
        
        try:
            # Check if file exists
            if not Path(file_path).exists():
                logger.error(f"File not found for scanning: {file_path}")
                return False, "FILE_NOT_FOUND"
            
            # Scan the file
            result = self.client.scan(file_path)
            
            if result is None:
                logger.error(f"ClamAV scan returned None for: {file_path}")
                return False, "SCAN_ERROR"
            
            # Parse result
            file_path_result = result.get(file_path)
            if file_path_result is None:
                logger.error(f"No scan result for file: {file_path}")
                return False, "NO_RESULT"
            
            status, virus_name = file_path_result
            
            if status == "OK":
                logger.info(f"File is clean: {file_path}")
                return True, None
            elif status == "FOUND":
                logger.warning(f"Virus found in file: {file_path}, virus: {virus_name}")
                return False, virus_name
            else:
                logger.error(f"Unknown scan status: {status} for file: {file_path}")
                return False, f"UNKNOWN_STATUS_{status}"
                
        except Exception as e:
            logger.error(f"ClamAV scan error for {file_path}: {e}")
            return False, f"SCAN_ERROR_{str(e)}"
    
    def scan_buffer(self, buffer: bytes) -> Tuple[bool, Optional[str]]:
        """
        Scan buffer for viruses
        
        Returns:
            Tuple[bool, Optional[str]]: (is_clean, virus_name)
        """
        if not self.client:
            logger.warning("ClamAV client not available, skipping scan")
            return True, None
        
        try:
            # Scan the buffer
            result = self.client.instream(buffer)
            
            if result is None:
                logger.error("ClamAV buffer scan returned None")
                return False, "SCAN_ERROR"
            
            status, virus_name = result
            
            if status == "OK":
                logger.info("Buffer is clean")
                return True, None
            elif status == "FOUND":
                logger.warning(f"Virus found in buffer, virus: {virus_name}")
                return False, virus_name
            else:
                logger.error(f"Unknown scan status: {status}")
                return False, f"UNKNOWN_STATUS_{status}"
                
        except Exception as e:
            logger.error(f"ClamAV buffer scan error: {e}")
            return False, f"SCAN_ERROR_{str(e)}"
    
    def update_virus_definitions(self) -> bool:
        """Update ClamAV virus definitions"""
        if not self.client:
            logger.warning("ClamAV client not available, cannot update definitions")
            return False
        
        try:
            # Reload virus definitions
            result = self.client.reload()
            logger.info(f"ClamAV definitions reloaded: {result}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update ClamAV definitions: {e}")
            return False
    
    def get_version(self) -> Optional[str]:
        """Get ClamAV version"""
        if not self.client:
            return None
        
        try:
            return self.client.version()
        except Exception as e:
            logger.error(f"Failed to get ClamAV version: {e}")
            return None
    
    def is_available(self) -> bool:
        """Check if ClamAV service is available"""
        return self.client is not None

# Create singleton instance
antivirus_service = AntivirusService()
