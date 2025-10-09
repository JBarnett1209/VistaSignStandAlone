#!/usr/bin/env python3
"""
Detailed debug script to check signature data in the database
"""

import asyncio
import asyncpg
import os
import json

async def debug_signatures_detailed():
    """Detailed debug signature data in the database"""
    
    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL environment variable not set")
        return False
    
    try:
        # Convert SQLAlchemy URL to asyncpg format
        if database_url.startswith('postgresql+asyncpg://'):
            asyncpg_url = database_url.replace('postgresql+asyncpg://', 'postgresql://')
        else:
            asyncpg_url = database_url
        
        print("🔗 Connecting to database...")
        print(f"📡 Database URL: {asyncpg_url}")
        conn = await asyncpg.connect(asyncpg_url)
        
        # Check current database and schema
        current_db = await conn.fetchval("SELECT current_database();")
        current_schema = await conn.fetchval("SELECT current_schema();")
        print(f"🗄️  Current database: {current_db}")
        print(f"📋 Current schema: {current_schema}")
        
        # List all tables
        print("\n📊 All tables in database:")
        tables = await conn.fetch("""
            SELECT table_name, table_schema 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
            ORDER BY table_name;
        """)
        for table in tables:
            print(f"  - {table['table_schema']}.{table['table_name']}")
        
        # Check signatures table structure
        print("\n🔍 Signatures table structure:")
        columns = await conn.fetch("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'signatures'
            ORDER BY ordinal_position;
        """)
        for col in columns:
            print(f"  - {col['column_name']}: {col['data_type']} (nullable: {col['is_nullable']})")
        
        # Check total signatures with different queries
        print("\n📈 Signature counts:")
        
        # Basic count
        total_signatures = await conn.fetchval("SELECT COUNT(*) FROM signatures;")
        print(f"  - Total signatures: {total_signatures}")
        
        # Count by status
        status_counts = await conn.fetch("""
            SELECT status, COUNT(*) as count 
            FROM signatures 
            GROUP BY status;
        """)
        for status in status_counts:
            print(f"  - Status '{status['status']}': {status['count']}")
        
        # Count by is_deleted
        deleted_counts = await conn.fetch("""
            SELECT 
                CASE 
                    WHEN is_deleted IS NULL THEN 'NULL'
                    WHEN is_deleted = true THEN 'true'
                    WHEN is_deleted = false THEN 'false'
                END as deleted_status,
                COUNT(*) as count
            FROM signatures 
            GROUP BY is_deleted;
        """)
        for deleted in deleted_counts:
            print(f"  - is_deleted {deleted['deleted_status']}: {deleted['count']}")
        
        # Get all signature data (limit to 10)
        print("\n📋 All signature data (first 10):")
        all_signatures = await conn.fetch("""
            SELECT id, signer_id, document_id, status, signature_type, 
                   is_deleted, created_at, signature_data, signature_level
            FROM signatures 
            ORDER BY created_at DESC
            LIMIT 10;
        """)
        
        if all_signatures:
            for sig in all_signatures:
                print(f"  - ID: {sig['id']}")
                print(f"    Signer: {sig['signer_id']}")
                print(f"    Document: {sig['document_id']}")
                print(f"    Status: {sig['status']}")
                print(f"    Type: {sig['signature_type']}")
                print(f"    Is Deleted: {sig['is_deleted']}")
                print(f"    Created: {sig['created_at']}")
                print(f"    Level: {sig['signature_level']}")
                print(f"    Data: {sig['signature_data'][:50] if sig['signature_data'] else 'None'}...")
                print()
        else:
            print("  No signatures found")
        
        # Test the exact query from the admin endpoint
        print("\n🔍 Testing admin endpoint query:")
        admin_query = """
            SELECT 
                s.id, s.signer_id, s.document_id, s.status, s.is_deleted,
                u.email as signer_email,
                u.first_name as signer_first_name,
                u.last_name as signer_last_name,
                d.title as document_title
            FROM signatures s
            LEFT JOIN users u ON s.signer_id = u.id
            LEFT JOIN documents d ON s.document_id = d.id
            WHERE s.is_deleted = false
            LIMIT 5
        """
        
        try:
            admin_results = await conn.fetch(admin_query)
            print(f"✅ Admin query returned {len(admin_results)} results:")
            for result in admin_results:
                print(f"  - Signature: {result['id']}")
                print(f"    Signer Email: {result['signer_email']}")
                print(f"    Document Title: {result['document_title']}")
                print(f"    Status: {result['status']}")
                print()
        except Exception as e:
            print(f"❌ Admin query failed: {e}")
        
        # Test without the is_deleted filter
        print("\n🔍 Testing query without is_deleted filter:")
        try:
            no_filter_results = await conn.fetch("""
                SELECT 
                    s.id, s.signer_id, s.document_id, s.status, s.is_deleted,
                    u.email as signer_email,
                    d.title as document_title
                FROM signatures s
                LEFT JOIN users u ON s.signer_id = u.id
                LEFT JOIN documents d ON s.document_id = d.id
                LIMIT 5
            """)
            print(f"✅ Query without filter returned {len(no_filter_results)} results:")
            for result in no_filter_results:
                print(f"  - Signature: {result['id']}")
                print(f"    Signer Email: {result['signer_email']}")
                print(f"    Document Title: {result['document_title']}")
                print(f"    Status: {result['status']}")
                print(f"    Is Deleted: {result['is_deleted']}")
                print()
        except Exception as e:
            print(f"❌ Query without filter failed: {e}")
        
        await conn.close()
        print("✅ Detailed debug completed!")
        return True
        
    except Exception as e:
        print(f"❌ Debug failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(debug_signatures_detailed())
    exit(0 if success else 1)
