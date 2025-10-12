#!/usr/bin/env python3
"""
Fix logging field lengths in the database
This script updates the application_logs table to increase field lengths
"""

import asyncio
import sys
import os
from sqlalchemy import text

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal

async def fix_logging_field_lengths():
    """Update the application_logs table to increase field lengths"""
    async with AsyncSessionLocal() as db:
        try:
            print("🔧 Fixing logging field lengths...")
            
            # Update logger_name field length
            await db.execute(text("""
                ALTER TABLE application_logs 
                ALTER COLUMN logger_name TYPE VARCHAR(200)
            """))
            print("✅ Updated logger_name field to VARCHAR(200)")
            
            # Update module field length
            await db.execute(text("""
                ALTER TABLE application_logs 
                ALTER COLUMN module TYPE VARCHAR(200)
            """))
            print("✅ Updated module field to VARCHAR(200)")
            
            # Update function field length
            await db.execute(text("""
                ALTER TABLE application_logs 
                ALTER COLUMN function TYPE VARCHAR(200)
            """))
            print("✅ Updated function field to VARCHAR(200)")
            
            # Update request_id field length
            await db.execute(text("""
                ALTER TABLE application_logs 
                ALTER COLUMN request_id TYPE VARCHAR(100)
            """))
            print("✅ Updated request_id field to VARCHAR(100)")
            
            await db.commit()
            print("🎉 Successfully updated all logging field lengths!")
            
        except Exception as e:
            print(f"❌ Error updating logging field lengths: {e}")
            await db.rollback()
            raise

if __name__ == "__main__":
    asyncio.run(fix_logging_field_lengths())
