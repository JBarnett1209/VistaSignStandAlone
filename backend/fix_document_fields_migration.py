#!/usr/bin/env python3
"""
Fix document fields migration - handle existing JSON column
"""

import asyncio
import asyncpg
import os
from app.core.config import settings

async def fix_migration():
    """Fix the document fields migration"""
    try:
        # Convert SQLAlchemy URL to asyncpg format
        db_url = settings.DATABASE_URL
        if db_url.startswith('postgresql+asyncpg://'):
            db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
        
        print("🔗 Connecting to database...")
        conn = await asyncpg.connect(db_url)
        
        print("🔍 Checking current column type...")
        
        # Check the current column type
        result = await conn.fetchval("""
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'documents' AND column_name = 'fields'
        """)
        
        if not result:
            print("❌ Fields column doesn't exist")
            await conn.close()
            return
        
        print(f"📋 Current column type: {result}")
        
        if result == 'json':
            print("🔄 Converting JSON column to JSONB...")
            
            # Convert JSON to JSONB
            await conn.execute("""
                ALTER TABLE documents 
                ALTER COLUMN fields TYPE JSONB USING fields::JSONB
            """)
            print("✅ Converted fields column from JSON to JSONB")
            
        elif result == 'jsonb':
            print("✅ Fields column is already JSONB")
        
        # Check if index already exists
        index_result = await conn.fetchval("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'documents' AND indexname = 'idx_documents_fields'
        """)
        
        if index_result:
            print("⏭️ Index 'idx_documents_fields' already exists")
        else:
            # Add the index for JSONB
            await conn.execute("CREATE INDEX idx_documents_fields ON documents USING GIN (fields)")
            print("✅ Added GIN index for fields column")
        
        await conn.close()
        print("✅ Document fields migration fix completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration fix failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(fix_migration())
