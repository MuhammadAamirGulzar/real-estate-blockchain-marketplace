-- Fix wallet column names to match schema.js
-- Migration: 0005_fix_wallet_columns
-- This migration aligns the database schema with schema.js definitions

-- Rename wallet_connected_at to wallet_linked_at
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'wallet_connected_at'
    ) THEN
        ALTER TABLE users RENAME COLUMN wallet_connected_at TO wallet_linked_at;
    END IF;
END $$;

-- Rename wallet_nonce to nonce
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'wallet_nonce'
    ) THEN
        ALTER TABLE users RENAME COLUMN wallet_nonce TO nonce;
    END IF;
END $$;

-- Add missing columns that should exist based on schema.js
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_wallet_connected BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_grant_transaction_hash VARCHAR(66);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_revoke_transaction_hash VARCHAR(66);

-- Make wallet_address nullable and change to TEXT type
ALTER TABLE users ALTER COLUMN wallet_address DROP NOT NULL;
ALTER TABLE users ALTER COLUMN wallet_address TYPE TEXT;

-- Ensure email is nullable (for admin-created accounts)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Ensure password is nullable (for admin-created accounts)
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- Update is_wallet_connected for existing records
UPDATE users SET is_wallet_connected = (wallet_address IS NOT NULL AND wallet_address != '');

-- Set default empty string for nonce if null
UPDATE users SET nonce = '' WHERE nonce IS NULL;
ALTER TABLE users ALTER COLUMN nonce SET DEFAULT '';

-- Add missing columns to kyc_submissions
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
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS submission_transaction_hash VARCHAR(66);
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS rejection_transaction_hash VARCHAR(66);

-- Add ipfs_hash column to kyc_documents if missing
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS ipfs_hash VARCHAR(100);

-- Make kyc_documents.storage_path nullable (since IPFS is primary)
ALTER TABLE kyc_documents ALTER COLUMN storage_path DROP NOT NULL;

-- Add ipfs_hash column to property_documents if missing
ALTER TABLE property_documents ADD COLUMN IF NOT EXISTS ipfs_hash VARCHAR(100);

-- Add ipfs_hash column to property_images if missing
ALTER TABLE property_images ADD COLUMN IF NOT EXISTS ipfs_hash VARCHAR(100);

-- Add updated_at to users if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();
