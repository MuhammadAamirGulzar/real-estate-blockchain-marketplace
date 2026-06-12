-- Migration 0020: Add missing assignment_transaction_hash column to verifier_assignments
ALTER TABLE verifier_assignments ADD COLUMN IF NOT EXISTS assignment_transaction_hash VARCHAR(66);
