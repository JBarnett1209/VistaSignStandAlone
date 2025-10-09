#!/usr/bin/env python3
"""
Migration script to add email and signingOrder columns to workflow_participants table
"""
import asyncio
import asyncpg
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

async def apply_migration():
    conn = None
    try:
        # Convert SQLAlchemy URL to asyncpg compatible URL
        db_url = settings.DATABASE_URL.replace("postgresql+asyncpg", "postgresql")
        conn = await asyncpg.connect(db_url)
        print("🔗 Connecting to database...")

        # Check if email column exists
        email_exists = await conn.fetchval("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'workflow_participants' AND column_name = 'email'
        """)

        if email_exists:
            print("⏭️ Column 'email' already exists")
        else:
            print("📝 Adding email column to workflow_participants table...")
            await conn.execute("ALTER TABLE workflow_participants ADD COLUMN email VARCHAR(255)")
            print("✅ Added email column")

        # Check if signingOrder column exists
        signing_order_exists = await conn.fetchval("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'workflow_participants' AND column_name = 'signingOrder'
        """)

        if signing_order_exists:
            print("⏭️ Column 'signingOrder' already exists")
        else:
            print("📝 Adding signingOrder column to workflow_participants table...")
            await conn.execute('ALTER TABLE workflow_participants ADD COLUMN "signingOrder" INTEGER')
            print("✅ Added signingOrder column")

        # Check if user_id is nullable
        user_id_nullable = await conn.fetchval("""
            SELECT is_nullable
            FROM information_schema.columns
            WHERE table_name = 'workflow_participants' AND column_name = 'user_id'
        """)

        if user_id_nullable == 'YES':
            print("⏭️ user_id is already nullable")
        else:
            print("📝 Making user_id nullable...")
            await conn.execute("ALTER TABLE workflow_participants ALTER COLUMN user_id DROP NOT NULL")
            print("✅ Made user_id nullable")

        await conn.close()
        print("✅ Workflow participants migration completed successfully!")

    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        print(f"❌ Migration failed: {e}")
        if conn:
            await conn.close()

if __name__ == "__main__":
    asyncio.run(apply_migration())
