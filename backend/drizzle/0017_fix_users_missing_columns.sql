-- Migration 0017: Add all missing columns to users table (idempotent)
-- These columns exist in schema.js but were never added to the actual DB

ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_wallet_connected BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_linked_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_wallet_signature TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nonce TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_nonce_expiry TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_change_password BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_admin BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_by_user_id INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_grant_transaction_hash VARCHAR(66);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_revoke_transaction_hash VARCHAR(66);

-- Set a placeholder password for existing rows that have NULL password
-- These users must reset their passwords via admin
UPDATE users SET password = '$2a$12$placeholder.must.be.reset.by.admin.XXXXXXXXXXXXX' WHERE password IS NULL;

-- Make password NOT NULL now that all rows have a value
-- (Only alter if column currently allows NULLs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'password'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE users ALTER COLUMN password SET NOT NULL;
  END IF;
END $$;

-- Useful indexes for sync queries
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
