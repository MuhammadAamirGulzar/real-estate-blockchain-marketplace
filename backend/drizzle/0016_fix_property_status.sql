-- Fix property status: rename "pending" → "pending_assignment"
-- Properties submitted by users should start at pending_assignment (awaiting verifier assignment)
UPDATE properties SET status = 'pending_assignment' WHERE status = 'pending';
