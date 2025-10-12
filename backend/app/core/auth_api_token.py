"""
API Token Authentication
"""

from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.api_tokens import ApiTokenService
from app.models.api_token import ApiToken
from app.core.logging_service import get_logger

logger = get_logger(__name__)

# Security scheme for API tokens
api_token_scheme = HTTPBearer(scheme_name="API Token")

async def get_current_user_from_api_token(
    credentials: HTTPAuthorizationCredentials = Depends(api_token_scheme),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Get current user from API token"""
    try:
        # Extract token from Bearer header
        token = credentials.credentials
        
        # Validate token
        api_token = await ApiTokenService.validate_token(db, token)
        if not api_token:
            logger.warning("Invalid API token provided")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Get user information
        from sqlalchemy import select
        from app.models.user import User
        
        result = await db.execute(
            select(User).where(User.id == api_token.user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user or not user.is_active:
            logger.warning(f"User not found or inactive for API token: {api_token.token_prefix}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Return user info in same format as JWT auth
        return {
            "user_id": str(user.id),
            "id": str(user.id),  # For backward compatibility
            "email": user.email,
            "role": user.role.value,
            "is_verified": user.is_verified,
            "is_active": user.is_active,  # Boolean field for frontend
            "status": user.status.value,  # Status enum for backend logic
            "first_name": user.first_name,
            "last_name": user.last_name,
            "company": user.company,
            "job_title": user.job_title,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "api_token": api_token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in API token authentication: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def require_api_token_scope(required_scope: str):
    """Dependency to require specific API token scope"""
    async def scope_checker(current_user: dict = Depends(get_current_user_from_api_token)):
        api_token = current_user.get("api_token")
        if not ApiTokenService.has_scope(api_token, required_scope):
            logger.warning(f"API token missing required scope: {required_scope}", extra_data={
                'user_id': current_user.get('user_id'),
                'token_scopes': api_token.scopes if api_token else None
            })
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"API token missing required scope: {required_scope}"
            )
        return current_user
    return scope_checker

async def get_current_user_api_or_jwt(
    db: AsyncSession = Depends(get_db)
):
    """Get current user from either API token or JWT (for backward compatibility)"""
    from fastapi import Request
    from app.core.security.auth import get_current_user
    
    # This is a simplified version - in practice you'd check the request headers
    # and route to the appropriate authentication method
    # For now, we'll use the existing JWT auth as fallback
    try:
        return await get_current_user_from_api_token(db=db)
    except:
        # Fallback to JWT auth
        return await get_current_user(db=db)
