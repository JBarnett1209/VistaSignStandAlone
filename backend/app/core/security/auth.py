"""
VistaSign Authentication System
JWT-based authentication with password hashing
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from passlib.hash import argon2
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

# Password hashing (prefer Argon2id, allow bcrypt for legacy verification)
pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")

# JWT token scheme
security = HTTPBearer()

class AuthHandler:
    """Authentication handler for JWT tokens and password operations"""
    
    @staticmethod
    def verify_password_detailed(plain_password: str, hashed_password: str) -> tuple[bool, str]:
        """
        Verify password and return (verified, mode):
          - mode = 'argon2_pepper' when new scheme succeeds
          - mode = 'argon2_legacy' when argon2 without pepper succeeds
          - mode = 'bcrypt_legacy' when bcrypt succeeds
          - mode = 'fail' otherwise
        """
        peppered_password = plain_password + (settings.ENCRYPTION_PEPPER or "")
        try:
            if pwd_context.verify(peppered_password, hashed_password):
                logger.info("Auth: argon2+pepper verification succeeded")
                return True, "argon2_pepper"
        except Exception:
            logger.debug("Auth: argon2 verify raised, will try legacy if applicable")
        # legacy checks
        try:
            identified_scheme = pwd_context.identify(hashed_password)
            if identified_scheme == "bcrypt":
                if CryptContext(schemes=["bcrypt"]).verify(plain_password, hashed_password):
                    logger.info("Auth: legacy bcrypt verification succeeded (rehash will occur)")
                    return True, "bcrypt_legacy"
            elif identified_scheme == "argon2":
                if pwd_context.verify(plain_password, hashed_password):
                    logger.info("Auth: legacy argon2 (no pepper) verification succeeded (rehash will occur)")
                    return True, "argon2_legacy"
        except Exception:
            logger.debug("Auth: legacy verify raised")
        return False, "fail"

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash, supporting legacy bcrypt and auto-upgrading"""
        peppered_password = plain_password + (settings.ENCRYPTION_PEPPER or "")
        try:
            scheme = pwd_context.identify(hashed_password)
            logger.info(f"Auth: verifying password using scheme={scheme}")
        except Exception:
            logger.info("Auth: could not identify hash scheme")
            scheme = None
        
        # Try verifying with Argon2 (current scheme) using pepper
        try:
            if pwd_context.verify(peppered_password, hashed_password):
                logger.info("Auth: argon2+pepper verification succeeded")
                return True
        except Exception:
            logger.debug("Auth: argon2 verify raised, will try legacy if applicable")
        
        # If Argon2+pepper fails, try verifying legacy variants
        # This is for transparently upgrading old hashes
        try:
            identified_scheme = pwd_context.identify(hashed_password)
            if identified_scheme == "bcrypt":
                if CryptContext(schemes=["bcrypt"]).verify(plain_password, hashed_password):
                    logger.info("Auth: legacy bcrypt verification succeeded (rehash will occur)")
                    return True
                else:
                    logger.info("Auth: legacy bcrypt verification failed")
            elif identified_scheme == "argon2":
                # Legacy argon2 without pepper
                if pwd_context.verify(plain_password, hashed_password):
                    logger.info("Auth: legacy argon2 (no pepper) verification succeeded (rehash will occur)")
                    return True
                else:
                    logger.info("Auth: legacy argon2 (no pepper) verification failed")
        except Exception:
            logger.debug("Auth: bcrypt verify raised")
        
        return False
    
    @staticmethod
    def get_password_hash(password: str) -> str:
        """Generate password hash"""
        pepper = (settings.ENCRYPTION_PEPPER or "")
        candidate = f"{password}{pepper}"
        return pwd_context.hash(candidate)
    
    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(
                minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
            )
        
        to_encode.update({"exp": expire})
        if "type" not in to_encode:
            to_encode["type"] = "access"
        encoded_jwt = jwt.encode(
            to_encode, 
            settings.SECRET_KEY, 
            algorithm=settings.ALGORITHM
        )
        return encoded_jwt
    
    @staticmethod
    def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT refresh token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(
                days=settings.REFRESH_TOKEN_EXPIRE_DAYS
            )
        
        to_encode.update({"exp": expire, "type": "refresh"})
        encoded_jwt = jwt.encode(
            to_encode, 
            settings.SECRET_KEY, 
            algorithm=settings.ALGORITHM
        )
        return encoded_jwt
    
    @staticmethod
    def verify_token(token: str) -> Optional[dict]:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(
                token, 
                settings.SECRET_KEY, 
                algorithms=[settings.ALGORITHM]
            )
            return payload
        except JWTError as e:
            logger.warning(f"JWT token verification failed: {e}")
            return None
    
    @staticmethod
    def decode_token(token: str) -> dict:
        """Decode JWT token and return payload"""
        try:
            payload = jwt.decode(
                token, 
                settings.SECRET_KEY, 
                algorithms=[settings.ALGORITHM]
            )
            return payload
        except JWTError as e:
            logger.error(f"JWT token decode failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

# Global auth handler instance
auth_handler = AuthHandler()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Dependency to get current authenticated user from token"""
    token = credentials.credentials
    logger.info(f"get_current_user: Verifying token (length: {len(token) if token else 0})")
    
    try:
        payload = auth_handler.decode_token(token)
        logger.info(f"get_current_user: Token decoded successfully, type: {payload.get('type')}")
    except Exception as e:
        logger.error(f"get_current_user: Token decode failed: {e}")
        raise
    
    if payload.get("type") != "access":
        logger.warning(f"get_current_user: Invalid token type: {payload.get('type')}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type"
        )
    
    user_id: str = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    
    # Fetch user from database
    try:
        from sqlalchemy import select
        from app.models.user import UserStatus
        
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        # Check if user is active
        if user.status != UserStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is not active"
            )
        
        return {
            "user_id": str(user.id),
            "email": user.email,
            "role": user.role.value,
            "is_verified": user.is_verified
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db)
) -> Optional[dict]:
    """Dependency to get current authenticated user from token (optional)"""
    if not credentials:
        return None
    
    try:
        token = credentials.credentials
        payload = auth_handler.verify_token(token)
        
        if not payload or payload.get("type") != "access":
            return None
        
        user_id: str = payload.get("sub")
        if not user_id:
            return None
        
        # Fetch user from database
        from sqlalchemy import select
        from app.models.user import UserStatus
        
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user or user.status != UserStatus.ACTIVE:
            return None
        
        return {
            "user_id": str(user.id),
            "email": user.email,
            "role": user.role.value,
            "is_verified": user.is_verified
        }
        
    except Exception as e:
        logger.warning(f"Optional auth failed: {str(e)}")
        return None