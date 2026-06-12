import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  decimal,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// === Core User & Auth Table ===
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  walletAddress: text("wallet_address").unique().default(null),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 50 }),
  address: text("address"),
  // Role hierarchy: 'user', 'verifier', 'subadmin', 'admin'
  role: varchar("role", { length: 20 }).default("user").notNull(),
  // Wallet authorization tracking
  walletLinkedAt: timestamp("wallet_linked_at", { mode: "date" }).defaultNow(),
  lastWalletSignature: text("last_wallet_signature"),
  nonce: text("nonce").default(""), // Added default to avoid not-null issues on existing rows
  walletNonceExpiry: timestamp("wallet_nonce_expiry"),
  // Admin-controlled fields
  canChangePassword: boolean("can_change_password").default(true),
  createdByAdmin: boolean("created_by_admin").default(false),
  assignedByUserId: integer("assigned_by_user_id").references(() => users.id),
  // KYC status for basic investment permissions
  kycStatus: varchar("kyc_status", { length: 20 })
    .default("not_submitted")
    .notNull(),
  isWalletConnected: boolean("is_wallet_connected").default(false),
  // Blockchain role management tracking
  roleGrantTransactionHash: varchar("role_grant_transaction_hash", {
    length: 66,
  }),
  roleRevokeTransactionHash: varchar("role_revoke_transaction_hash", {
    length: 66,
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === Standard KYC for Investors ===
export const kycSubmissions = pgTable("kyc_submissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  walletAddress: varchar("wallet_address", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  dateOfBirth: timestamp("date_of_birth", { mode: "date" }).notNull(),
  nationality: varchar("nationality", { length: 100 }).notNull(),
  address: text("address").notNull(),
  city: varchar("city", { length: 150 }).notNull(),
  postalCode: varchar("postal_code", { length: 20 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  documentHash: varchar("document_hash", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // 'pending', 'approved', 'rejected'
  reviewedBy: integer("reviewed_by").references(() => users.id),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  // Wallet signature verification for KYC submission
  submissionSignature: text("submission_signature"),
  submissionMessage: text("submission_message"),
  // Admin/Subadmin signature for approval
  approvalSignature: text("approval_signature"),
  approvalMessage: text("approval_message"),
  approvalTransactionHash: varchar("approval_transaction_hash", { length: 66 }),
  submissionTransactionHash: varchar("submission_transaction_hash", {
    length: 66,
  }),
  rejectionTransactionHash: varchar("rejection_transaction_hash", {
    length: 66,
  }),
});

// === In-depth Verification for Property Listers ===
export const assetListerVerifications = pgTable("asset_lister_verifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  companyName: varchar("company_name", { length: 255 }),
  registrationId: varchar("registration_id", { length: 100 }),
  businessAddress: text("business_address"),
  businessType: varchar("business_type", { length: 100 }),
  yearsInBusiness: integer("years_in_business"),
  businessLicenseDocumentId: integer("business_license_document_id"),
  propertyProofDocumentId: integer("property_proof_document_id"),
  additionalDocuments: jsonb("additional_documents"), // Array of document IDs
  status: varchar("status", { length: 30 }).default("pending").notNull(), // 'pending', 'approved', 'rejected', 'requires_resubmission'
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  rejectionReason: text("rejection_reason"),
  adminNotes: text("admin_notes"),
});

// === Verifier Applications ===
export const verifierApplications = pgTable("verifier_applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  experience: text("experience").notNull(),
  qualifications: text("qualifications").notNull(),
  specialization: varchar("specialization", { length: 255 }).notNull(),
  documentsHash: varchar("documents_hash", { length: 255 }),
  walletAddress: varchar("wallet_address", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  approvalTransactionHash: varchar("approval_transaction_hash", { length: 66 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// === Document Storage (for both KYC types) ===
export const kycDocuments = pgTable("kyc_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  submissionId: integer("submission_id"), // Can link to either kycSubmissions or assetListerVerifications
  documentType: varchar("document_type", { length: 100 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  storagePath: varchar("storage_path", { length: 255 }), // Local fallback path
  ipfsHash: varchar("ipfs_hash", { length: 100 }).default(""), // Populated after IPFS upload
  ipfsUrl: varchar("ipfs_url", { length: 500 }).default(""),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  // Signature verification for document upload
  uploadSignature: text("upload_signature"),
  uploadMessage: text("upload_message"),
});

// === Property & Investment Tables ===
export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  listerId: integer("lister_id")
    .notNull()
    .references(() => users.id),
  assetRegistryId: bigint("asset_registry_id", { mode: "bigint" }).references(
    () => assetRegistry.assetId,
  ),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 255 }),
  propertyType: varchar("property_type", { length: 50 }), // 'residential', 'commercial', 'land', 'mixed-use'
  propertyValue: decimal("property_value", {
    precision: 18,
    scale: 2,
  }).notNull(),
  metadataUrl: varchar("metadata_url", { length: 500 }),
  status: varchar("status", { length: 20 })
    .notNull()
    .default("pending_assignment"), // 'awaiting_blockchain', 'pending_assignment', 'verification_pending', 'verified', 'rejected', 'tokenized', 'active'
  nftTokenId: integer("nft_token_id").unique(),
  fractionalTokenAddress: varchar("fractional_token_address", {
    length: 42,
  }).unique(),
  totalFractionalSupply: decimal("total_fractional_supply", {
    precision: 36,
    scale: 18,
  }),
  // Multi-currency and oracle pricing fields
  baseCurrency: varchar("base_currency", { length: 10 }).default("USD"), // USD, PKR, AED, EUR, GBP
  currentMarketPrice: decimal("current_market_price", {
    precision: 18,
    scale: 2,
  }),
  lastPriceUpdate: timestamp("last_price_update"),
  oracleEnabled: boolean("oracle_enabled").default(false),
  manualPriceOverride: decimal("manual_price_override", {
    precision: 18,
    scale: 2,
  }),
  priceSource: varchar("price_source", { length: 20 }).default("manual"), // chainlink, manual, hybrid
  createdAt: timestamp("created_at").defaultNow().notNull(),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: integer("verified_by").references(() => users.id),
  // Verifier assignment by Admin/Subadmin
  assignedVerifierId: integer("assigned_verifier_id").references(
    () => users.id,
  ),
  assignedAt: timestamp("assigned_at"),
  assignedBy: integer("assigned_by").references(() => users.id),
  verifierAssignmentTransactionHash: varchar(
    "verifier_assignment_transaction_hash",
    { length: 66 },
  ),
  // Signature verification for property submission
  submissionSignature: text("submission_signature"),
  submissionMessage: text("submission_message"),
  listingTransactionHash: varchar("listing_transaction_hash", { length: 66 }),
  // Verification signatures
  verificationSignature: text("verification_signature"),
  verificationMessage: text("verification_message"),
  verificationTransactionHash: varchar("verification_transaction_hash", {
    length: 66,
  }),
  // Rejection handling
  rejectionReason: text("rejection_reason"),
  rejectedAt: timestamp("rejected_at"),
  rejectedBy: integer("rejected_by").references(() => users.id),
  // Tokenization signatures (Admin only)
  tokenizationSignature: text("tokenization_signature"),
  tokenizationMessage: text("tokenization_message"),
  tokenizationTransactionHash: varchar("tokenization_transaction_hash", {
    length: 66,
  }),
  // ─── Extended property details (RWA professional fields) ─────────────────
  streetAddress: varchar("street_address", { length: 500 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }),
  unitNumber: varchar("unit_number", { length: 50 }),
  floorNumber: integer("floor_number"),
  totalArea: decimal("total_area", { precision: 12, scale: 2 }),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  yearBuilt: integer("year_built"),
  propertyCondition: varchar("property_condition", { length: 50 }),
  amenities: text("amenities"), // JSON array stored as text
  imageUrls: text("image_urls"), // JSON array stored as text
  highlights: text("highlights"),
  titleDeedNumber: varchar("title_deed_number", { length: 200 }),
  monthlyRentalIncome: decimal("monthly_rental_income", {
    precision: 18,
    scale: 2,
  }),
  projectedRoi: decimal("projected_roi", { precision: 8, scale: 4 }),
  tokenPrice: decimal("token_price", { precision: 18, scale: 8 }),
  tokensSold: decimal("tokens_sold", { precision: 36, scale: 18 }).default("0"),
});

export const investments = pgTable("investments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  propertyId: integer("property_id")
    .notNull()
    .references(() => properties.id),
  amountPaidRwaToken: decimal("amount_paid_rwa_token", {
    precision: 36,
    scale: 18,
  }).notNull(),
  fractionalTokensReceived: decimal("fractional_tokens_received", {
    precision: 36,
    scale: 18,
  }).notNull(),
  transactionHash: varchar("transaction_hash", { length: 66 })
    .notNull()
    .unique(),
  investedAt: timestamp("invested_at").defaultNow().notNull(),
  // Signature verification for investment
  investmentSignature: text("investment_signature"),
  investmentMessage: text("investment_message"),
  // Multi-currency payment fields
  paymentCurrency: varchar("payment_currency", { length: 10 }).default("USD"), // USD, PKR, AED, EUR, GBP
  fiatAmount: decimal("fiat_amount", { precision: 18, scale: 2 }), // Amount in selected currency
  exchangeRateAtPurchase: decimal("exchange_rate_at_purchase", {
    precision: 18,
    scale: 8,
  }), // Rate when investment made
  paymentMethod: varchar("payment_method", { length: 30 }), // crypto_rwap, crypto_eth, crypto_usdc, crypto_usdt, bank_transfer, stripe
  paymentProofId: integer("payment_proof_id").references(
    () => paymentProofs.id,
  ),
  paymentStatus: varchar("payment_status", { length: 30 }).default(
    "pending_proof",
  ), // pending_proof, pending_verification, verified, completed, failed
  escrowTransactionHash: varchar("escrow_transaction_hash", { length: 66 }),
  completedAt: timestamp("completed_at"),
});

// === Multi-Currency Payment System Tables ===

// Supported currencies configuration
export const supportedCurrencies = pgTable("supported_currencies", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 10 }).notNull().unique(), // USD, PKR, AED, EUR, GBP, BTC, ETH
  name: varchar("name", { length: 100 }).notNull(), // United States Dollar, Pakistani Rupee, etc.
  symbol: varchar("symbol", { length: 10 }).notNull(), // $, ₨, د.إ, €, £
  decimals: integer("decimals").default(2).notNull(), // 2 for fiat, 18 for crypto
  isCrypto: boolean("is_crypto").default(false).notNull(),
  isFiat: boolean("is_fiat").default(true).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  countryCode: varchar("country_code", { length: 5 }), // US, PK, AE, EU, GB
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Real-time currency exchange rates
export const currencyExchangeRates = pgTable("currency_exchange_rates", {
  id: serial("id").primaryKey(),
  baseCurrency: varchar("base_currency", { length: 10 }).notNull(), // USD
  quoteCurrency: varchar("quote_currency", { length: 10 }).notNull(), // PKR, EUR, ETH, etc.
  rate: decimal("rate", { precision: 18, scale: 8 }).notNull(), // Exchange rate
  source: varchar("source", { length: 30 }).notNull(), // chainlink, manual, stripe_api, coingecko
  oracleChainlinkAddress: varchar("oracle_chainlink_address", { length: 42 }), // Chainlink feed address
  lastUpdate: timestamp("last_update").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  updatedBy: integer("updated_by").references(() => users.id), // Admin who manually updated
  confidence: integer("confidence").default(100), // 0-100, lower for manual entries
  metadata: jsonb("metadata"), // Additional data from oracle
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Bank transfer payment proofs
export const paymentProofs = pgTable("payment_proofs", {
  id: serial("id").primaryKey(),
  investmentId: integer("investment_id")
    .notNull()
    .references(() => investments.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  proofType: varchar("proof_type", { length: 30 }).default("bank_transfer"), // bank_transfer, wire, check, stripe, plaid
  documentHash: varchar("document_hash", { length: 255 }), // IPFS CID
  documentUrl: varchar("document_url", { length: 500 }), // IPFS gateway URL
  bankReference: varchar("bank_reference", { length: 100 }), // Unique reference for matching
  transactionReference: varchar("transaction_reference", { length: 255 }), // User's bank transaction ID
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  verifiedBy: integer("verified_by").references(() => users.id), // Admin who verified
  verifiedAt: timestamp("verified_at"),
  verificationNotes: text("verification_notes"),
  status: varchar("status", { length: 30 }).default("pending"), // pending, verified, rejected, expired
  rejectionReason: text("rejection_reason"),
  expiresAt: timestamp("expires_at"), // Auto-expire after 7 days
  plaidVerificationId: varchar("plaid_verification_id", { length: 255 }), // For automated verification
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
});

// Property price valuations from oracles and manual appraisals
export const propertyValuations = pgTable("property_valuations", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  valuationAmount: decimal("valuation_amount", {
    precision: 18,
    scale: 2,
  }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  valuationDate: timestamp("valuation_date").defaultNow().notNull(),
  valuationType: varchar("valuation_type", { length: 30 }).notNull(), // initial, market_update, oracle_feed, admin_override
  oracleSource: varchar("oracle_source", { length: 50 }), // chainlink_real_estate, zillow_api, manual
  oracleDataHash: varchar("oracle_data_hash", { length: 255 }), // Hash of oracle response for verification
  appraiserWallet: varchar("appraiser_wallet", { length: 42 }), // Wallet of appraiser (if applicable)
  appraiserName: varchar("appraiser_name", { length: 255 }),
  confidence: integer("confidence").default(100), // 0-100 confidence score
  metadata: jsonb("metadata"), // Additional oracle or appraisal data
  approvedBy: integer("approved_by").references(() => users.id), // Admin approval for valuation
  approvedAt: timestamp("approved_at"),
  isActive: boolean("is_active").default(true), // Most recent active valuation
  verificationTransactionHash: varchar("verification_transaction_hash", {
    length: 66,
  }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Bank account details for different currencies/regions
export const bankPaymentInstructions = pgTable("bank_payment_instructions", {
  id: serial("id").primaryKey(),
  currency: varchar("currency", { length: 10 }).notNull(), // USD, PKR, AED, EUR, GBP
  region: varchar("region", { length: 10 }).notNull(), // US, PK, AE, EU, UK
  bankName: varchar("bank_name", { length: 255 }).notNull(),
  accountHolder: varchar("account_holder", { length: 255 }).notNull(),
  accountNumber: text("account_number").notNull(), // Encrypted in application layer
  routingNumber: varchar("routing_number", { length: 50 }),
  swiftCode: varchar("swift_code", { length: 20 }),
  iban: varchar("iban", { length: 50 }),
  bankAddress: text("bank_address"),
  referencePrefix: varchar("reference_prefix", { length: 20 }).default(
    "RWA-INV",
  ), // For generating references
  instructions: text("instructions"), // Additional transfer instructions
  isActive: boolean("is_active").default(true).notNull(),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === Auditing and History Tables ===
export const verificationHistory = pgTable("verification_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  verificationType: varchar("verification_type", { length: 20 }), // 'kyc', 'lister', 'property'
  previousStatus: varchar("previous_status", { length: 30 }),
  newStatus: varchar("new_status", { length: 30 }).notNull(),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  notes: text("notes"),
  signature: text("signature"),
  message: text("message"),
  transactionHash: varchar("transaction_hash", { length: 66 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const actionLogs = pgTable("action_logs", {
  id: serial("id").primaryKey(),
  performedBy: integer("performed_by")
    .notNull()
    .references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  targetUserId: integer("target_user_id"),
  targetType: varchar("target_type", { length: 50 }),
  targetId: integer("target_id"),
  details: jsonb("details"),
  signature: text("signature"),
  message: text("message"),
  walletAddress: varchar("wallet_address", { length: 42 }),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === Property Documents & Images ===
export const propertyDocuments = pgTable("property_documents", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  documentType: varchar("document_type", { length: 100 }).notNull(), // 'title_deed', 'ownership_proof', etc.
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  filePath: varchar("file_path", { length: 255 }), // Local fallback
  ipfsHash: varchar("ipfs_hash", { length: 100 }).default(""), // Populated after IPFS upload
  ipfsUrl: varchar("ipfs_url", { length: 500 }).default(""),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  // Signature verification for document upload
  uploadSignature: text("upload_signature"),
  uploadMessage: text("upload_message"),
  // Verification status
  verificationStatus: varchar("verification_status", { length: 20 }).default(
    "pending",
  ),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: integer("verified_by").references(() => users.id),
});

export const propertyImages = pgTable("property_images", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  filePath: varchar("file_path", { length: 255 }), // Local fallback
  ipfsHash: varchar("ipfs_hash", { length: 100 }).default(""), // Populated after IPFS upload
  ipfsUrl: varchar("ipfs_url", { length: 500 }).default(""),
  isPrimary: boolean("is_primary").default(false),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  // Signature verification for image upload
  uploadSignature: text("upload_signature"),
  uploadMessage: text("upload_message"),
});

// === On-Chain Asset Registry Cache ===
export const assetRegistry = pgTable("asset_registry", {
  id: serial("id").primaryKey(),
  assetId: bigint("asset_id", { mode: "bigint" }).notNull().unique(),
  ownerAddress: varchar("owner_address", { length: 42 }).notNull(),
  assetType: varchar("asset_type", { length: 100 }),
  metadataUri: varchar("metadata_uri", { length: 500 }),
  isActive: boolean("is_active").default(true),
  createdAtChain: bigint("created_at_chain", { mode: "bigint" }),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
  // Registration signature tracking
  registrationSignature: text("registration_signature"),
  registrationMessage: text("registration_message"),
  registrationTransactionHash: varchar("registration_transaction_hash", {
    length: 66,
  }),
});

// === Fractional Property Token Tracking ===
export const fractionalTokens = pgTable("fractional_tokens", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  tokenContractAddress: varchar("token_contract_address", { length: 42 })
    .notNull()
    .unique(),
  totalSupply: decimal("total_supply", { precision: 36, scale: 18 }).notNull(),
  decimals: integer("decimals").default(18),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Admin signature for token creation
  creationSignature: text("creation_signature"),
  creationMessage: text("creation_message"),
  creationTransactionHash: varchar("creation_transaction_hash", { length: 66 }),
  createdBy: integer("created_by").references(() => users.id),
});

// === Investor Holdings ===
export const investorHoldings = pgTable("investor_holdings", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id")
    .notNull()
    .references(() => users.id),
  fractionalTokenId: integer("fractional_token_id")
    .notNull()
    .references(() => fractionalTokens.id),
  balance: decimal("balance", { precision: 36, scale: 18 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// === Revenue Distribution ===
export const revenueDistributions = pgTable("revenue_distributions", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id")
    .notNull()
    .references(() => properties.id),
  totalRevenue: decimal("total_revenue", {
    precision: 36,
    scale: 18,
  }).notNull(),
  distributionDate: timestamp("distribution_date").notNull(),
  transactionHash: varchar("transaction_hash", { length: 66 }),
  status: varchar("status", { length: 20 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Admin signature for revenue distribution
  distributionSignature: text("distribution_signature"),
  distributionMessage: text("distribution_message"),
  distributedBy: integer("distributed_by").references(() => users.id),
});

// === Revenue Shares ===
export const revenueShares = pgTable("revenue_shares", {
  id: serial("id").primaryKey(),
  distributionId: integer("distribution_id")
    .notNull()
    .references(() => revenueDistributions.id, { onDelete: "cascade" }),
  investorId: integer("investor_id")
    .notNull()
    .references(() => users.id),
  shareAmount: decimal("share_amount", { precision: 36, scale: 18 }).notNull(),
  tokensHeld: decimal("tokens_held", { precision: 36, scale: 18 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const revenueShareRelations = relations(revenueShares, ({ one }) => ({
  distribution: one(revenueDistributions, {
    fields: [revenueShares.distributionId],
    references: [revenueDistributions.id],
  }),
  investor: one(users, {
    fields: [revenueShares.investorId],
    references: [users.id],
  }),
}));

// === Secondary Market Listings ===
export const secondaryMarketListings = pgTable("secondary_market_listings", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id")
    .notNull()
    .references(() => users.id),
  fractionalTokenId: integer("fractional_token_id")
    .notNull()
    .references(() => fractionalTokens.id),
  amount: decimal("amount", { precision: 36, scale: 18 }).notNull(),
  pricePerToken: decimal("price_per_token", {
    precision: 36,
    scale: 18,
  }).notNull(),
  status: varchar("status", { length: 20 }).default("active"),
  listedAt: timestamp("listed_at").defaultNow().notNull(),
  soldAt: timestamp("sold_at"),
  // Signature verification for listing
  listingSignature: text("listing_signature"),
  listingMessage: text("listing_message"),
});

// === Secondary Market Trades ===
export const secondaryMarketTrades = pgTable("secondary_market_trades", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id")
    .notNull()
    .references(() => secondaryMarketListings.id),
  buyerId: integer("buyer_id")
    .notNull()
    .references(() => users.id),
  amount: decimal("amount", { precision: 36, scale: 18 }).notNull(),
  pricePerToken: decimal("price_per_token", {
    precision: 36,
    scale: 18,
  }).notNull(),
  totalPrice: decimal("total_price", { precision: 36, scale: 18 }).notNull(),
  transactionHash: varchar("transaction_hash", { length: 66 })
    .notNull()
    .unique(),
  tradedAt: timestamp("traded_at").defaultNow().notNull(),
  // Signature verification for trade
  tradeSignature: text("trade_signature"),
  tradeMessage: text("trade_message"),
});

// === Wallet Authorization Sessions ===
export const walletSessions = pgTable("wallet_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
  sessionNonce: varchar("session_nonce", { length: 100 }).notNull(),
  signature: text("signature").notNull(),
  message: text("message").notNull(),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
});

// === Signature Verifications ===
export const signatureVerifications = pgTable("signature_verifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(), // 'kyc_submit', 'property_submit', 'document_upload', etc.
  signature: text("signature").notNull(),
  message: text("message").notNull(),
  isValid: boolean("is_valid").notNull(),
  targetType: varchar("target_type", { length: 50 }), // 'kyc', 'property', 'document'
  targetId: integer("target_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === Admin Actions Log ===
export const adminActions = pgTable("admin_actions", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id")
    .notNull()
    .references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  targetUserId: integer("target_user_id").references(() => users.id),
  targetType: varchar("target_type", { length: 50 }),
  targetId: integer("target_id"),
  signature: text("signature"),
  message: text("message"),
  transactionHash: varchar("transaction_hash", { length: 66 }),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === Verifier Assignments ===
export const verifierAssignments = pgTable("verifier_assignments", {
  id: serial("id").primaryKey(),
  verifierId: integer("verifier_id")
    .notNull()
    .references(() => users.id),
  propertyId: integer("property_id")
    .notNull()
    .references(() => properties.id),
  assignedBy: integer("assigned_by")
    .notNull()
    .references(() => users.id),
  status: varchar("status", { length: 20 }).default("assigned"), // 'assigned', 'in_progress', 'completed'
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  assignmentTransactionHash: varchar("assignment_transaction_hash", {
    length: 66,
  }),
});

// === Blockchain Transaction Tracking ===
export const blockchainTransactions = pgTable("blockchain_transactions", {
  id: serial("id").primaryKey(),
  transactionHash: varchar("transaction_hash", { length: 66 }).unique(),
  contractName: varchar("contract_name", { length: 50 }).notNull(),
  functionName: varchar("function_name", { length: 100 }).notNull(),
  from: varchar("from", { length: 42 }).notNull(),
  to: varchar("to", { length: 42 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, confirmed, failed
  confirmations: integer("confirmations").default(0),
  blockNumber: integer("block_number"),
  gasUsed: varchar("gas_used", { length: 50 }),
  error: text("error"),
  relatedEntityType: varchar("related_entity_type", { length: 30 }), // kyc, property, user, investment, etc.
  relatedEntityId: integer("related_entity_id"),
  // Workflow tracking for multi-step transactions
  workflowId: varchar("workflow_id", { length: 255 }),
  workflowType: varchar("workflow_type", { length: 50 }), // property_submission, tokenization, investment, property_verification, kyc_approval
  stepNumber: integer("step_number"),
  stepDescription: text("step_description"),
  parentTransactionId: integer("parent_transaction_id").references(
    () => blockchainTransactions.id,
  ),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  confirmedAt: timestamp("confirmed_at"),
});

// IPFS uploads tracking for cleanup on transaction failure
export const ipfsUploads = pgTable("ipfs_uploads", {
  id: serial("id").primaryKey(),
  cid: varchar("cid", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, confirmed, orphaned, cleaned
  linkedTransactionId: integer("linked_transaction_id").references(
    () => blockchainTransactions.id,
  ),
  workflowId: varchar("workflow_id", { length: 255 }),
  contentType: varchar("content_type", { length: 50 }),
  fileName: varchar("file_name", { length: 500 }),
  fileSize: bigint("file_size", { mode: "number" }),
  uploaderUserId: integer("uploader_user_id").references(() => users.id),
  relatedEntityType: varchar("related_entity_type", { length: 30 }),
  relatedEntityId: integer("related_entity_id"),
  metadata: jsonb("metadata"),
  unpinAttempted: boolean("unpin_attempted").default(false),
  unpinAttemptedAt: timestamp("unpin_attempted_at"),
  unpinError: text("unpin_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workflow state tracking for multi-step blockchain operations
export const transactionWorkflows = pgTable("transaction_workflows", {
  id: serial("id").primaryKey(),
  workflowId: varchar("workflow_id", { length: 255 }).notNull().unique(),
  workflowType: varchar("workflow_type", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, in_progress, completed, failed, retrying
  totalSteps: integer("total_steps").notNull(),
  completedSteps: integer("completed_steps").default(0),
  currentStep: integer("current_step").default(1),
  initiatedByUserId: integer("initiated_by_user_id").references(() => users.id),
  relatedEntityType: varchar("related_entity_type", { length: 30 }),
  relatedEntityId: integer("related_entity_id"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  lastRetryAt: timestamp("last_retry_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// === Drizzle Relations (for type safety and easy querying) ===
export const kycSubmissionRelations = relations(
  kycSubmissions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [kycSubmissions.userId],
      references: [users.id],
      relationName: "kycSubmissionUser",
    }),
    reviewer: one(users, {
      fields: [kycSubmissions.reviewedBy],
      references: [users.id],
      relationName: "kycSubmissionReviewer",
    }),
    documents: many(kycDocuments),
  }),
);

export const kycDocumentRelations = relations(kycDocuments, ({ one }) => ({
  user: one(users, {
    fields: [kycDocuments.userId],
    references: [users.id],
  }),
  submission: one(kycSubmissions, {
    fields: [kycDocuments.submissionId],
    references: [kycSubmissions.id],
  }),
}));

export const userRelations = relations(users, ({ one, many }) => ({
  kycSubmission: one(kycSubmissions, {
    fields: [users.id],
    references: [kycSubmissions.userId],
  }),
  listerVerification: one(assetListerVerifications, {
    fields: [users.id],
    references: [assetListerVerifications.userId],
    relationName: "userListerVerification",
  }),
  investments: many(investments),
  walletSessions: many(walletSessions),
  signatureVerifications: many(signatureVerifications),
  adminActions: many(adminActions),
  verifierAssignments: many(verifierAssignments),
  assignedBy: one(users, {
    fields: [users.assignedByUserId],
    references: [users.id],
    relationName: "assignedByRelation",
  }),
}));

export const propertyRelations = relations(properties, ({ one, many }) => ({
  lister: one(users, {
    fields: [properties.listerId],
    references: [users.id],
    relationName: "propertyLister",
  }),
  investments: many(investments),
  assignedVerifier: one(users, {
    fields: [properties.assignedVerifierId],
    references: [users.id],
    relationName: "propertyAssignedVerifier",
  }),
  verifiedByUser: one(users, {
    fields: [properties.verifiedBy],
    references: [users.id],
    relationName: "propertyVerifiedBy",
  }),
  assignedByUser: one(users, {
    fields: [properties.assignedBy],
    references: [users.id],
    relationName: "propertyAssignedBy",
  }),
  verifierAssignments: many(verifierAssignments),
  propertyDocuments: many(propertyDocuments),
  propertyImages: many(propertyImages),
}));

export const investmentRelations = relations(investments, ({ one }) => ({
  investor: one(users, {
    fields: [investments.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [investments.propertyId],
    references: [properties.id],
  }),
  paymentProof: one(paymentProofs, {
    fields: [investments.paymentProofId],
    references: [paymentProofs.id],
  }),
}));

export const propertyDocumentRelations = relations(
  propertyDocuments,
  ({ one }) => ({
    property: one(properties, {
      fields: [propertyDocuments.propertyId],
      references: [properties.id],
    }),
    verifiedByUser: one(users, {
      fields: [propertyDocuments.verifiedBy],
      references: [users.id],
      relationName: "documentVerifiedBy",
    }),
  }),
);

export const propertyImageRelations = relations(propertyImages, ({ one }) => ({
  property: one(properties, {
    fields: [propertyImages.propertyId],
    references: [properties.id],
  }),
}));

export const assetListerVerificationRelations = relations(
  assetListerVerifications,
  ({ one }) => ({
    user: one(users, {
      fields: [assetListerVerifications.userId],
      references: [users.id],
      relationName: "userListerVerification",
    }),
    reviewer: one(users, {
      fields: [assetListerVerifications.reviewedBy],
      references: [users.id],
      relationName: "listerVerificationReviewer",
    }),
  }),
);

export const verificationHistoryRelations = relations(
  verificationHistory,
  ({ one }) => ({
    user: one(users, {
      fields: [verificationHistory.userId],
      references: [users.id],
      relationName: "verificationHistoryUser",
    }),
    reviewer: one(users, {
      fields: [verificationHistory.reviewedBy],
      references: [users.id],
      relationName: "verificationHistoryReviewer",
    }),
  }),
);

export const actionLogRelations = relations(actionLogs, ({ one }) => ({
  performer: one(users, {
    fields: [actionLogs.performedBy],
    references: [users.id],
    relationName: "actionLogPerformer",
  }),
  targetUser: one(users, {
    fields: [actionLogs.targetUserId],
    references: [users.id],
    relationName: "actionLogTarget",
  }),
}));

export const assetRegistryRelations = relations(assetRegistry, ({ one }) => ({
  property: one(properties, {
    fields: [assetRegistry.assetId],
    references: [properties.assetRegistryId],
  }),
}));

export const fractionalTokenRelations = relations(
  fractionalTokens,
  ({ one, many }) => ({
    property: one(properties, {
      fields: [fractionalTokens.propertyId],
      references: [properties.id],
    }),
    createdByUser: one(users, {
      fields: [fractionalTokens.createdBy],
      references: [users.id],
    }),
    holdings: many(investorHoldings),
  }),
);

export const investorHoldingRelations = relations(
  investorHoldings,
  ({ one }) => ({
    investor: one(users, {
      fields: [investorHoldings.investorId],
      references: [users.id],
    }),
    fractionalToken: one(fractionalTokens, {
      fields: [investorHoldings.fractionalTokenId],
      references: [fractionalTokens.id],
    }),
  }),
);

export const revenueDistributionRelations = relations(
  revenueDistributions,
  ({ one, many }) => ({
    property: one(properties, {
      fields: [revenueDistributions.propertyId],
      references: [properties.id],
    }),
    shares: many(revenueShares),
    distributedByUser: one(users, {
      fields: [revenueDistributions.distributedBy],
      references: [users.id],
    }),
  }),
);

export const secondaryMarketListingRelations = relations(
  secondaryMarketListings,
  ({ one }) => ({
    seller: one(users, {
      fields: [secondaryMarketListings.sellerId],
      references: [users.id],
    }),
    fractionalToken: one(fractionalTokens, {
      fields: [secondaryMarketListings.fractionalTokenId],
      references: [fractionalTokens.id],
    }),
  }),
);

export const secondaryMarketTradeRelations = relations(
  secondaryMarketTrades,
  ({ one }) => ({
    listing: one(secondaryMarketListings, {
      fields: [secondaryMarketTrades.listingId],
      references: [secondaryMarketListings.id],
    }),
    buyer: one(users, {
      fields: [secondaryMarketTrades.buyerId],
      references: [users.id],
    }),
  }),
);

export const walletSessionRelations = relations(walletSessions, ({ one }) => ({
  user: one(users, {
    fields: [walletSessions.userId],
    references: [users.id],
  }),
}));

export const signatureVerificationRelations = relations(
  signatureVerifications,
  ({ one }) => ({
    user: one(users, {
      fields: [signatureVerifications.userId],
      references: [users.id],
    }),
  }),
);

export const adminActionRelations = relations(adminActions, ({ one }) => ({
  admin: one(users, {
    fields: [adminActions.adminId],
    references: [users.id],
    relationName: "adminActionAdmin",
  }),
  targetUser: one(users, {
    fields: [adminActions.targetUserId],
    references: [users.id],
    relationName: "adminActionTarget",
  }),
}));

export const verifierAssignmentRelations = relations(
  verifierAssignments,
  ({ one }) => ({
    verifier: one(users, {
      fields: [verifierAssignments.verifierId],
      references: [users.id],
    }),
    property: one(properties, {
      fields: [verifierAssignments.propertyId],
      references: [properties.id],
    }),
    assignedByUser: one(users, {
      fields: [verifierAssignments.assignedBy],
      references: [users.id],
    }),
  }),
);

// === Multi-Currency Payment Relations ===

export const paymentProofRelations = relations(paymentProofs, ({ one }) => ({
  investment: one(investments, {
    fields: [paymentProofs.investmentId],
    references: [investments.id],
  }),
  user: one(users, {
    fields: [paymentProofs.userId],
    references: [users.id],
  }),
  verifier: one(users, {
    fields: [paymentProofs.verifiedBy],
    references: [users.id],
  }),
}));

export const propertyValuationRelations = relations(
  propertyValuations,
  ({ one }) => ({
    property: one(properties, {
      fields: [propertyValuations.propertyId],
      references: [properties.id],
    }),
    approver: one(users, {
      fields: [propertyValuations.approvedBy],
      references: [users.id],
    }),
  }),
);

export const currencyExchangeRateRelations = relations(
  currencyExchangeRates,
  ({ one }) => ({
    updater: one(users, {
      fields: [currencyExchangeRates.updatedBy],
      references: [users.id],
    }),
  }),
);
