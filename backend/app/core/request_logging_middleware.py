"""
Request Logging Middleware
"""

import time
import uuid
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.logging_service import get_logger, set_request_context, clear_request_context
from app.core.database import get_db
from app.models.log import ApplicationLog

logger = get_logger(__name__)

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all requests and responses"""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.logger = get_logger("request_middleware")
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        
        # Extract user information from request
        user_id = None
        session_id = None
        
        # Try to get user from Authorization header
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                # Extract JWT token and decode to get user ID
                token = auth_header[7:]  # Remove "Bearer " prefix
                from app.core.security.auth import auth_handler
                payload = auth_handler.decode_token(token)
                if payload.get("type") == "access":
                    user_id = payload.get("sub")
            except Exception as e:
                # If JWT decode fails, user_id remains None
                pass
        
        # Try to get session from cookies
        session_id = request.cookies.get("vst_refresh")
        
        # Set request context
        set_request_context(request_id, user_id, session_id)
        
        # Log request
        start_time = time.time()
        
        self.logger.api_request(
            method=request.method,
            endpoint=str(request.url.path),
            user_id=user_id,
            extra_data={
                'request_id': request_id,
                'query_params': dict(request.query_params),
                'headers': dict(request.headers),
                'client_ip': request.client.host if request.client else None,
                'user_agent': request.headers.get('user-agent')
            }
        )
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate response time
            response_time_ms = int((time.time() - start_time) * 1000)
            
            # Log response
            self.logger.api_response(
                method=request.method,
                endpoint=str(request.url.path),
                status_code=response.status_code,
                response_time_ms=response_time_ms,
                user_id=user_id,
                extra_data={
                    'request_id': request_id,
                    'response_headers': dict(response.headers)
                }
            )
            
            # Add request ID to response headers for debugging
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as e:
            # Log error
            response_time_ms = int((time.time() - start_time) * 1000)
            
            self.logger.error(
                f"Request failed: {request.method} {request.url.path} - {str(e)}",
                extra_data={
                    'request_id': request_id,
                    'error_type': type(e).__name__,
                    'response_time_ms': response_time_ms
                },
                endpoint=str(request.url.path),
                method=request.method,
                status_code=500,
                response_time_ms=response_time_ms
            )
            
            # Re-raise the exception
            raise
            
        finally:
            # Clear request context
            clear_request_context()

class DatabaseLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to ensure database logs are committed"""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.logger = get_logger("database_logging_middleware")
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip database logging for auth endpoints to avoid interference
        if request.url.path.startswith("/api/v1/auth/"):
            return await call_next(request)
        
        try:
            # Create a database session for this request
            from app.core.database import AsyncSessionLocal
            from app.core.logging_service import DatabaseLogHandler
            import logging
            
            async with AsyncSessionLocal() as db_session:
                # Add database handler to root logger for this request
                db_handler = DatabaseLogHandler(db_session)
                root_logger = logging.getLogger()
                root_logger.addHandler(db_handler)
                
                try:
                    response = await call_next(request)
                    
                    # Flush all pending logs to the database
                    db_handler.flush_logs()
                    
                    # Commit all logs generated during this request
                    await db_session.commit()
                    
                    return response
                    
                except Exception as e:
                    # Still try to commit logs even for failed requests
                    try:
                        db_handler.flush_logs()
                        await db_session.commit()
                    except Exception as commit_error:
                        self.logger.warning(f"Failed to commit logs after error: {commit_error}")
                    
                    raise
                finally:
                    # Clean up the handler
                    root_logger.removeHandler(db_handler)
        except Exception as middleware_error:
            # If the middleware itself fails, log it and continue without database logging
            self.logger.error(f"DatabaseLoggingMiddleware failed: {middleware_error}")
            return await call_next(request)
