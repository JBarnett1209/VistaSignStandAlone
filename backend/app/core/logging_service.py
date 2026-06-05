"""
Comprehensive Logging Service with Database Integration
"""

import logging
import traceback
import uuid
import time
from typing import Optional, Dict, Any, Union
from datetime import datetime
from contextvars import ContextVar
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.models.log import ApplicationLog

# Context variables for request tracking
request_id_var: ContextVar[Optional[str]] = ContextVar('request_id', default=None)
user_id_var: ContextVar[Optional[str]] = ContextVar('user_id', default=None)
session_id_var: ContextVar[Optional[str]] = ContextVar('session_id', default=None)

# NOTE: the previous DatabaseLogHandler (a logging.Handler attached to the root
# logger per request) was removed. It captured every propagated record —
# including SQLAlchemy echo SQL — and amplified DB writes under concurrency.
# Request auditing now happens in RequestLoggingMiddleware, which writes exactly
# one application_logs row per request.


class ComprehensiveLogger:
    """Comprehensive logging service with database integration"""
    
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.DEBUG)

        # Add a console handler ONCE per named logger. get_logger() is called
        # repeatedly (per module, per middleware), and the previous code added a
        # new handler every time, so each message was printed N times. Guarding
        # on existing handlers keeps it to one. propagate=False stops the record
        # also reaching the root handler (basicConfig), which was the other half
        # of the duplicate console output.
        if not self.logger.handlers:
            console_handler = logging.StreamHandler()
            console_handler.setLevel(logging.INFO)
            console_handler.setFormatter(logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            ))
            self.logger.addHandler(console_handler)
        self.logger.propagate = False
    
    def _log_with_context(self, level: str, message: str, extra_data: Optional[Dict[str, Any]] = None, 
                         endpoint: Optional[str] = None, method: Optional[str] = None,
                         status_code: Optional[int] = None, response_time_ms: Optional[int] = None):
        """Log with additional context information"""
        extra = {
            'extra_data': extra_data or {},
            'endpoint': endpoint,
            'method': method,
            'status_code': status_code,
            'response_time_ms': response_time_ms
        }
        
        getattr(self.logger, level.lower())(message, extra=extra)
    
    def debug(self, message: str, extra_data: Optional[Dict[str, Any]] = None, **kwargs):
        """Log debug message"""
        self._log_with_context('DEBUG', message, extra_data, **kwargs)
    
    def info(self, message: str, extra_data: Optional[Dict[str, Any]] = None, **kwargs):
        """Log info message"""
        self._log_with_context('INFO', message, extra_data, **kwargs)
    
    def warning(self, message: str, extra_data: Optional[Dict[str, Any]] = None, **kwargs):
        """Log warning message"""
        self._log_with_context('WARNING', message, extra_data, **kwargs)
    
    def error(self, message: str, extra_data: Optional[Dict[str, Any]] = None, **kwargs):
        """Log error message"""
        self._log_with_context('ERROR', message, extra_data, **kwargs)
    
    def critical(self, message: str, extra_data: Optional[Dict[str, Any]] = None, **kwargs):
        """Log critical message"""
        self._log_with_context('CRITICAL', message, extra_data, **kwargs)
    
    def api_request(self, method: str, endpoint: str, user_id: Optional[str] = None, 
                   extra_data: Optional[Dict[str, Any]] = None):
        """Log API request"""
        self.info(f"API Request: {method} {endpoint}", extra_data={
            'request_type': 'api_request',
            'user_id': user_id,
            **(extra_data or {})
        }, endpoint=endpoint, method=method)
    
    def api_response(self, method: str, endpoint: str, status_code: int, 
                    response_time_ms: int, user_id: Optional[str] = None,
                    extra_data: Optional[Dict[str, Any]] = None):
        """Log API response"""
        level = 'ERROR' if status_code >= 400 else 'INFO'
        self._log_with_context(level, f"API Response: {method} {endpoint} - {status_code} ({response_time_ms}ms)", 
                              extra_data={
                                  'request_type': 'api_response',
                                  'user_id': user_id,
                                  **(extra_data or {})
                              }, endpoint=endpoint, method=method, 
                              status_code=status_code, response_time_ms=response_time_ms)
    
    def database_operation(self, operation: str, table: str, record_id: Optional[str] = None,
                          extra_data: Optional[Dict[str, Any]] = None):
        """Log database operation"""
        self.info(f"Database {operation}: {table}" + (f" (ID: {record_id})" if record_id else ""), 
                 extra_data={
                     'request_type': 'database_operation',
                     'operation': operation,
                     'table': table,
                     'record_id': record_id,
                     **(extra_data or {})
                 })
    
    def authentication_event(self, event: str, user_id: Optional[str] = None,
                           extra_data: Optional[Dict[str, Any]] = None):
        """Log authentication event"""
        self.info(f"Auth Event: {event}", extra_data={
            'request_type': 'authentication',
            'event': event,
            'user_id': user_id,
            **(extra_data or {})
        })
    
    def file_operation(self, operation: str, file_path: Optional[str] = None,
                      file_size: Optional[int] = None, extra_data: Optional[Dict[str, Any]] = None):
        """Log file operation"""
        self.info(f"File {operation}" + (f": {file_path}" if file_path else ""), 
                 extra_data={
                     'request_type': 'file_operation',
                     'operation': operation,
                     'file_path': file_path,
                     'file_size': file_size,
                     **(extra_data or {})
                 })

# Global logger instances
def get_logger(name: str) -> ComprehensiveLogger:
    """Get a comprehensive logger instance"""
    return ComprehensiveLogger(name)

# Context management functions
def set_request_context(request_id: str, user_id: Optional[str] = None, 
                       session_id: Optional[str] = None):
    """Set request context for logging"""
    request_id_var.set(request_id)
    if user_id:
        user_id_var.set(user_id)
    if session_id:
        session_id_var.set(session_id)

def clear_request_context():
    """Clear request context"""
    request_id_var.set(None)
    user_id_var.set(None)
    session_id_var.set(None)

# Database log query functions
async def get_logs(db: AsyncSession, limit: int = 100, offset: int = 0,
                  level: Optional[str] = None, user_id: Optional[str] = None,
                  endpoint: Optional[str] = None, start_time: Optional[datetime] = None,
                  end_time: Optional[datetime] = None) -> list[ApplicationLog]:
    """Query logs from database"""
    query = select(ApplicationLog)
    
    if level:
        query = query.where(ApplicationLog.level == level)
    if user_id:
        query = query.where(ApplicationLog.user_id == user_id)
    if endpoint:
        query = query.where(ApplicationLog.endpoint == endpoint)
    if start_time:
        query = query.where(ApplicationLog.timestamp >= start_time)
    if end_time:
        query = query.where(ApplicationLog.timestamp <= end_time)
    
    query = query.order_by(desc(ApplicationLog.timestamp)).offset(offset).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()

async def get_log_stats(db: AsyncSession, hours: int = 24) -> Dict[str, Any]:
    """Get log statistics for the last N hours"""
    from sqlalchemy import func, and_
    from datetime import datetime, timedelta
    
    start_time = datetime.utcnow() - timedelta(hours=hours)
    
    # Count by level
    level_counts = await db.execute(
        select(ApplicationLog.level, func.count(ApplicationLog.id))
        .where(ApplicationLog.timestamp >= start_time)
        .group_by(ApplicationLog.level)
    )
    
    # Count by endpoint
    endpoint_counts = await db.execute(
        select(ApplicationLog.endpoint, func.count(ApplicationLog.id))
        .where(and_(ApplicationLog.timestamp >= start_time, ApplicationLog.endpoint.isnot(None)))
        .group_by(ApplicationLog.endpoint)
        .order_by(func.count(ApplicationLog.id).desc())
        .limit(10)
    )
    
    # Count by user
    user_counts = await db.execute(
        select(ApplicationLog.user_id, func.count(ApplicationLog.id))
        .where(and_(ApplicationLog.timestamp >= start_time, ApplicationLog.user_id.isnot(None)))
        .group_by(ApplicationLog.user_id)
        .order_by(func.count(ApplicationLog.id).desc())
        .limit(10)
    )
    
    return {
        'level_counts': dict(level_counts.fetchall()),
        'top_endpoints': dict(endpoint_counts.fetchall()),
        'top_users': dict(user_counts.fetchall()),
        'time_range_hours': hours
    }
