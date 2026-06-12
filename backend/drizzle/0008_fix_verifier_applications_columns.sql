-- Add missing columns to verifier_applications table
-- This fixes the schema mismatch where code expects these columns but they don't exist

-- Add rejection_reason column
ALTER TABLE verifier_applications 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add approval_transaction_hash column
ALTER TABLE verifier_applications 
ADD COLUMN IF NOT EXISTS approval_transaction_hash VARCHAR(66);

-- Ensure all schema-defined columns exist
-- (The schema.js defines these but the original migration didn't create them)

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_verifier_applications_status_reviewed 
ON verifier_applications(status, reviewed_at);

-- Fix properties table - Add missing transaction hash columns
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS verifier_assignment_transaction_hash VARCHAR(66);

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS listing_transaction_hash VARCHAR(66);

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS verification_transaction_hash VARCHAR(66);

-- Add indexes for transaction hash lookups
CREATE INDEX IF NOT EXISTS idx_properties_listing_tx ON properties(listing_transaction_hash);
CREATE INDEX IF NOT EXISTS idx_properties_verification_tx ON properties(verification_transaction_hash);
CREATE INDEX IF NOT EXISTS idx_properties_tokenization_tx ON properties(tokenization_transaction_hash);

-- Success notification
DO $$
BEGIN
    RAISE NOTICE 'Schema fix migration completed: Added missing columns to verifier_applications and properties tables';
END $$;
