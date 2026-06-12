-- Migration: Add missing file_path column to property_documents
-- This column was defined in schema.js but missing from the actual database

ALTER TABLE property_documents 
ADD COLUMN IF NOT EXISTS file_path VARCHAR(255);

-- Add comment for clarity
COMMENT ON COLUMN property_documents.file_path IS 'Local file path fallback (optional, IPFS is primary storage)';
