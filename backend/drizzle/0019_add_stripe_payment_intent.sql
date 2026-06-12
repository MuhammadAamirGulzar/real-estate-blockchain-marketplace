-- Migration 0019: Add Stripe payment intent ID to investments table
ALTER TABLE investments ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255);
