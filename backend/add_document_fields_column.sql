-- Add fields column to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS fields JSON;

-- Add index for better performance when querying by fields
CREATE INDEX IF NOT EXISTS idx_documents_fields ON documents USING GIN (fields);
