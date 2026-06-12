-- Migration: Fix complete user schema to match schema.js
-- This adds all missing columns expected by the application
-- Date: 2026-02-13

-- Add password authentication columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);

-- Add wallet authorization columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_linked_at TIMESTAMP DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_wallet_signature TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nonce TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_nonce_expiry TIMESTAMP;

-- Add admin control columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_change_password BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_admin BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_by_user_id INTEGER REFERENCES users(id);

-- Add wallet connection status
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_wallet_connected BOOLEAN DEFAULT false;

-- Add blockchain role management tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_grant_transaction_hash VARCHAR(66);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_revoke_transaction_hash VARCHAR(66);

-- Add updated_at timestamp
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

-- Make wallet_address nullable (for email-only registrations)
ALTER TABLE users ALTER COLUMN wallet_address DROP NOT NULL;
ALTER TABLE users ALTER COLUMN wallet_address TYPE TEXT;

-- Update existing records
UPDATE users SET is_wallet_connected = (wallet_address IS NOT NULL AND wallet_address != '');
UPDATE users SET wallet_linked_at = created_at WHERE wallet_address IS NOT NULL;
UPDATE users SET nonce = '' WHERE nonce IS NULL;

-- Ensure kyc_submissions has all required columns
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS date_of_birth TIMESTAMP;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS nationality VARCHAR(100);
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS city VARCHAR(150);
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS document_hash VARCHAR(255);
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

-- Add signature verification columns
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS submission_signature TEXT;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS submission_message TEXT;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS approval_signature TEXT;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS approval_message TEXT;

-- Add transaction hash columns
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS approval_transaction_hash VARCHAR(66);
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS submission_transaction_hash VARCHAR(66);
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS rejection_transaction_hash VARCHAR(66);

-- Fix kyc_documents to match schema
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS ipfs_hash VARCHAR(100);
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS file_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS file_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS ipfs_url VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS upload_signature TEXT;
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS upload_message TEXT;

-- Make storage_path nullable since IPFS is primary
ALTER TABLE kyc_documents ALTER COLUMN storage_path DROP NOT NULL;

-- Fix property_documents to match schema
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS ipfs_hash VARCHAR(100);
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS file_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS file_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS ipfs_url VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS upload_signature TEXT;
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS upload_message TEXT;
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS verified_by INTEGER REFERENCES users(id);

-- Make file_path nullable since IPFS is primary
ALTER TABLE property_documents ALTER COLUMN file_path DROP NOT NULL;

-- Fix property_images to match schema
ALTER TABLE property_images ADD COLUMN IF NOT EXISTS ipfs_hash VARCHAR(100);
ALTER TABLE property_images ADD COLUMN IF NOT EXISTS file_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE property_images ADD COLUMN IF NOT EXISTS file_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE property_images ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE property_images ADD COLUMN IF NOT EXISTS ipfs_url VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE property_images ADD COLUMN IF NOT EXISTS upload_signature TEXT;
ALTER TABLE property_images ADD COLUMN IF NOT EXISTS upload_message TEXT;

-- Make file_path nullable
ALTER TABLE property_images ALTER COLUMN file_path DROP NOT NULL;

-- Add missing properties columns
ALTER TABLE properties ADD COLUMN IF NOT EXISTS assigned_verifier_id INTEGER REFERENCES users(id);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS assigned_by INTEGER REFERENCES users(id);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS submission_signature TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS submission_message TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS verification_signature TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS verification_message TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS tokenization_signature TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS tokenization_message TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS tokenization_transaction_hash VARCHAR(66);

-- Add signature columns to other tables
ALTER TABLE investments ADD COLUMN IF NOT EXISTS investment_signature TEXT;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS investment_message TEXT;

ALTER TABLE fractional_tokens ADD COLUMN IF NOT EXISTS creation_signature TEXT;
ALTER TABLE fractional_tokens ADD COLUMN IF NOT EXISTS creation_message TEXT;
ALTER TABLE fractional_tokens ADD COLUMN IF NOT EXISTS creation_transaction_hash VARCHAR(66);
ALTER TABLE fractional_tokens ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

ALTER TABLE revenue_distributions ADD COLUMN IF NOT EXISTS distribution_signature TEXT;
ALTER TABLE revenue_distributions ADD COLUMN IF NOT EXISTS distribution_message TEXT;
ALTER TABLE revenue_distributions ADD COLUMN IF NOT EXISTS distributed_by INTEGER REFERENCES users(id);

ALTER TABLE secondary_market_listings ADD COLUMN IF NOT EXISTS listing_signature TEXT;
ALTER TABLE secondary_market_listings ADD COLUMN IF NOT EXISTS listing_message TEXT;

ALTER TABLE secondary_market_trades ADD COLUMN IF NOT EXISTS trade_signature TEXT;
ALTER TABLE secondary_market_trades ADD COLUMN IF NOT EXISTS trade_message TEXT;

ALTER TABLE asset_registry ADD COLUMN IF NOT EXISTS registration_signature TEXT;
ALTER TABLE asset_registry ADD COLUMN IF NOT EXISTS registration_message TEXT;
ALTER TABLE asset_registry ADD COLUMN IF NOT EXISTS registration_transaction_hash VARCHAR(66);

ALTER TABLE verification_history ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE verification_history ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE verification_history ADD COLUMN IF NOT EXISTS transaction_hash VARCHAR(66);

ALTER TABLE action_logs ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE action_logs ADD COLUMN IF NOT EXISTS message TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_properties_lister_id ON properties(lister_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user_id ON kyc_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status ON kyc_submissions(status);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
END $$;
