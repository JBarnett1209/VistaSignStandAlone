"""
Initial admin user setup utility.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.user import User, UserRole, UserStatus
from app.core.security.auth import AuthHandler
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


async def ensure_initial_admin():
    """Create initial admin user if it doesn't exist and env vars are set."""
    if not settings.INITIAL_ADMIN_EMAIL or not settings.INITIAL_ADMIN_PASSWORD:
        logger.info("No initial admin credentials provided, skipping admin setup")
        return

    async for db in get_db():
        try:
            # Check if any admin users exist
            result = await db.execute(
                select(User).where(User.role == UserRole.ADMIN)
            )
            existing_admin = result.scalar_one_or_none()
            
            if existing_admin:
                logger.info("Admin user already exists, skipping initial admin setup")
                return

            # Check if the specific email already exists
            result = await db.execute(
                select(User).where(User.email == settings.INITIAL_ADMIN_EMAIL)
            )
            existing_user = result.scalar_one_or_none()
            
            if existing_user:
                logger.warning(f"User with email {settings.INITIAL_ADMIN_EMAIL} already exists")
                return

            # Create initial admin user
            auth_handler = AuthHandler()
            admin_user = User(
                email=settings.INITIAL_ADMIN_EMAIL,
                password_hash=auth_handler.get_password_hash(settings.INITIAL_ADMIN_PASSWORD),
                first_name=settings.INITIAL_ADMIN_FIRST_NAME,
                last_name=settings.INITIAL_ADMIN_LAST_NAME,
                role=UserRole.ADMIN,
                is_verified=True,
                is_active=True,
                status=UserStatus.ACTIVE
            )
            
            db.add(admin_user)
            await db.commit()
            await db.refresh(admin_user)
            
            logger.info(f"✅ Initial admin user created: {settings.INITIAL_ADMIN_EMAIL}")
            
        except Exception as e:
            logger.error(f"❌ Failed to create initial admin user: {e}")
            await db.rollback()
        finally:
            await db.close()
        break
