-- Add signing tracking fields to workflow_participants table
-- This migration adds fields to track who signed, when, and how

-- Add status field to track signing status
ALTER TABLE workflow_participants 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

-- Add signed_at timestamp
ALTER TABLE workflow_participants 
ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE;

-- Add signature_data JSON field to store signature information
ALTER TABLE workflow_participants 
ADD COLUMN IF NOT EXISTS signature_data JSONB;

-- Add IP address tracking
ALTER TABLE workflow_participants 
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);

-- Add user agent tracking
ALTER TABLE workflow_participants 
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Create index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_workflow_participants_status ON workflow_participants (status);

-- Create index on signed_at for faster queries
CREATE INDEX IF NOT EXISTS idx_workflow_participants_signed_at ON workflow_participants (signed_at);

-- Create GIN index on signature_data for JSON queries
CREATE INDEX IF NOT EXISTS idx_workflow_participants_signature_data ON workflow_participants USING GIN (signature_data);
