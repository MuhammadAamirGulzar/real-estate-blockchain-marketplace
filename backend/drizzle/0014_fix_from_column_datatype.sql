-- Migration 0014: Fix blockchain_transactions "from" column data type
-- 
-- Problem: Column "from" was renamed from "initiated_by" which was INTEGER (foreign key)
-- Solution: Drop and recreate with correct VARCHAR(42) type for Ethereum addresses

-- Step 1: Drop the incorrect "from" column
ALTER TABLE blockchain_transactions 
DROP COLUMN IF EXISTS "from" CASCADE;

-- Step 2: Add "from" column with correct type for Ethereum addresses  
ALTER TABLE blockchain_transactions 
ADD COLUMN "from" VARCHAR(42) NOT NULL DEFAULT '0x0000000000000000000000000000000000000000';

-- Step 3: Remove default constraint (was only needed for ALTER TABLE)
ALTER TABLE blockchain_transactions 
ALTER COLUMN "from" DROP DEFAULT;

-- Step 4: Add comment
COMMENT ON COLUMN blockchain_transactions."from" IS 'Transaction sender Ethereum address (42 chars with 0x prefix)';

-- Step 5: Ensure "to" column is also correct type
ALTER TABLE blockchain_transactions 
ALTER COLUMN "to" TYPE VARCHAR(42);

COMMENT ON COLUMN blockchain_transactions."to" IS 'Transaction recipient/contract Ethereum address';
