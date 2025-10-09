#!/usr/bin/env python3
"""
Check if signature_templates table exists and create it if needed
"""

import asyncio
import asyncpg
import os
from app.core.config import settings

async def check_and_create_table():
    """Check if signature_templates table exists and create if needed"""
    
    # Convert SQLAlchemy URL to asyncpg format
    db_url = settings.DATABASE_URL
    if db_url.startswith('postgresql+asyncpg://'):
        db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
    
    print(f"🔗 Connecting to database...")
    print(f"📡 Database URL: {db_url}")
    
    try:
        conn = await asyncpg.connect(db_url)
        
        # Check if table exists
        table_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'signature_templates'
            );
        """)
        
        print(f"📋 Table 'signature_templates' exists: {table_exists}")
        
        if not table_exists:
            print("🔨 Creating signature_templates table...")
            
            # Create the table
            await conn.execute("""
                CREATE TABLE signature_templates (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    is_default BOOLEAN DEFAULT FALSE,
                    is_active BOOLEAN DEFAULT TRUE,
                    template_data JSONB NOT NULL,
                    signature_style VARCHAR(50) DEFAULT 'handwritten',
                    created_by UUID NOT NULL REFERENCES users(id),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """)
            
            print("✅ signature_templates table created successfully!")
        else:
            print("✅ signature_templates table already exists")
            
        # Check table structure
        columns = await conn.fetch("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'signature_templates' 
            AND table_schema = 'public'
            ORDER BY ordinal_position;
        """)
        
        print(f"\n📊 Table structure:")
        for col in columns:
            print(f"  - {col['column_name']}: {col['data_type']} (nullable: {col['is_nullable']})")
            
        # Check if there are any templates
        count = await conn.fetchval("SELECT COUNT(*) FROM signature_templates")
        print(f"\n📈 Total signature templates: {count}")
        
        await conn.close()
        print("✅ Database check completed!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    asyncio.run(check_and_create_table())
