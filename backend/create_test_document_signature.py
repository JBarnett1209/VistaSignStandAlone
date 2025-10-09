#!/usr/bin/env python3
"""
Create a test document signature to verify admin signatures page
"""

import asyncio
import asyncpg
import json
import uuid
from datetime import datetime
from app.core.config import settings

async def create_test_signature():
    """Create a test signature for a document"""
    
    # Convert SQLAlchemy URL to asyncpg format
    db_url = settings.DATABASE_URL
    if db_url.startswith('postgresql+asyncpg://'):
        db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
    
    print(f"🔗 Connecting to database...")
    
    try:
        conn = await asyncpg.connect(db_url)
        
        # Get a user and document
        user = await conn.fetchrow("SELECT id, email FROM users LIMIT 1")
        document = await conn.fetchrow("SELECT id, title FROM documents LIMIT 1")
        
        if not user:
            print("❌ No users found in database")
            return False
            
        if not document:
            print("❌ No documents found in database")
            return False
        
        print(f"👤 Using user: {user['email']} ({user['id']})")
        print(f"📄 Using document: {document['title']} ({document['id']})")
        
        # Create a test signature
        signature_id = str(uuid.uuid4())
        signature_data = {
            "type": "typed",
            "text": "Josh Barnett",
            "font": "Dancing Script",
            "size": 40,
            "color": "#000000"
        }
        
        # Create signature record
        await conn.execute("""
            INSERT INTO signatures (
                id, signature_type, status, signature_data, signature_position,
                document_id, signer_id, created_at, signed_at,
                digital_signature, document_hash, verification_status,
                signature_level, is_legally_binding, compliance_standard,
                certificate_type, ip_address, user_agent, signing_reason,
                is_deleted
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
            )
        """, 
            signature_id,  # id
            'electronic',  # signature_type
            'completed',   # status
            json.dumps(signature_data),  # signature_data
            json.dumps({"x": 100, "y": 200, "width": 200, "height": 80}),  # signature_position
            document['id'],  # document_id
            user['id'],      # signer_id
            datetime.now(),  # created_at
            datetime.now(),  # signed_at
            'test_digital_signature_base64',  # digital_signature
            'test_document_hash_sha256',      # document_hash
            'verified',      # verification_status
            'advanced',      # signature_level
            True,            # is_legally_binding
            'ESIGN',         # compliance_standard
            'system',        # certificate_type
            '127.0.0.1',     # ip_address
            'VistaSign Test', # user_agent
            'Test signature creation', # signing_reason
            False            # is_deleted
        )
        
        print(f"✅ Created test signature: {signature_id}")
        
        # Verify the signature was created
        signature_count = await conn.fetchval("SELECT COUNT(*) FROM signatures")
        print(f"📊 Total signatures in database: {signature_count}")
        
        await conn.close()
        print("✅ Test signature creation completed!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    asyncio.run(create_test_signature())
