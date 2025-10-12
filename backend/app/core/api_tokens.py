"""
API Token Service
"""

import secrets
import hashlib
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.api_token import ApiToken
from app.models.user import User
from app.core.logging_service import get_logger

logger = get_logger(__name__)

class ApiTokenService:
    """Service for managing API tokens"""
    
    @staticmethod
    def generate_token() -> tuple[str, str]:
        """Generate a new API token and its hash"""
        # Generate a secure random token
        token = f"vst_{secrets.token_urlsafe(32)}"
        
        # Create hash for storage
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        # Create prefix for identification (first 8 chars)
        token_prefix = token[:8]
        
        return token, token_hash, token_prefix
    
    @staticmethod
    async def create_token(
        db: AsyncSession,
        user_id: str,
        name: str,
        scopes: List[str] = None,
        expires_days: Optional[int] = None
    ) -> tuple[str, ApiToken]:
        """Create a new API token for a user"""
        try:
            # Generate token
            token, token_hash, token_prefix = ApiTokenService.generate_token()
            
            # Set default scopes
            if scopes is None:
                scopes = ["read"]
            
            # Calculate expiration
            expires_at = None
            if expires_days:
                expires_at = datetime.utcnow() + timedelta(days=expires_days)
            
            # Create token record
            api_token = ApiToken(
                user_id=user_id,
                name=name,
                token_hash=token_hash,
                token_prefix=token_prefix,
                scopes=",".join(scopes),
                expires_at=expires_at
            )
            
            db.add(api_token)
            await db.commit()
            await db.refresh(api_token)
            
            logger.info(f"Created API token for user {user_id}", extra_data={
                'token_name': name,
                'scopes': scopes,
                'expires_days': expires_days
            })
            
            return token, api_token
            
        except Exception as e:
            logger.error(f"Failed to create API token: {str(e)}", extra_data={
                'user_id': user_id,
                'token_name': name
            })
            raise
    
    @staticmethod
    async def validate_token(db: AsyncSession, token: str) -> Optional[ApiToken]:
        """Validate an API token and return the token record"""
        try:
            # Hash the provided token
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            
            # Find the token
            result = await db.execute(
                select(ApiToken).where(
                    and_(
                        ApiToken.token_hash == token_hash,
                        ApiToken.is_active == True
                    )
                )
            )
            api_token = result.scalar_one_or_none()
            
            if not api_token:
                logger.warning("Invalid API token provided")
                return None
            
            # Check if expired
            if api_token.expires_at and datetime.utcnow() > api_token.expires_at:
                logger.warning(f"Expired API token: {api_token.token_prefix}")
                return None
            
            # Update last used timestamp
            api_token.last_used_at = datetime.utcnow()
            await db.commit()
            
            logger.info(f"Valid API token used: {api_token.token_prefix}", extra_data={
                'user_id': str(api_token.user_id),
                'scopes': api_token.scopes
            })
            
            return api_token
            
        except Exception as e:
            logger.error(f"Error validating API token: {str(e)}")
            return None
    
    @staticmethod
    async def get_user_tokens(db: AsyncSession, user_id: str) -> List[ApiToken]:
        """Get all API tokens for a user"""
        try:
            result = await db.execute(
                select(ApiToken).where(ApiToken.user_id == user_id)
                .order_by(ApiToken.created_at.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error getting user tokens: {str(e)}", extra_data={'user_id': user_id})
            return []
    
    @staticmethod
    async def revoke_token(db: AsyncSession, token_id: str, user_id: str) -> bool:
        """Revoke an API token"""
        try:
            result = await db.execute(
                select(ApiToken).where(
                    and_(
                        ApiToken.id == token_id,
                        ApiToken.user_id == user_id
                    )
                )
            )
            api_token = result.scalar_one_or_none()
            
            if not api_token:
                return False
            
            api_token.is_active = False
            await db.commit()
            
            logger.info(f"Revoked API token: {api_token.token_prefix}", extra_data={
                'user_id': user_id,
                'token_id': token_id
            })
            
            return True
            
        except Exception as e:
            logger.error(f"Error revoking API token: {str(e)}", extra_data={
                'user_id': user_id,
                'token_id': token_id
            })
            return False
    
    @staticmethod
    def has_scope(token: ApiToken, required_scope: str) -> bool:
        """Check if token has required scope"""
        if not token:
            return False
        
        token_scopes = [scope.strip() for scope in token.scopes.split(",")]
        return required_scope in token_scopes or "admin" in token_scopes
