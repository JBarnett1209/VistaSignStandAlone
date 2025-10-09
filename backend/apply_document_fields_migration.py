#!/usr/bin/env python3
"""
Apply document fields migration
"""

import asyncio
import asyncpg
import os
from app.core.config import settings

async def apply_migration():
    """Apply the document fields migration"""
    try:
        # Convert SQLAlchemy URL to asyncpg format
        db_url = settings.DATABASE_URL
        if db_url.startswith('postgresql+asyncpg://'):
            db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
        
        print("🔗 Connecting to database...")
        conn = await asyncpg.connect(db_url)
        
        print("📝 Adding fields column to documents table...")
        
        # Check if column already exists
        result = await conn.fetchval("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'documents' AND column_name = 'fields'
        """)
        
        if result:
            print("⏭️ Column 'fields' already exists")
        else:
            # Add the fields column
            await conn.execute("ALTER TABLE documents ADD COLUMN fields JSON")
            print("✅ Added 'fields' column to documents table")
        
        # Check if index already exists
        index_result = await conn.fetchval("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'documents' AND indexname = 'idx_documents_fields'
        """)
        
        if index_result:
            print("⏭️ Index 'idx_documents_fields' already exists")
        else:
            # Add the index
            await conn.execute("CREATE INDEX idx_documents_fields ON documents USING GIN (fields)")
            print("✅ Added GIN index for fields column")
        
        await conn.close()
        print("✅ Document fields migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(apply_migration())
