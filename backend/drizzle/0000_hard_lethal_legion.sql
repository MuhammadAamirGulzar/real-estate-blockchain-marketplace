CREATE TABLE IF NOT EXISTS "action_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"performed_by" integer NOT NULL,
	"action" varchar(100) NOT NULL,
	"target_user_id" integer,
	"target_type" varchar(50),
	"target_id" integer,
	"details" jsonb,
	"ip_address" varchar(50),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_lister_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_name" varchar(255),
	"registration_id" varchar(100),
	"business_address" text,
	"business_type" varchar(100),
	"years_in_business" integer,
	"business_license_document_id" integer,
	"property_proof_document_id" integer,
	"additional_documents" jsonb,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by" integer,
	"rejection_reason" text,
	"admin_notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_registry" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" bigint NOT NULL,
	"owner_address" varchar(42) NOT NULL,
	"asset_type" varchar(100),
	"metadata_uri" varchar(500),
	"is_active" boolean DEFAULT true,
	"created_at_chain" bigint,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_registry_asset_id_unique" UNIQUE("asset_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fractional_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"token_contract_address" varchar(42) NOT NULL,
	"total_supply" numeric(36, 18) NOT NULL,
	"decimals" integer DEFAULT 18,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fractional_tokens_token_contract_address_unique" UNIQUE("token_contract_address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "investments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"property_id" integer NOT NULL,
	"amount_paid_rwa_token" numeric(36, 18) NOT NULL,
	"fractional_tokens_received" numeric(36, 18) NOT NULL,
	"transaction_hash" varchar(66) NOT NULL,
	"invested_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "investments_transaction_hash_unique" UNIQUE("transaction_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "investor_holdings" (
	"id" serial PRIMARY KEY NOT NULL,
	"investor_id" integer NOT NULL,
	"fractional_token_id" integer NOT NULL,
	"balance" numeric(36, 18) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"submission_id" integer,
	"document_type" varchar(100) NOT NULL,
	"storage_path" varchar(255) NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewed_by" integer,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp,
	"rejection_reason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"lister_id" integer NOT NULL,
	"asset_registry_id" bigint,
	"title" varchar(255) NOT NULL,
	"description" text,
	"location" varchar(255),
	"property_value" numeric(18, 2) NOT NULL,
	"metadata_url" varchar(500),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"nft_token_id" integer,
	"fractional_token_address" varchar(42),
	"total_fractional_supply" numeric(36, 18),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"verified_at" timestamp,
	"verified_by" integer,
	CONSTRAINT "properties_nft_token_id_unique" UNIQUE("nft_token_id"),
	CONSTRAINT "properties_fractional_token_address_unique" UNIQUE("fractional_token_address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "property_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"document_type" varchar(100) NOT NULL,
	"file_path" varchar(255) NOT NULL,
	"ipfs_hash" varchar(100),
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "property_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"file_path" varchar(255) NOT NULL,
	"ipfs_hash" varchar(100),
	"is_primary" boolean DEFAULT false,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "revenue_distributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"total_revenue" numeric(36, 18) NOT NULL,
	"distribution_date" timestamp NOT NULL,
	"transaction_hash" varchar(66),
	"status" varchar(20) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "revenue_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"distribution_id" integer NOT NULL,
	"investor_id" integer NOT NULL,
	"share_amount" numeric(36, 18) NOT NULL,
	"tokens_held" numeric(36, 18) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "secondary_market_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" integer NOT NULL,
	"fractional_token_id" integer NOT NULL,
	"amount" numeric(36, 18) NOT NULL,
	"price_per_token" numeric(36, 18) NOT NULL,
	"status" varchar(20) DEFAULT 'active',
	"listed_at" timestamp DEFAULT now() NOT NULL,
	"sold_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "secondary_market_trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"buyer_id" integer NOT NULL,
	"amount" numeric(36, 18) NOT NULL,
	"price_per_token" numeric(36, 18) NOT NULL,
	"total_price" numeric(36, 18) NOT NULL,
	"transaction_hash" varchar(66) NOT NULL,
	"traded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "secondary_market_trades_transaction_hash_unique" UNIQUE("transaction_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"email" varchar(255),
	"first_name" varchar(100),
	"last_name" varchar(100),
	"phone_number" varchar(50),
	"address" text,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"kyc_status" varchar(20) DEFAULT 'not_submitted' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"verification_type" varchar(20),
	"previous_status" varchar(30),
	"new_status" varchar(30) NOT NULL,
	"reviewed_by" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_lister_verifications" ADD CONSTRAINT "asset_lister_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_lister_verifications" ADD CONSTRAINT "asset_lister_verifications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fractional_tokens" ADD CONSTRAINT "fractional_tokens_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "investments" ADD CONSTRAINT "investments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "investments" ADD CONSTRAINT "investments_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "investor_holdings" ADD CONSTRAINT "investor_holdings_investor_id_users_id_fk" FOREIGN KEY ("investor_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "investor_holdings" ADD CONSTRAINT "investor_holdings_fractional_token_id_fractional_tokens_id_fk" FOREIGN KEY ("fractional_token_id") REFERENCES "fractional_tokens"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "properties" ADD CONSTRAINT "properties_lister_id_users_id_fk" FOREIGN KEY ("lister_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "properties" ADD CONSTRAINT "properties_asset_registry_id_asset_registry_asset_id_fk" FOREIGN KEY ("asset_registry_id") REFERENCES "asset_registry"("asset_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "properties" ADD CONSTRAINT "properties_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "property_images" ADD CONSTRAINT "property_images_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "revenue_distributions" ADD CONSTRAINT "revenue_distributions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "revenue_shares" ADD CONSTRAINT "revenue_shares_distribution_id_revenue_distributions_id_fk" FOREIGN KEY ("distribution_id") REFERENCES "revenue_distributions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "revenue_shares" ADD CONSTRAINT "revenue_shares_investor_id_users_id_fk" FOREIGN KEY ("investor_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "secondary_market_listings" ADD CONSTRAINT "secondary_market_listings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "secondary_market_listings" ADD CONSTRAINT "secondary_market_listings_fractional_token_id_fractional_tokens_id_fk" FOREIGN KEY ("fractional_token_id") REFERENCES "fractional_tokens"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "secondary_market_trades" ADD CONSTRAINT "secondary_market_trades_listing_id_secondary_market_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "secondary_market_listings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "secondary_market_trades" ADD CONSTRAINT "secondary_market_trades_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verification_history" ADD CONSTRAINT "verification_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verification_history" ADD CONSTRAINT "verification_history_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
