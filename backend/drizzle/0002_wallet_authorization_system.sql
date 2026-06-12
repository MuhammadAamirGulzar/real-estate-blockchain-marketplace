-- Migration: Add wallet-based authorization and role hierarchy
-- Created: 2024-12-19

-- Add new columns to users table for wallet authorization
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_connected_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_wallet_signature TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_nonce VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_nonce_expiry TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_change_password BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_admin BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_by_user_id INTEGER REFERENCES users(id);

-- Update KYC submissions for signature verification
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS submission_signature TEXT;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS submission_message TEXT;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS approval_signature TEXT;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS approval_message TEXT;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS approval_transaction_hash VARCHAR(66);

-- Update KYC documents for IPFS mandatory storage
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS ipfs_hash VARCHAR(100);
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS file_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS file_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE kyc_documents ALTER COLUMN storage_path DROP NOT NULL;
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS ipfs_url VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS upload_signature TEXT;
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS upload_message TEXT;

-- Update properties table for verifier assignment and signatures
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

-- Update property documents for IPFS mandatory storage
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS file_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS file_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) NOT NULL DEFAULT '';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_documents' AND column_name='file_path') THEN ALTER TABLE property_documents ALTER COLUMN file_path DROP NOT NULL; END IF; END $$;
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS ipfs_url VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS upload_signature TEXT;
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS upload_message TEXT;
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS verified_by INTEGER REFERENCES users(id);

-- Update property images for IPFS mandatory storage
ALTER TABLE property_images ADD COLUMN IF NOT EXISTS file_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE property_images ADD COLUMN IF NOT EXISTS file_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE property_images ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) NOT NULL DEFAULT '';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_images' AND column_name='file_path') THEN ALTER TABLE property_images ALTER COLUMN file_path DROP NOT NULL; END IF; END $$;
ALTER TABLE property_images ADD COLUMN IF NOT EXISTS ipfs_url VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE property_images ADD COLUMN IF NOT EXISTS upload_signature TEXT;
ALTER TABLE property_images ADD COLUMN IF NOT EXISTS upload_message TEXT;

-- Update investments for signature verification
ALTER TABLE investments ADD COLUMN IF NOT EXISTS investment_signature TEXT;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS investment_message TEXT;

-- Update fractional tokens for admin signatures
ALTER TABLE fractional_tokens ADD COLUMN IF NOT EXISTS creation_signature TEXT;
ALTER TABLE fractional_tokens ADD COLUMN IF NOT EXISTS creation_message TEXT;
ALTER TABLE fractional_tokens ADD COLUMN IF NOT EXISTS creation_transaction_hash VARCHAR(66);
ALTER TABLE fractional_tokens ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

-- Update revenue distributions for admin signatures
ALTER TABLE revenue_distributions ADD COLUMN IF NOT EXISTS distribution_signature TEXT;
ALTER TABLE revenue_distributions ADD COLUMN IF NOT EXISTS distribution_message TEXT;
ALTER TABLE revenue_distributions ADD COLUMN IF NOT EXISTS distributed_by INTEGER REFERENCES users(id);

-- Update secondary market listings for signatures
ALTER TABLE secondary_market_listings ADD COLUMN IF NOT EXISTS listing_signature TEXT;
ALTER TABLE secondary_market_listings ADD COLUMN IF NOT EXISTS listing_message TEXT;

-- Update secondary market trades for signatures
ALTER TABLE secondary_market_trades ADD COLUMN IF NOT EXISTS trade_signature TEXT;
ALTER TABLE secondary_market_trades ADD COLUMN IF NOT EXISTS trade_message TEXT;

-- Update asset registry for registration signatures
ALTER TABLE asset_registry ADD COLUMN IF NOT EXISTS registration_signature TEXT;
ALTER TABLE asset_registry ADD COLUMN IF NOT EXISTS registration_message TEXT;
ALTER TABLE asset_registry ADD COLUMN IF NOT EXISTS registration_transaction_hash VARCHAR(66);

-- Update verification history for signatures
ALTER TABLE verification_history ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE verification_history ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE verification_history ADD COLUMN IF NOT EXISTS transaction_hash VARCHAR(66);

-- Update action logs for wallet signatures
ALTER TABLE action_logs ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE action_logs ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE action_logs ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42);

-- Create wallet authorization sessions table
CREATE TABLE IF NOT EXISTS wallet_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_address VARCHAR(42) NOT NULL,
    session_nonce VARCHAR(100) NOT NULL,
    signature TEXT NOT NULL,
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    last_used_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create signature verifications table
CREATE TABLE IF NOT EXISTS signature_verifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    wallet_address VARCHAR(42) NOT NULL,
    action VARCHAR(100) NOT NULL,
    signature TEXT NOT NULL,
    message TEXT NOT NULL,
    is_valid BOOLEAN NOT NULL,
    target_type VARCHAR(50),
    target_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create admin actions log table
CREATE TABLE IF NOT EXISTS admin_actions (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    target_user_id INTEGER REFERENCES users(id),
    target_type VARCHAR(50),
    target_id INTEGER,
    signature TEXT,
    message TEXT,
    transaction_hash VARCHAR(66),
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create verifier assignments table
CREATE TABLE IF NOT EXISTS verifier_assignments (
    id SERIAL PRIMARY KEY,
    verifier_id INTEGER NOT NULL REFERENCES users(id),
    property_id INTEGER NOT NULL REFERENCES properties(id),
    assigned_by INTEGER NOT NULL REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'assigned',
    assigned_at TIMESTAMP DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMP,
    notes TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallet_sessions_user_id ON wallet_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_sessions_wallet_address ON wallet_sessions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_sessions_active ON wallet_sessions(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_signature_verifications_user_id ON signature_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_signature_verifications_wallet ON signature_verifications(wallet_address);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target_user ON admin_actions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_verifier_assignments_verifier ON verifier_assignments(verifier_id);
CREATE INDEX IF NOT EXISTS idx_verifier_assignments_property ON verifier_assignments(property_id);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_assigned_verifier ON properties(assigned_verifier_id);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status ON kyc_submissions(status);
CREATE INDEX IF NOT EXISTS idx_property_documents_verification_status ON property_documents(verification_status);

-- Update existing data to set default values
UPDATE kyc_documents SET file_name = 'legacy_document' WHERE file_name = '';
UPDATE kyc_documents SET file_size = 0 WHERE file_size IS NULL;
UPDATE kyc_documents SET mime_type = 'application/octet-stream' WHERE mime_type = '';
UPDATE kyc_documents SET ipfs_url = CONCAT('https://gateway.pinata.cloud/ipfs/', ipfs_hash) WHERE ipfs_url = '' AND ipfs_hash IS NOT NULL;

UPDATE property_documents SET file_name = 'legacy_document' WHERE file_name = '';
UPDATE property_documents SET file_size = 0 WHERE file_size IS NULL;
UPDATE property_documents SET mime_type = 'application/octet-stream' WHERE mime_type = '';
UPDATE property_documents SET ipfs_url = CONCAT('https://gateway.pinata.cloud/ipfs/', ipfs_hash) WHERE ipfs_url = '' AND ipfs_hash IS NOT NULL;

UPDATE property_images SET file_name = 'legacy_image' WHERE file_name = '';
UPDATE property_images SET file_size = 0 WHERE file_size IS NULL;
UPDATE property_images SET mime_type = 'image/jpeg' WHERE mime_type = '';
UPDATE property_images SET ipfs_url = CONCAT('https://gateway.pinata.cloud/ipfs/', ipfs_hash) WHERE ipfs_url = '' AND ipfs_hash IS NOT NULL;

-- Set NOT NULL constraints after updating data
-- (Columns already have NOT NULL DEFAULT '' so no additional set needed on fresh DB)
-- ALTER TABLE kyc_documents ALTER COLUMN file_name SET NOT NULL;
-- (already NOT NULL from ADD COLUMN)

-- property_documents file_name,file_size,mime_type,ipfs_url already NOT NULL from ADD COLUMN

-- property_images file_name,file_size,mime_type,ipfs_url already NOT NULL from ADD COLUMN