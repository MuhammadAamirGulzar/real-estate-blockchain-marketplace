-- Migration: Fix transaction_hash to allow NULL (set after blockchain tx is sent)
-- Issue: Code inserts pending record first, then updates with hash after tx is sent
-- But database has NOT NULL constraint on transaction_hash

-- Fix: Remove NOT NULL constraint from transaction_hash
ALTER TABLE blockchain_transactions 
ALTER COLUMN transaction_hash DROP NOT NULL;

-- Fix: Ensure status has NOT NULL constraint with default (matches schema.js)
ALTER TABLE blockchain_transactions 
ALTER COLUMN status SET NOT NULL;

ALTER TABLE blockchain_transactions 
ALTER COLUMN status SET DEFAULT 'pending';

-- Fix: Ensure to has NOT NULL constraint (matches schema.js)
ALTER TABLE blockchain_transactions 
ALTER COLUMN "to" SET NOT NULL;

-- Fix: Ensure confirmations has default 0 (matches schema.js)
ALTER TABLE blockchain_transactions 
ALTER COLUMN confirmations SET DEFAULT 0;
