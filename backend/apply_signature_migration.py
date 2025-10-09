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
        
        # Define columns to add
        columns_to_add = [
            ("digital_signature", "TEXT"),
            ("document_hash", "VARCHAR(64)"),
            ("signature_metadata", "JSON"),
            ("verification_status", "VARCHAR(20) DEFAULT 'pending'"),
            ("signature_level", "VARCHAR(20) DEFAULT 'simple'"),
            ("is_legally_binding", "BOOLEAN DEFAULT false"),
            ("compliance_standard", "VARCHAR(20) DEFAULT 'ESIGN'"),
            ("certificate_chain", "JSON"),
            ("timestamp_data", "JSON"),
            ("legal_metadata", "JSON"),
            ("is_deleted", "BOOLEAN DEFAULT false"),
            ("deleted_at", "TIMESTAMP WITH TIME ZONE"),
            ("deleted_by", "UUID"),
            ("deletion_reason", "TEXT"),
            ("certificate_type", "VARCHAR(20) DEFAULT 'system'"),
            ("user_metadata", "JSON"),
            ("qualified_metadata", "JSON")
        ]
        
        # Add columns one by one, checking if they exist first
        for column_name, column_type in columns_to_add:
            try:
                # Check if column exists
                exists = await conn.fetchval("""
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'signatures' AND column_name = $1
                    )
                """, column_name)
                
                if not exists:
                    await conn.execute(f"ALTER TABLE signatures ADD COLUMN {column_name} {column_type};")
                    print(f"✅ Added column: {column_name}")
                else:
                    print(f"⏭️  Column already exists: {column_name}")
            except Exception as e:
                print(f"⚠️  Error adding column {column_name}: {e}")
                # Continue with other columns even if one fails
        
        # Add foreign key constraint for deleted_by (if users table exists)
        users_exists = await conn.fetchval("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users');")
        if users_exists:
            try:
                # Check if constraint already exists
                constraint_exists = await conn.fetchval("""
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints 
                        WHERE table_name = 'signatures' AND constraint_name = 'fk_signatures_deleted_by_users'
                    )
                """)
                
                if not constraint_exists:
                    await conn.execute("""
                        ALTER TABLE signatures ADD CONSTRAINT fk_signatures_deleted_by_users 
                        FOREIGN KEY (deleted_by) REFERENCES users(id);
                    """)
                    print("🔗 Added foreign key constraint for deleted_by")
                else:
                    print("⏭️  Foreign key constraint already exists")
            except Exception as e:
                print(f"⚠️  Error adding foreign key constraint: {e}")
        
        await conn.close()
        print("✅ Signature table migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(apply_migration())
    exit(0 if success else 1)
