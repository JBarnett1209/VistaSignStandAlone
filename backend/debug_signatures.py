#!/usr/bin/env python3
"""
Debug script to check signature data in the database
"""

import asyncio
import asyncpg
import os
import json

async def debug_signatures():
    """Debug signature data in the database"""
    
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
        conn = await asyncpg.connect(asyncpg_url)
        
        print("📊 Checking signature data...")
        
        # Check total signatures
        total_signatures = await conn.fetchval("SELECT COUNT(*) FROM signatures;")
        print(f"📈 Total signatures in database: {total_signatures}")
        
        # Check signatures with is_deleted = false
        active_signatures = await conn.fetchval("SELECT COUNT(*) FROM signatures WHERE is_deleted = false;")
        print(f"✅ Active signatures (is_deleted = false): {active_signatures}")
        
        # Check signatures with is_deleted = true
        deleted_signatures = await conn.fetchval("SELECT COUNT(*) FROM signatures WHERE is_deleted = true;")
        print(f"🗑️  Deleted signatures (is_deleted = true): {deleted_signatures}")
        
        # Check signatures where is_deleted is NULL
        null_deleted = await conn.fetchval("SELECT COUNT(*) FROM signatures WHERE is_deleted IS NULL;")
        print(f"❓ Signatures with NULL is_deleted: {null_deleted}")
        
        # Get sample signature data
        print("\n📋 Sample signature data:")
        sample_signatures = await conn.fetch("""
            SELECT id, signer_id, document_id, status, is_deleted, created_at, signature_level
            FROM signatures 
            LIMIT 5
        """)
        
        for sig in sample_signatures:
            print(f"  - ID: {sig['id']}")
            print(f"    Signer: {sig['signer_id']}")
            print(f"    Document: {sig['document_id']}")
            print(f"    Status: {sig['status']}")
            print(f"    Is Deleted: {sig['is_deleted']}")
            print(f"    Created: {sig['created_at']}")
            print(f"    Level: {sig['signature_level']}")
            print()
        
        # Check if users table exists and has data
        users_count = await conn.fetchval("SELECT COUNT(*) FROM users;")
        print(f"👥 Total users in database: {users_count}")
        
        # Check if documents table exists and has data
        documents_count = await conn.fetchval("SELECT COUNT(*) FROM documents;")
        print(f"📄 Total documents in database: {documents_count}")
        
        # Test the join query that the admin endpoint uses
        print("\n🔍 Testing admin query...")
        try:
            admin_query_result = await conn.fetch("""
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
            """)
            
            print(f"✅ Admin query returned {len(admin_query_result)} results:")
            for result in admin_query_result:
                print(f"  - Signature: {result['id']}")
                print(f"    Signer Email: {result['signer_email']}")
                print(f"    Document Title: {result['document_title']}")
                print(f"    Status: {result['status']}")
                print()
                
        except Exception as e:
            print(f"❌ Admin query failed: {e}")
        
        await conn.close()
        print("✅ Debug completed!")
        return True
        
    except Exception as e:
        print(f"❌ Debug failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(debug_signatures())
    exit(0 if success else 1)
