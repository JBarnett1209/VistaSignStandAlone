-- Add new columns to workflow_participants table
ALTER TABLE workflow_participants 
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS "signingOrder" INTEGER;

-- Make user_id nullable since participants might not have accounts yet
ALTER TABLE workflow_participants 
ALTER COLUMN user_id DROP NOT NULL;

-- Add constraints
ALTER TABLE workflow_participants 
ADD CONSTRAINT IF NOT EXISTS chk_email_not_empty CHECK (email IS NOT NULL AND email != ''),
ADD CONSTRAINT IF NOT EXISTS chk_signing_order_positive CHECK ("signingOrder" > 0);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_workflow_participants_email ON workflow_participants(email);
CREATE INDEX IF NOT EXISTS idx_workflow_participants_signing_order ON workflow_participants("signingOrder");
