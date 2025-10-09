#!/usr/bin/env python3
"""
Test the admin signatures query to see what's happening
"""

import asyncio
import asyncpg
from app.core.config import settings

async def test_admin_query():
    """Test the admin signatures query"""
    
    # Convert SQLAlchemy URL to asyncpg format
    db_url = settings.DATABASE_URL
    if db_url.startswith('postgresql+asyncpg://'):
        db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
    
    print(f"🔗 Connecting to database...")
    
    try:
        conn = await asyncpg.connect(db_url)
        
        # Test 1: Simple count of signatures
        signature_count = await conn.fetchval("SELECT COUNT(*) FROM signatures")
        print(f"📊 Total signatures in signatures table: {signature_count}")
        
        # Test 2: Count with is_deleted filter
        active_count = await conn.fetchval("SELECT COUNT(*) FROM signatures WHERE is_deleted = false")
        deleted_count = await conn.fetchval("SELECT COUNT(*) FROM signatures WHERE is_deleted = true")
        print(f"📊 Active signatures: {active_count}")
        print(f"📊 Deleted signatures: {deleted_count}")
        
        # Test 3: Check if signatures have required relationships
        signatures_with_users = await conn.fetchval("""
            SELECT COUNT(*) FROM signatures s 
            JOIN users u ON s.signer_id = u.id
        """)
        print(f"📊 Signatures with valid users: {signatures_with_users}")
        
        signatures_with_docs = await conn.fetchval("""
            SELECT COUNT(*) FROM signatures s 
            JOIN documents d ON s.document_id = d.id
        """)
        print(f"📊 Signatures with valid documents: {signatures_with_docs}")
        
        # Test 4: Full admin query
        admin_query_results = await conn.fetch("""
            SELECT s.id, s.status, s.is_deleted, u.email as signer_email, d.title as document_title
            FROM signatures s
            JOIN users u ON s.signer_id = u.id
            JOIN documents d ON s.document_id = d.id
            WHERE s.is_deleted = false
            LIMIT 5
        """)
        
        print(f"📊 Admin query results: {len(admin_query_results)} signatures")
        for sig in admin_query_results:
            print(f"  - {sig['id']}: {sig['status']} by {sig['signer_email']} on {sig['document_title']}")
        
        # Test 5: Show all signatures without joins
        all_signatures = await conn.fetch("""
            SELECT id, status, is_deleted, signer_id, document_id, created_at
            FROM signatures
            ORDER BY created_at DESC
            LIMIT 5
        """)
        
        print(f"📊 All signatures (no joins): {len(all_signatures)}")
        for sig in all_signatures:
            print(f"  - {sig['id']}: {sig['status']}, deleted={sig['is_deleted']}, signer={sig['signer_id']}, doc={sig['document_id']}")
        
        await conn.close()
        print("✅ Admin query test completed!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    asyncio.run(test_admin_query())
