-- Migration: Multi-Currency Payment System with Oracle Integration
-- Created: 2026-02-12
-- Description: Adds support for multi-currency payments (USD, PKR, AED, EUR, GBP),
--              bank transfer verification, oracle-based pricing, and payment proofs

-- ============================================================================
-- 1. CREATE NEW TABLES
-- ============================================================================

-- Supported currencies configuration
CREATE TABLE IF NOT EXISTS "supported_currencies" (
  "id" SERIAL PRIMARY KEY,
  "code" VARCHAR(10) NOT NULL UNIQUE,
  "name" VARCHAR(100) NOT NULL,
  "symbol" VARCHAR(10) NOT NULL,
  "decimals" INTEGER DEFAULT 2 NOT NULL,
  "is_crypto" BOOLEAN DEFAULT FALSE NOT NULL,
  "is_fiat" BOOLEAN DEFAULT TRUE NOT NULL,
  "is_active" BOOLEAN DEFAULT TRUE NOT NULL,
  "country_code" VARCHAR(5),
  "display_order" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW()
);

-- Currency exchange rates from oracles and manual input
CREATE TABLE IF NOT EXISTS "currency_exchange_rates" (
  "id" SERIAL PRIMARY KEY,
  "base_currency" VARCHAR(10) NOT NULL,
  "quote_currency" VARCHAR(10) NOT NULL,
  "rate" DECIMAL(18, 8) NOT NULL,
  "source" VARCHAR(30) NOT NULL,
  "oracle_chainlink_address" VARCHAR(42),
  "last_update" TIMESTAMP DEFAULT NOW() NOT NULL,
  "is_active" BOOLEAN DEFAULT TRUE NOT NULL,
  "updated_by" INTEGER REFERENCES "users"("id"),
  "confidence" INTEGER DEFAULT 100,
  "metadata" JSONB,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Bank transfer payment proofs
CREATE TABLE IF NOT EXISTS "payment_proofs" (
  "id" SERIAL PRIMARY KEY,
  "investment_id" INTEGER NOT NULL REFERENCES "investments"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "proof_type" VARCHAR(30) DEFAULT 'bank_transfer',
  "document_hash" VARCHAR(255),
  "document_url" VARCHAR(500),
  "bank_reference" VARCHAR(100),
  "transaction_reference" VARCHAR(255),
  "amount" DECIMAL(18, 2) NOT NULL,
  "currency" VARCHAR(10) NOT NULL,
  "uploaded_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "verified_by" INTEGER REFERENCES "users"("id"),
  "verified_at" TIMESTAMP,
  "verification_notes" TEXT,
  "status" VARCHAR(30) DEFAULT 'pending',
  "rejection_reason" TEXT,
  "expires_at" TIMESTAMP,
  "plaid_verification_id" VARCHAR(255),
  "stripe_payment_intent_id" VARCHAR(255)
);

-- Property valuations from oracles and manual appraisals
CREATE TABLE IF NOT EXISTS "property_valuations" (
  "id" SERIAL PRIMARY KEY,
  "property_id" INTEGER NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "valuation_amount" DECIMAL(18, 2) NOT NULL,
  "currency" VARCHAR(10) DEFAULT 'USD' NOT NULL,
  "valuation_date" TIMESTAMP DEFAULT NOW() NOT NULL,
  "valuation_type" VARCHAR(30) NOT NULL,
  "oracle_source" VARCHAR(50),
  "oracle_data_hash" VARCHAR(255),
  "appraiser_wallet" VARCHAR(42),
  "appraiser_name" VARCHAR(255),
  "confidence" INTEGER DEFAULT 100,
  "metadata" JSONB,
  "approved_by" INTEGER REFERENCES "users"("id"),
  "approved_at" TIMESTAMP,
  "is_active" BOOLEAN DEFAULT TRUE,
  "verification_transaction_hash" VARCHAR(66),
  "notes" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Bank account details for payment instructions
CREATE TABLE IF NOT EXISTS "bank_payment_instructions" (
  "id" SERIAL PRIMARY KEY,
  "currency" VARCHAR(10) NOT NULL,
  "region" VARCHAR(10) NOT NULL,
  "bank_name" VARCHAR(255) NOT NULL,
  "account_holder" VARCHAR(255) NOT NULL,
  "account_number" TEXT NOT NULL,
  "routing_number" VARCHAR(50),
  "swift_code" VARCHAR(20),
  "iban" VARCHAR(50),
  "bank_address" TEXT,
  "reference_prefix" VARCHAR(20) DEFAULT 'RWA-INV',
  "instructions" TEXT,
  "is_active" BOOLEAN DEFAULT TRUE NOT NULL,
  "display_order" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 2. ALTER EXISTING TABLES
-- ============================================================================

-- Extend investments table with multi-currency support
ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "payment_currency" VARCHAR(10) DEFAULT 'USD';
ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "fiat_amount" DECIMAL(18, 2);
ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "exchange_rate_at_purchase" DECIMAL(18, 8);
ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "payment_method" VARCHAR(30);
ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "payment_proof_id" INTEGER REFERENCES "payment_proofs"("id");
ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "payment_status" VARCHAR(30) DEFAULT 'pending_proof';
ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "escrow_transaction_hash" VARCHAR(66);
ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP;

-- Extend properties table with currency and oracle fields
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "base_currency" VARCHAR(10) DEFAULT 'USD';
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "current_market_price" DECIMAL(18, 2);
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "last_price_update" TIMESTAMP;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "oracle_enabled" BOOLEAN DEFAULT FALSE;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "manual_price_override" DECIMAL(18, 2);
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "price_source" VARCHAR(20) DEFAULT 'manual';

-- ============================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Currency exchange rates - frequently queried
CREATE INDEX IF NOT EXISTS "idx_exchange_rates_currencies" ON "currency_exchange_rates"("base_currency", "quote_currency");
CREATE INDEX IF NOT EXISTS "idx_exchange_rates_active" ON "currency_exchange_rates"("is_active", "last_update");

-- Payment proofs - frequent status checks
CREATE INDEX IF NOT EXISTS "idx_payment_proofs_status" ON "payment_proofs"("status");
CREATE INDEX IF NOT EXISTS "idx_payment_proofs_investment" ON "payment_proofs"("investment_id");
CREATE INDEX IF NOT EXISTS "idx_payment_proofs_user" ON "payment_proofs"("user_id");
CREATE INDEX IF NOT EXISTS "idx_payment_proofs_reference" ON "payment_proofs"("bank_reference");

-- Property valuations - latest valuations frequently accessed
CREATE INDEX IF NOT EXISTS "idx_property_valuations_property" ON "property_valuations"("property_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_property_valuations_date" ON "property_valuations"("valuation_date" DESC);

-- Investments - payment method filtering
CREATE INDEX IF NOT EXISTS "idx_investments_payment_status" ON "investments"("payment_status");
CREATE INDEX IF NOT EXISTS "idx_investments_payment_method" ON "investments"("payment_method");

-- ============================================================================
-- 4. SEED INITIAL DATA
-- ============================================================================

-- Insert supported fiat currencies
INSERT INTO "supported_currencies" ("code", "name", "symbol", "decimals", "is_crypto", "is_fiat", "is_active", "country_code", "display_order") VALUES
  ('USD', 'United States Dollar', '$', 2, FALSE, TRUE, TRUE, 'US', 1),
  ('PKR', 'Pakistani Rupee', '₨', 2, FALSE, TRUE, TRUE, 'PK', 2),
  ('AED', 'United Arab Emirates Dirham', 'د.إ', 2, FALSE, TRUE, TRUE, 'AE', 3),
  ('EUR', 'Euro', '€', 2, FALSE, TRUE, TRUE, 'EU', 4),
  ('GBP', 'British Pound Sterling', '£', 2, FALSE, TRUE, TRUE, 'GB', 5)
ON CONFLICT (code) DO NOTHING;

-- Insert supported cryptocurrencies
INSERT INTO "supported_currencies" ("code", "name", "symbol", "decimals", "is_crypto", "is_fiat", "is_active", "country_code", "display_order") VALUES
  ('RWAP', 'RWA Platform Token', 'RWAP', 18, TRUE, FALSE, TRUE, NULL, 10),
  ('ETH', 'Ethereum', 'ETH', 18, TRUE, FALSE, TRUE, NULL, 11),
  ('USDC', 'USD Coin', 'USDC', 6, TRUE, FALSE, TRUE, NULL, 12),
  ('USDT', 'Tether USD', 'USDT', 6, TRUE, FALSE, TRUE, NULL, 13)
ON CONFLICT (code) DO NOTHING;

-- Insert initial exchange rates (placeholder - will be updated by oracle service)
INSERT INTO "currency_exchange_rates" ("base_currency", "quote_currency", "rate", "source", "confidence") VALUES
  ('USD', 'PKR', 277.89, 'manual', 80),
  ('USD', 'AED', 3.67, 'manual', 80),
  ('USD', 'EUR', 0.92, 'manual', 80),
  ('USD', 'GBP', 0.79, 'manual', 80),
  ('USD', 'ETH', 0.00037, 'manual', 80),
  ('USD', 'USDC', 1.00, 'manual', 100),
  ('USD', 'USDT', 1.00, 'manual', 100)
ON CONFLICT DO NOTHING;

-- Insert sample bank payment instructions (PLACEHOLDER - Replace with real data)
INSERT INTO "bank_payment_instructions" ("currency", "region", "bank_name", "account_holder", "account_number", "swift_code", "instructions", "is_active", "display_order") VALUES
  ('USD', 'US', 'Bank of America', 'RWA Platform LLC', 'ENCRYPTED_ACCOUNT_1234', 'BOFAUS3N', 'Include reference number in wire transfer memo', TRUE, 1),
  ('PKR', 'PK', 'Habib Bank Limited', 'RWA Platform Pakistan', 'ENCRYPTED_ACCOUNT_5678', 'HABBPKKA', 'Include reference number in deposit slip', TRUE, 2),
  ('AED', 'AE', 'Emirates NBD', 'RWA Platform DMCC', 'ENCRYPTED_ACCOUNT_9012', 'EBILAEAD', 'Include reference number in transfer description', TRUE, 3),
  ('EUR', 'EU', 'Deutsche Bank', 'RWA Platform Europe', 'ENCRYPTED_IBAN_3456', 'DEUTDEFF', 'Include reference number in SEPA transfer', TRUE, 4),
  ('GBP', 'GB', 'Barclays Bank', 'RWA Platform UK Ltd', 'ENCRYPTED_ACCOUNT_7890', 'BARCGB22', 'Include reference number in faster payment', TRUE, 5)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE "supported_currencies" IS 'Configuration for all supported fiat and crypto currencies';
COMMENT ON TABLE "currency_exchange_rates" IS 'Real-time exchange rates from Chainlink oracles and fallback APIs';
COMMENT ON TABLE "payment_proofs" IS 'User-uploaded bank transfer proofs for manual verification';
COMMENT ON TABLE "property_valuations" IS 'Historical property price valuations from oracles and appraisers';
COMMENT ON TABLE "bank_payment_instructions" IS 'Bank account details for receiving payments in different currencies';

COMMENT ON COLUMN "currency_exchange_rates"."source" IS 'chainlink | manual | stripe_api | coingecko | alpha_vantage';
COMMENT ON COLUMN "currency_exchange_rates"."confidence" IS 'Confidence score 0-100, lower for manual entries';
COMMENT ON COLUMN "payment_proofs"."status" IS 'pending | verified | rejected | expired';
COMMENT ON COLUMN "property_valuations"."valuation_type" IS 'initial | market_update | oracle_feed | admin_override';
COMMENT ON COLUMN "investments"."payment_method" IS 'crypto_rwap | crypto_eth | crypto_usdc | crypto_usdt | bank_transfer | stripe';
COMMENT ON COLUMN "investments"."payment_status" IS 'pending_proof | pending_verification | verified | completed | failed';
COMMENT ON COLUMN "properties"."price_source" IS 'chainlink | manual | hybrid';

-- ============================================================================
-- Migration Complete
-- ============================================================================
