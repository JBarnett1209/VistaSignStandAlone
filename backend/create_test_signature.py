#!/usr/bin/env python3
"""
Create a test signature to verify the system is working
"""

import asyncio
import asyncpg
import os
import uuid
from datetime import datetime

async def create_test_signature():
    """Create a test signature"""
    
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
        
        # Get first user and document
        user = await conn.fetchrow("SELECT id FROM users LIMIT 1;")
        document = await conn.fetchrow("SELECT id FROM documents LIMIT 1;")
        
        if not user:
            print("❌ No users found in database")
            return False
            
        if not document:
            print("❌ No documents found in database")
            return False
        
        print(f"👤 Using user: {user['id']}")
        print(f"📄 Using document: {document['id']}")
        
        # Create a test signature
        signature_id = str(uuid.uuid4())
        now = datetime.now()
        
        await conn.execute("""
            INSERT INTO signatures (
                id, document_id, signer_id, signature_type, status,
                signature_data, signature_position, signing_reason,
                digital_signature, document_hash, verification_status,
                signature_level, is_legally_binding, compliance_standard,
                certificate_type, is_deleted, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
            )
        """, 
            signature_id,                    # id
            document['id'],                  # document_id
            user['id'],                      # signer_id
            'electronic',                    # signature_type
            'completed',                     # status
            'Test signature data',           # signature_data
            '{"x": 100, "y": 200}',         # signature_position
            'Test signature creation',       # signing_reason
            'test_digital_signature_123',    # digital_signature
            'test_document_hash_456',        # document_hash
            'verified',                      # verification_status
            'simple',                        # signature_level
            True,                            # is_legally_binding
            'ESIGN',                         # compliance_standard
            'system',                        # certificate_type
            False,                           # is_deleted
            now,                             # created_at
            now                              # updated_at
        )
        
        print(f"✅ Created test signature: {signature_id}")
        
        # Verify the signature was created
        count = await conn.fetchval("SELECT COUNT(*) FROM signatures;")
        print(f"📊 Total signatures now: {count}")
        
        await conn.close()
        print("✅ Test signature creation completed!")
        return True
        
    except Exception as e:
        print(f"❌ Failed to create test signature: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(create_test_signature())
    exit(0 if success else 1)
