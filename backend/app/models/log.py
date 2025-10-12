"""
Application Log Model
"""

from sqlalchemy import Column, String, Text, DateTime, Integer, JSON, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.core.database import Base

class ApplicationLog(Base):
    """Application log entries for comprehensive debugging"""
    
    __tablename__ = "application_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    level = Column(String(20), nullable=False, index=True)  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    logger_name = Column(String(200), nullable=False, index=True)  # e.g., "app.api.v1.documents"
    message = Column(Text, nullable=False)
    module = Column(String(200), nullable=True)  # e.g., "documents.py"
    function = Column(String(200), nullable=True)  # e.g., "upload_document"
    line_number = Column(Integer, nullable=True)
    
    # Request context
    request_id = Column(String(100), nullable=True, index=True)  # Unique request identifier
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    session_id = Column(String(100), nullable=True, index=True)
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent = Column(Text, nullable=True)
    
    # API context
    endpoint = Column(String(200), nullable=True, index=True)  # e.g., "/api/v1/documents/upload"
    method = Column(String(10), nullable=True)  # GET, POST, PUT, DELETE
    status_code = Column(Integer, nullable=True, index=True)
    response_time_ms = Column(Integer, nullable=True)
    
    # Additional context
    extra_data = Column(JSON, nullable=True)  # Additional structured data
    exception_type = Column(String(100), nullable=True)  # For error logs
    exception_message = Column(Text, nullable=True)  # For error logs
    stack_trace = Column(Text, nullable=True)  # For error logs
    
    # Indexes for common queries
    __table_args__ = (
        Index('idx_logs_timestamp_level', 'timestamp', 'level'),
        Index('idx_logs_user_endpoint', 'user_id', 'endpoint'),
        Index('idx_logs_request_id', 'request_id'),
        Index('idx_logs_timestamp_desc', 'timestamp'),
    )
    
    def __repr__(self):
        return f"<ApplicationLog(id={self.id}, level={self.level}, message='{self.message[:50]}...')>"
