-- Add missing signature columns to existing signatures table
-- This script adds all the new columns that were added to the Signature model

-- Add cryptographic signature data fields
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS digital_signature TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS document_hash VARCHAR(64);
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS signature_metadata JSON;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending';

-- Add legal compliance fields
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS signature_level VARCHAR(20) DEFAULT 'simple';
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS is_legally_binding BOOLEAN DEFAULT false;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS compliance_standard VARCHAR(20) DEFAULT 'ESIGN';
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS certificate_chain JSON;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS timestamp_data JSON;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS legal_metadata JSON;

-- Add soft delete fields
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Add hybrid signature fields
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS certificate_type VARCHAR(20) DEFAULT 'system';
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS user_metadata JSON;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS qualified_metadata JSON;

-- Add foreign key constraint for deleted_by (if users table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE signatures ADD CONSTRAINT IF NOT EXISTS fk_signatures_deleted_by_users 
        FOREIGN KEY (deleted_by) REFERENCES users(id);
    END IF;
END $$;
