#!/usr/bin/env python3
"""
Debug signature templates to see what data is being stored
"""

import asyncio
import asyncpg
import json
from app.core.config import settings

async def debug_templates():
    """Debug signature templates data"""
    
    # Convert SQLAlchemy URL to asyncpg format
    db_url = settings.DATABASE_URL
    if db_url.startswith('postgresql+asyncpg://'):
        db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
    
    print(f"🔗 Connecting to database...")
    
    try:
        conn = await asyncpg.connect(db_url)
        
        # Get all signature templates
        templates = await conn.fetch("""
            SELECT id, name, description, template_data, signature_style, 
                   created_by, created_at, is_active
            FROM signature_templates 
            ORDER BY created_at DESC
        """)
        
        print(f"📋 Found {len(templates)} signature templates:")
        
        for i, template in enumerate(templates, 1):
            print(f"\n📝 Template {i}:")
            print(f"  ID: {template['id']}")
            print(f"  Name: {template['name']}")
            print(f"  Description: {template['description']}")
            print(f"  Style: {template['signature_style']}")
            print(f"  Created by: {template['created_by']}")
            print(f"  Created at: {template['created_at']}")
            print(f"  Active: {template['is_active']}")
            
            # Parse and display template data
            try:
                template_data = json.loads(template['template_data']) if isinstance(template['template_data'], str) else template['template_data']
                print(f"  Template Data:")
                if isinstance(template_data, dict):
                    for key, value in template_data.items():
                        if key == 'text' and len(str(value)) > 50:
                            print(f"    {key}: {str(value)[:50]}...")
                        else:
                            print(f"    {key}: {value}")
                else:
                    print(f"    Raw data: {str(template_data)[:100]}...")
            except Exception as e:
                print(f"  Template Data (raw): {template['template_data']}")
                print(f"  Parse error: {e}")
        
        # Get actual signatures count
        signature_count = await conn.fetchval("SELECT COUNT(*) FROM signatures")
        print(f"\n📊 Total actual signatures: {signature_count}")
        
        await conn.close()
        print("✅ Debug completed!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    asyncio.run(debug_templates())
