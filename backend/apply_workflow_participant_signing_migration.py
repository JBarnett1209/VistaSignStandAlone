#!/usr/bin/env python3
"""
Apply migration to add signing tracking fields to workflow_participants table
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

        # Check if status column exists
        status_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'workflow_participants' AND column_name = 'status'
            );
        """)
        
        if not status_exists:
            print("📝 Adding status column...")
            await conn.execute("ALTER TABLE workflow_participants ADD COLUMN status VARCHAR(50) DEFAULT 'pending'")
            print("✅ Added status column")
        else:
            print("⏭️ Status column already exists")

        # Check if signed_at column exists
        signed_at_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'workflow_participants' AND column_name = 'signed_at'
            );
        """)
        
        if not signed_at_exists:
            print("📝 Adding signed_at column...")
            await conn.execute("ALTER TABLE workflow_participants ADD COLUMN signed_at TIMESTAMP WITH TIME ZONE")
            print("✅ Added signed_at column")
        else:
            print("⏭️ Signed_at column already exists")

        # Check if signature_data column exists
        signature_data_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'workflow_participants' AND column_name = 'signature_data'
            );
        """)
        
        if not signature_data_exists:
            print("📝 Adding signature_data column...")
            await conn.execute("ALTER TABLE workflow_participants ADD COLUMN signature_data JSONB")
            print("✅ Added signature_data column")
        else:
            print("⏭️ Signature_data column already exists")

        # Check if ip_address column exists
        ip_address_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'workflow_participants' AND column_name = 'ip_address'
            );
        """)
        
        if not ip_address_exists:
            print("📝 Adding ip_address column...")
            await conn.execute("ALTER TABLE workflow_participants ADD COLUMN ip_address VARCHAR(45)")
            print("✅ Added ip_address column")
        else:
            print("⏭️ IP_address column already exists")

        # Check if user_agent column exists
        user_agent_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'workflow_participants' AND column_name = 'user_agent'
            );
        """)
        
        if not user_agent_exists:
            print("📝 Adding user_agent column...")
            await conn.execute("ALTER TABLE workflow_participants ADD COLUMN user_agent TEXT")
            print("✅ Added user_agent column")
        else:
            print("⏭️ User_agent column already exists")

        # Create indexes
        print("📝 Creating indexes...")
        
        # Status index
        status_index_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE tablename = 'workflow_participants' AND indexname = 'idx_workflow_participants_status'
            );
        """)
        
        if not status_index_exists:
            await conn.execute("CREATE INDEX idx_workflow_participants_status ON workflow_participants (status)")
            print("✅ Created status index")
        else:
            print("⏭️ Status index already exists")

        # Signed_at index
        signed_at_index_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE tablename = 'workflow_participants' AND indexname = 'idx_workflow_participants_signed_at'
            );
        """)
        
        if not signed_at_index_exists:
            await conn.execute("CREATE INDEX idx_workflow_participants_signed_at ON workflow_participants (signed_at)")
            print("✅ Created signed_at index")
        else:
            print("⏭️ Signed_at index already exists")

        # Signature_data GIN index
        signature_data_index_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE tablename = 'workflow_participants' AND indexname = 'idx_workflow_participants_signature_data'
            );
        """)
        
        if not signature_data_index_exists:
            await conn.execute("CREATE INDEX idx_workflow_participants_signature_data ON workflow_participants USING GIN (signature_data)")
            print("✅ Created signature_data GIN index")
        else:
            print("⏭️ Signature_data index already exists")

        await conn.close()
        print("✅ Workflow participant signing fields migration completed successfully!")

    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        print(f"❌ Migration failed: {e}")
        if conn:
            await conn.close()

if __name__ == "__main__":
    asyncio.run(apply_migration())
