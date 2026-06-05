"""
Logs API Endpoints for Admin Debugging
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security.auth import get_current_user
from app.core.auth_api_token import get_current_user_from_api_token, require_api_token_scope
from app.core.logging_service import get_logs, get_log_stats
from app.models.log import ApplicationLog
from app.core.logging_service import get_logger

router = APIRouter()
logger = get_logger(__name__)

class LogResponse(BaseModel):
    """Log entry response model"""
    id: str
    timestamp: datetime
    level: str
    logger_name: str
    message: str
    module: Optional[str]
    function: Optional[str]
    line_number: Optional[int]
    request_id: Optional[str]
    user_id: Optional[str]
    session_id: Optional[str]
    endpoint: Optional[str]
    method: Optional[str]
    status_code: Optional[int]
    response_time_ms: Optional[int]
    extra_data: Optional[dict]
    exception_type: Optional[str]
    exception_message: Optional[str]

class LogStatsResponse(BaseModel):
    """Log statistics response model"""
    level_counts: dict
    top_endpoints: dict
    top_users: dict
    time_range_hours: int

@router.get("/", response_model=List[LogResponse])
async def get_application_logs(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    level: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    endpoint: Optional[str] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user_from_api_token)
):
    """Get application logs (admin only)"""
    try:
        # Check if user is admin
        if current_user.get("role") != "admin":
            logger.warning(f"Non-admin user {current_user.get('email')} attempted to access logs")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        logger.info(f"Admin {current_user.get('email')} querying logs", extra_data={
            'limit': limit,
            'offset': offset,
            'level': level,
            'user_id': user_id,
            'endpoint': endpoint,
            'start_time': start_time.isoformat() if start_time else None,
            'end_time': end_time.isoformat() if end_time else None
        })
        
        # Get logs from database
        logs = await get_logs(
            db=db,
            limit=limit,
            offset=offset,
            level=level,
            user_id=user_id,
            endpoint=endpoint,
            start_time=start_time,
            end_time=end_time
        )
        
        # Convert to response format
        log_responses = []
        for log in logs:
            log_responses.append(LogResponse(
                id=str(log.id),
                timestamp=log.timestamp,
                level=log.level,
                logger_name=log.logger_name,
                message=log.message,
                module=log.module,
                function=log.function,
                line_number=log.line_number,
                request_id=log.request_id,
                user_id=str(log.user_id) if log.user_id else None,
                session_id=log.session_id,
                endpoint=log.endpoint,
                method=log.method,
                status_code=log.status_code,
                response_time_ms=log.response_time_ms,
                extra_data=log.extra_data,
                exception_type=log.exception_type,
                exception_message=log.exception_message
            ))
        
        logger.info(f"Retrieved {len(log_responses)} log entries for admin {current_user.get('email')}")
        return log_responses
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving logs: {str(e)}", extra_data={
            'error_type': type(e).__name__,
            'admin_user': current_user.get('email')
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve logs"
        )

@router.get("/stats", response_model=LogStatsResponse)
async def get_log_statistics(
    hours: int = Query(24, ge=1, le=168),  # Max 1 week
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user_from_api_token)
):
    """Get log statistics (admin only)"""
    try:
        # Check if user is admin
        if current_user.get("role") != "admin":
            logger.warning(f"Non-admin user {current_user.get('email')} attempted to access log stats")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        logger.info(f"Admin {current_user.get('email')} querying log stats for {hours} hours")
        
        # Get statistics
        stats = await get_log_stats(db=db, hours=hours)
        
        logger.info(f"Retrieved log statistics for admin {current_user.get('email')}")
        return LogStatsResponse(**stats)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving log statistics: {str(e)}", extra_data={
            'error_type': type(e).__name__,
            'admin_user': current_user.get('email')
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve log statistics"
        )

@router.get("/recent-errors", response_model=List[LogResponse])
async def get_recent_errors(
    limit: int = Query(50, ge=1, le=200),
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user_from_api_token)
):
    """Get recent error logs (admin only)"""
    try:
        # Check if user is admin
        if current_user.get("role") != "admin":
            logger.warning(f"Non-admin user {current_user.get('email')} attempted to access error logs")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        logger.info(f"Admin {current_user.get('email')} querying recent errors for {hours} hours")
        
        # Get recent errors
        start_time = datetime.utcnow() - timedelta(hours=hours)
        logs = await get_logs(
            db=db,
            limit=limit,
            offset=0,
            level="ERROR",
            start_time=start_time
        )
        
        # Convert to response format
        log_responses = []
        for log in logs:
            log_responses.append(LogResponse(
                id=str(log.id),
                timestamp=log.timestamp,
                level=log.level,
                logger_name=log.logger_name,
                message=log.message,
                module=log.module,
                function=log.function,
                line_number=log.line_number,
                request_id=log.request_id,
                user_id=str(log.user_id) if log.user_id else None,
                session_id=log.session_id,
                endpoint=log.endpoint,
                method=log.method,
                status_code=log.status_code,
                response_time_ms=log.response_time_ms,
                extra_data=log.extra_data,
                exception_type=log.exception_type,
                exception_message=log.exception_message
            ))
        
        logger.info(f"Retrieved {len(log_responses)} error entries for admin {current_user.get('email')}")
        return log_responses
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving recent errors: {str(e)}", extra_data={
            'error_type': type(e).__name__,
            'admin_user': current_user.get('email')
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve recent errors"
        )

@router.delete("/cleanup")
async def cleanup_old_logs(
    days: int = Query(30, ge=1, le=365),  # Max 1 year
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user_from_api_token)
):
    """Clean up old logs (admin only)"""
    try:
        # Check if user is admin
        if current_user.get("role") != "admin":
            logger.warning(f"Non-admin user {current_user.get('email')} attempted to cleanup logs")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        logger.info(f"Admin {current_user.get('email')} cleaning up logs older than {days} days")
        
        # Delete old logs
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        from sqlalchemy import delete
        result = await db.execute(
            delete(ApplicationLog).where(ApplicationLog.timestamp < cutoff_date)
        )
        
        await db.commit()
        
        deleted_count = result.rowcount
        logger.info(f"Cleaned up {deleted_count} old log entries for admin {current_user.get('email')}")
        
        return {
            "message": f"Cleaned up {deleted_count} log entries older than {days} days",
            "deleted_count": deleted_count,
            "cutoff_date": cutoff_date.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cleaning up logs: {str(e)}", extra_data={
            'error_type': type(e).__name__,
            'admin_user': current_user.get('email')
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cleanup logs"
        )
