#!/usr/bin/env python3
"""
Test signature template response serialization
"""

import asyncio
import asyncpg
import json
from app.core.config import settings
from app.schemas.signature import SignatureTemplateResponse

async def test_template_response():
    """Test template response serialization"""
    
    # Convert SQLAlchemy URL to asyncpg format
    db_url = settings.DATABASE_URL
    if db_url.startswith('postgresql+asyncpg://'):
        db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
    
    print(f"🔗 Connecting to database...")
    
    try:
        conn = await asyncpg.connect(db_url)
        
        # Get a signature template
        template = await conn.fetchrow("""
            SELECT id, name, description, template_data, signature_style, 
                   is_default, is_active, created_at
            FROM signature_templates 
            LIMIT 1
        """)
        
        if not template:
            print("❌ No signature templates found")
            return
        
        print(f"📋 Raw template data from database:")
        print(f"  ID: {template['id']}")
        print(f"  Name: {template['name']}")
        print(f"  Description: {template['description']}")
        print(f"  Template Data: {template['template_data']}")
        print(f"  Template Data Type: {type(template['template_data'])}")
        print(f"  Signature Style: {template['signature_style']}")
        print(f"  Is Default: {template['is_default']}")
        print(f"  Is Active: {template['is_active']}")
        print(f"  Created At: {template['created_at']}")
        
        # Try to create a SignatureTemplateResponse
        try:
            response = SignatureTemplateResponse(
                id=str(template['id']),
                name=template['name'],
                description=template['description'],
                template_data=template['template_data'],
                signature_style=template['signature_style'],
                is_default=template['is_default'],
                is_active=template['is_active'],
                created_at=template['created_at']
            )
            print(f"✅ SignatureTemplateResponse created successfully")
            print(f"📤 Response data: {response.dict()}")
        except Exception as e:
            print(f"❌ Error creating SignatureTemplateResponse: {e}")
            print(f"   Template data value: {template['template_data']}")
            print(f"   Template data type: {type(template['template_data'])}")
        
        await conn.close()
        print("✅ Test completed!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    asyncio.run(test_template_response())
