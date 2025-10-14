"""
S3 Storage Service for VistaSign
"""

import boto3
import hashlib
import uuid
from typing import Tuple, Optional
from botocore.exceptions import ClientError
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

class S3StorageService:
    """S3 storage service for VistaSign platform"""
    
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        self.bucket_name = settings.S3_BUCKET_NAME
        
    def save_original(self, content: bytes, original_ext: str) -> Tuple[str, str]:
        """Save original file to S3 and return storage key and file path"""
        file_hash = hashlib.sha256(content).hexdigest()
        storage_key = f"originals/{file_hash[:2]}/{file_hash}{original_ext}"
        
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=storage_key,
                Body=content,
                ContentType=self._get_content_type(original_ext)
            )
            logger.info(f"Saved original file to S3: {storage_key}")
            return storage_key, f"s3://{self.bucket_name}/{storage_key}"
        except ClientError as e:
            logger.error(f"Failed to save original file to S3: {e}")
            raise
    
    def save_pdf(self, content: bytes) -> Tuple[str, str]:
        """Save PDF file to S3 and return storage key and file path"""
        file_hash = hashlib.sha256(content).hexdigest()
        storage_key = f"pdfs/{file_hash[:2]}/{file_hash}.pdf"
        
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=storage_key,
                Body=content,
                ContentType="application/pdf"
            )
            logger.info(f"Saved PDF file to S3: {storage_key}")
            return storage_key, f"s3://{self.bucket_name}/{storage_key}"
        except ClientError as e:
            logger.error(f"Failed to save PDF file to S3: {e}")
            raise
    
    def save_signed_pdf(self, content: bytes) -> Tuple[str, str]:
        """Save signed PDF file to S3 and return storage key and file path"""
        file_hash = hashlib.sha256(content).hexdigest()
        storage_key = f"signed/{file_hash[:2]}/{file_hash}.pdf"
        
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=storage_key,
                Body=content,
                ContentType="application/pdf"
            )
            logger.info(f"Saved signed PDF file to S3: {storage_key}")
            return storage_key, f"s3://{self.bucket_name}/{storage_key}"
        except ClientError as e:
            logger.error(f"Failed to save signed PDF file to S3: {e}")
            raise
    
    def get_file_content(self, storage_key: str) -> Optional[bytes]:
        """Get file content from S3 by storage key"""
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=storage_key
            )
            return response['Body'].read()
        except ClientError as e:
            logger.error(f"Failed to get file content from S3: {e}")
            return None
    
    def generate_presigned_url(self, storage_key: str, expiration: int = 3600) -> Optional[str]:
        """Generate presigned URL for file access"""
        try:
            response = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': storage_key},
                ExpiresIn=expiration
            )
            return response
        except ClientError as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            return None
    
    def delete_file(self, storage_key: str) -> bool:
        """Delete file from S3"""
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=storage_key
            )
            logger.info(f"Deleted file from S3: {storage_key}")
            return True
        except ClientError as e:
            logger.error(f"Failed to delete file from S3: {e}")
            return False
    
    def _get_content_type(self, file_ext: str) -> str:
        """Get content type based on file extension"""
        content_types = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.ppt': 'application/vnd.ms-powerpoint',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.txt': 'text/plain',
            '.rtf': 'application/rtf',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.tiff': 'image/tiff',
            '.tif': 'image/tiff',
        }
        return content_types.get(file_ext.lower(), 'application/octet-stream')
