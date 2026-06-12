-- ============================================================================
-- Migration 0009: Add ALL missing columns to properties and verifier_applications
-- Created: 2026-02-19
-- Purpose: Ensure database schema matches schema.js definitions
-- ============================================================================

-- Add ALL missing columns to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_type VARCHAR(50);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS base_currency VARCHAR(10) DEFAULT 'USD';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS current_market_price NUMERIC(18, 2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS last_price_update TIMESTAMP;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS oracle_enabled BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS manual_price_override NUMERIC(18, 2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS price_source VARCHAR(20) DEFAULT 'manual';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS assigned_verifier_id INTEGER REFERENCES users(id);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS assigned_by INTEGER REFERENCES users(id);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS verifier_assignment_transaction_hash VARCHAR(66);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS submission_signature TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS submission_message TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS listing_transaction_hash VARCHAR(66);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS verification_signature TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS verification_message TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS verification_transaction_hash VARCHAR(66);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS rejected_by INTEGER REFERENCES users(id);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS tokenization_signature TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS tokenization_message TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS tokenization_transaction_hash VARCHAR(66);

-- Ensure core properties columns exist (in case table wasn't created by 0000 migration)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS fractional_token_address VARCHAR(42);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS total_fractional_supply NUMERIC(36, 18);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS nft_token_id INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS metadata_url VARCHAR(500);

-- Add unique constraints if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'properties_nft_token_id_unique'
    ) THEN
        ALTER TABLE properties ADD CONSTRAINT properties_nft_token_id_unique UNIQUE (nft_token_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'properties_fractional_token_address_unique'
    ) THEN
        ALTER TABLE properties ADD CONSTRAINT properties_fractional_token_address_unique UNIQUE (fractional_token_address);
    END IF;
END $$;

-- Add ALL missing columns to verifier_applications table
-- (Ensure table exists first)
CREATE TABLE IF NOT EXISTS verifier_applications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

ALTER TABLE verifier_applications ADD COLUMN IF NOT EXISTS experience TEXT;
ALTER TABLE verifier_applications ADD COLUMN IF NOT EXISTS qualifications TEXT;
ALTER TABLE verifier_applications ADD COLUMN IF NOT EXISTS specialization VARCHAR(255);
ALTER TABLE verifier_applications ADD COLUMN IF NOT EXISTS documents_hash VARCHAR(255);
ALTER TABLE verifier_applications ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(255);
ALTER TABLE verifier_applications ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id);
ALTER TABLE verifier_applications ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE verifier_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE verifier_applications ADD COLUMN IF NOT EXISTS approval_transaction_hash VARCHAR(66);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_properties_property_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_assigned_verifier ON properties(assigned_verifier_id);
CREATE INDEX IF NOT EXISTS idx_verifier_applications_user_id ON verifier_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_verifier_applications_status ON verifier_applications(status);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 0009 completed: All missing columns added to properties and verifier_applications';
END $$;
