-- Migration: Multi-Transaction Workflow Tracking and IPFS Cleanup
-- Created: 2026-02-16
-- Description: Adds workflow tracking for multi-step blockchain transactions,
--              IPFS upload tracking for cleanup on transaction failures,
--              and explicit state management for atomic operations

-- ============================================================================
-- 0. CREATE BLOCKCHAIN TRANSACTIONS TABLE (base table, created here)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "blockchain_transactions" (
  "id" SERIAL PRIMARY KEY,
  "transaction_hash" VARCHAR(66) UNIQUE,
  "contract_name" VARCHAR(50) NOT NULL,
  "function_name" VARCHAR(100) NOT NULL,
  "from" VARCHAR(42) NOT NULL DEFAULT '0x0000000000000000000000000000000000000000',
  "to" VARCHAR(42) NOT NULL DEFAULT '0x0000000000000000000000000000000000000000',
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "confirmations" INTEGER DEFAULT 0,
  "block_number" INTEGER,
  "gas_used" VARCHAR(50),
  "error" TEXT,
  "related_entity_type" VARCHAR(30),
  "related_entity_id" INTEGER,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "confirmed_at" TIMESTAMP
);

-- Remove placeholder defaults after creation (real txs will provide real addresses)
ALTER TABLE "blockchain_transactions" ALTER COLUMN "from" DROP DEFAULT;
ALTER TABLE "blockchain_transactions" ALTER COLUMN "to" DROP DEFAULT;

-- ============================================================================
-- 1. ALTER BLOCKCHAIN TRANSACTIONS TABLE FOR WORKFLOW TRACKING
-- ============================================================================

-- Add workflow tracking columns to group related transactions
ALTER TABLE "blockchain_transactions" 
  ADD COLUMN IF NOT EXISTS "workflow_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "workflow_type" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "step_number" INTEGER,
  ADD COLUMN IF NOT EXISTS "step_description" TEXT,
  ADD COLUMN IF NOT EXISTS "parent_transaction_id" INTEGER REFERENCES "blockchain_transactions"("id");

-- Add index for efficient workflow queries
CREATE INDEX IF NOT EXISTS "idx_blockchain_transactions_workflow_id" 
  ON "blockchain_transactions"("workflow_id");

CREATE INDEX IF NOT EXISTS "idx_blockchain_transactions_workflow_type" 
  ON "blockchain_transactions"("workflow_type");

CREATE INDEX IF NOT EXISTS "idx_blockchain_transactions_status" 
  ON "blockchain_transactions"("status");

-- Add composite index for workflow queries
CREATE INDEX IF NOT EXISTS "idx_blockchain_transactions_workflow_lookup" 
  ON "blockchain_transactions"("workflow_id", "step_number", "status");

-- ============================================================================
-- 2. CREATE IPFS UPLOADS TABLE FOR TRACKING AND CLEANUP
-- ============================================================================

CREATE TABLE IF NOT EXISTS "ipfs_uploads" (
  "id" SERIAL PRIMARY KEY,
  "cid" VARCHAR(255) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "linked_transaction_id" INTEGER REFERENCES "blockchain_transactions"("id"),
  "workflow_id" VARCHAR(255),
  "content_type" VARCHAR(50),
  "file_name" VARCHAR(500),
  "file_size" BIGINT,
  "uploader_user_id" INTEGER REFERENCES "users"("id"),
  "related_entity_type" VARCHAR(30),
  "related_entity_id" INTEGER,
  "metadata" JSONB,
  "unpin_attempted" BOOLEAN DEFAULT FALSE,
  "unpin_attempted_at" TIMESTAMP,
  "unpin_error" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW()
);

-- Add indexes for IPFS cleanup queries
CREATE INDEX IF NOT EXISTS "idx_ipfs_uploads_status" 
  ON "ipfs_uploads"("status");

CREATE INDEX IF NOT EXISTS "idx_ipfs_uploads_workflow_id" 
  ON "ipfs_uploads"("workflow_id");

CREATE INDEX IF NOT EXISTS "idx_ipfs_uploads_created_at" 
  ON "ipfs_uploads"("created_at");

-- Composite index for cleanup job (find orphaned content)
CREATE INDEX IF NOT EXISTS "idx_ipfs_uploads_cleanup_lookup" 
  ON "ipfs_uploads"("status", "created_at") 
  WHERE "status" = 'orphaned';

-- ============================================================================
-- 3. CREATE WORKFLOW STATE TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "transaction_workflows" (
  "id" SERIAL PRIMARY KEY,
  "workflow_id" VARCHAR(255) NOT NULL UNIQUE,
  "workflow_type" VARCHAR(50) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "total_steps" INTEGER NOT NULL,
  "completed_steps" INTEGER DEFAULT 0,
  "current_step" INTEGER DEFAULT 1,
  "initiated_by_user_id" INTEGER REFERENCES "users"("id"),
  "related_entity_type" VARCHAR(30),
  "related_entity_id" INTEGER,
  "error_message" TEXT,
  "retry_count" INTEGER DEFAULT 0,
  "last_retry_at" TIMESTAMP,
  "metadata" JSONB,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW(),
  "completed_at" TIMESTAMP
);

-- Add indexes for workflow state queries
CREATE INDEX IF NOT EXISTS "idx_transaction_workflows_workflow_type" 
  ON "transaction_workflows"("workflow_type");

CREATE INDEX IF NOT EXISTS "idx_transaction_workflows_status" 
  ON "transaction_workflows"("status");

CREATE INDEX IF NOT EXISTS "idx_transaction_workflows_user_id" 
  ON "transaction_workflows"("initiated_by_user_id");

-- Composite index for admin recovery endpoints
CREATE INDEX IF NOT EXISTS "idx_transaction_workflows_recovery_lookup" 
  ON "transaction_workflows"("status", "workflow_type", "created_at") 
  WHERE "status" IN ('pending', 'failed');

-- ============================================================================
-- 4. ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN "blockchain_transactions"."workflow_id" IS 'UUID grouping related transactions in a multi-step workflow';
COMMENT ON COLUMN "blockchain_transactions"."workflow_type" IS 'Type: property_submission, tokenization, investment, property_verification, kyc_approval';
COMMENT ON COLUMN "blockchain_transactions"."step_number" IS 'Sequence number within the workflow (1, 2, 3...)';
COMMENT ON COLUMN "blockchain_transactions"."step_description" IS 'Human-readable description of this transaction step';

COMMENT ON TABLE "ipfs_uploads" IS 'Tracks IPFS content uploads for cleanup when blockchain transactions fail';
COMMENT ON COLUMN "ipfs_uploads"."status" IS 'Status: pending, confirmed, orphaned, cleaned';
COMMENT ON COLUMN "ipfs_uploads"."cid" IS 'IPFS Content Identifier (hash)';

COMMENT ON TABLE "transaction_workflows" IS 'High-level workflow state tracking for multi-step blockchain operations';
COMMENT ON COLUMN "transaction_workflows"."status" IS 'Status: pending, in_progress, completed, failed, retrying';

-- ============================================================================
-- 5. UPDATE EXISTING DATA (BACKFILL)
-- ============================================================================

-- Set workflow_type based on existing relatedEntityType for analytics
UPDATE "blockchain_transactions" 
SET "workflow_type" = 
  CASE 
    WHEN "related_entity_type" = 'kyc' THEN 'kyc_approval'
    WHEN "related_entity_type" = 'property' AND "function_name" LIKE '%list%' THEN 'property_submission'
    WHEN "related_entity_type" = 'property' AND "function_name" LIKE '%verify%' THEN 'property_verification'
    WHEN "related_entity_type" = 'property' AND "function_name" LIKE '%mint%' THEN 'tokenization'
    WHEN "related_entity_type" = 'investment' THEN 'investment'
    ELSE 'unknown'
  END
WHERE "workflow_type" IS NULL;

-- Set step_number to 1 for existing transactions (assume single-step workflows)
UPDATE "blockchain_transactions" 
SET "step_number" = 1 
WHERE "step_number" IS NULL;
