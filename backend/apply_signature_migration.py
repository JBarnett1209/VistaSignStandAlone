#!/usr/bin/env python3
"""
Apply signature table migration to add missing columns
This script can be run to add the new signature columns to the existing database
"""

import asyncio
import asyncpg
import os
from pathlib import Path

async def apply_migration():
    """Apply the signature table migration"""
    
    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL environment variable not set")
        return False
    
    try:
        # Convert SQLAlchemy URL to asyncpg format
        if database_url.startswith('postgresql+asyncpg://'):
            # Remove the +asyncpg part for asyncpg
            asyncpg_url = database_url.replace('postgresql+asyncpg://', 'postgresql://')
        else:
            asyncpg_url = database_url
        
        # Parse database URL and connect
        print("🔗 Connecting to database...")
        conn = await asyncpg.connect(asyncpg_url)
        
        print("📝 Adding signature table columns...")
        
        # Add cryptographic signature data fields
        await conn.execute("ALTER TABLE signatures ADD COLUMN IF NOT EXISTS digital_signature TEXT;")
        await conn.execute("ALTER TABLE signatures ADD COLUMN IF NOT EXISTS document_hash VARCHAR(64);")
        await conn.execute("ALTER TABLE signatures ADD COLUMN IF NOT EXISTS signature_metadata JSON;")
        await conn.execute("ALTER TABLE signatures ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending';")
        
        # Add legal compliance fields
        await conn.execute("ALTER TABLE signatures ADD COLUMN IF NOT EXISTS signature_level VARCHAR(20) DEFAULT 'simple';")
        await conn.execute("ALTER TABLE signatures ADD COLUMN IF NOT EXISTS is_legally_binding BOOLEAN DEFAULT false;")
        await conn.execute("ALTER TABLE signatures ADD COLUMN IF NOT EXISTS compliance_standard VARCHAR(20) DEFAULT 'ESIGN';")
        await conn.execute("ALTER TABLE signatures ADD COLUMN IF NOT EXISTS certificate_chain JSON;")
        await conn.execute("ALTER TABLE signatures ADD COLUMN IF NOT EXISTS timestamp_data JSON;")
        await conn.execute("ALTER TABLE signatures ADD COLUMN IF NOT EXISTS legal_metadata JSON;")
        
        # Add soft delete fields
        await conn.execute("ALTER TABLE signatures ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;")
        await conn.execute("ALTER TABLE signatures ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;")
        await conn.execute("ALTER TABLE signatures ADD COLUMN IF NOT EXISTS deleted_by UUID;")
        await conn.execute("ALTER TABLE signatures ADD COLUMN IF NOT EXISTS deletion_reason TEXT;")
        
        # Add hybrid signature fields
        await conn.execute("ALTER TABLE signatures ADD COLUMN IF NOT EXISTS certificate_type VARCHAR(20) DEFAULT 'system';")
        await conn.execute("ALTER TABLE signatures ADD COLUMN IF NOT EXISTS user_metadata JSON;")
        await conn.execute("ALTER TABLE signatures ADD COLUMN IF NOT EXISTS qualified_metadata JSON;")
        
        # Add foreign key constraint for deleted_by (if users table exists)
        users_exists = await conn.fetchval("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users');")
        if users_exists:
            await conn.execute("""
                ALTER TABLE signatures ADD CONSTRAINT IF NOT EXISTS fk_signatures_deleted_by_users 
                FOREIGN KEY (deleted_by) REFERENCES users(id);
            """)
            print("🔗 Added foreign key constraint for deleted_by")
        
        await conn.close()
        print("✅ Signature table migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(apply_migration())
    exit(0 if success else 1)
