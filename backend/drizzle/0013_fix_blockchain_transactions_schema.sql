-- Migration 0013: Fix blockchain_transactions table schema to match schema.js
-- 
-- CRITICAL: Schema.js and database are completely out of sync
-- This migration aligns database with schema.js definitions

-- Step 1: Rename columns to match schema.js expectations (safe - only renaming if old name exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='blockchain_transactions' AND column_name='contract_address') THEN
    ALTER TABLE blockchain_transactions RENAME COLUMN contract_address TO contract_name;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='blockchain_transactions' AND column_name='initiated_by') THEN
    ALTER TABLE blockchain_transactions RENAME COLUMN initiated_by TO "from";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='blockchain_transactions' AND column_name='error_message') THEN
    ALTER TABLE blockchain_transactions RENAME COLUMN error_message TO error;
  END IF;
END $$;

-- Step 2: Add missing columns
ALTER TABLE blockchain_transactions 
ADD COLUMN IF NOT EXISTS "to" VARCHAR(42);

ALTER TABLE blockchain_transactions 
ADD COLUMN IF NOT EXISTS confirmations INTEGER DEFAULT 0;

-- Step 3: Drop columns not in schema.js (optional - comment out if you want to keep data)
-- Keeping these for now as they may contain useful data
-- ALTER TABLE blockchain_transactions DROP COLUMN IF EXISTS function_params;
-- ALTER TABLE blockchain_transactions DROP COLUMN IF EXISTS gas_price;

-- Step 4: Update any null values in critical columns
UPDATE blockchain_transactions 
SET confirmations = 0 
WHERE confirmations IS NULL;

-- Step 5: Add table comment for documentation
COMMENT ON TABLE blockchain_transactions IS 'Tracks all blockchain transactions with complete lifecycle - updated migration 0013';

COMMENT ON COLUMN blockchain_transactions.contract_name IS 'Contract name (e.g., RoleManager, AssetRegistry)';
COMMENT ON COLUMN blockchain_transactions."from" IS 'Transaction sender address';
COMMENT ON COLUMN blockchain_transactions."to" IS 'Contract address (target)';
COMMENT ON COLUMN blockchain_transactions.confirmations IS 'Number of block confirmations';
COMMENT ON COLUMN blockchain_transactions.error IS 'Error message if transaction failed';
