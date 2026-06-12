import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db/connection.js";
import {
  investments,
  kycSubmissions,
  properties,
  revenueDistributions,
  revenueShares,
  secondaryMarketListings,
  secondaryMarketTrades,
  users,
  verifierApplications,
  verifierAssignments,
} from "../db/schema.js";

// Explicit column selection for users table — avoids SELECT * failures when
// the database is missing columns that exist only in the Drizzle schema definition.
const USER_FIELDS = {
  id: users.id,
  walletAddress: users.walletAddress,
  email: users.email,
  role: users.role,
  kycStatus: users.kycStatus,
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const AssetRegistryABI = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "./web3/abi/AssetRegistry.json"),
    "utf-8",
  ),
);
const RoleManagerABI = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./web3/abi/RoleManager.json"), "utf-8"),
);
const KYCRegistryABI = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./web3/abi/KYCRegistry.json"), "utf-8"),
);
const PropertyNFTABI = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./web3/abi/PropertyNFT.json"), "utf-8"),
);
const InvestmentManagerABI = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "./web3/abi/InvestmentManager.json"),
    "utf-8",
  ),
);
const RevenueDistributorABI = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "./web3/abi/RevenueDistributor.json"),
    "utf-8",
  ),
);
const SecondaryMarketABI = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "./web3/abi/SecondaryMarket.json"),
    "utf-8",
  ),
);
const addressesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./web3/addresses.json"), "utf-8"),
);

const CHAIN_ID = process.env.CHAIN_ID || "31337";
const RPC_URL = process.env.RPC_URL || "http://localhost:8545";

class BlockchainSyncService {
  constructor() {
    this.provider = null;
    this.assetRegistry = null;
    this.roleManager = null;
    this.kycRegistry = null;
    this.propertyNFT = null;
    this.investmentManager = null;
    this.revenueDistributor = null;
    this.secondaryMarket = null;
    this.isListening = false;
    this.syncInterval = null;
  }

  async initialize() {
    try {
      console.log("🔗 Initializing Blockchain Sync Service...");

      // Connect to blockchain
      this.provider = new ethers.JsonRpcProvider(RPC_URL);
      await this.provider.getBlockNumber();
      console.log("✅ Connected to blockchain");

      // Load contract addresses
      const addresses = addressesData[CHAIN_ID];
      if (!addresses) {
        throw new Error(`No contract addresses found for chain ${CHAIN_ID}`);
      }

      // Initialize contracts
      this.assetRegistry = new ethers.Contract(
        addresses.AssetRegistry,
        AssetRegistryABI.abi,
        this.provider,
      );

      this.roleManager = new ethers.Contract(
        addresses.RoleManager,
        RoleManagerABI.abi,
        this.provider,
      );

      this.kycRegistry = new ethers.Contract(
        addresses.KYCRegistry,
        KYCRegistryABI.abi,
        this.provider,
      );
      console.log("✅ KYC Registry initialized");

      // Initialize PropertyNFT contract
      this.propertyNFT = new ethers.Contract(
        addresses.PropertyNFT,
        PropertyNFTABI.abi,
        this.provider,
      );
      console.log("✅ PropertyNFT initialized");

      // Initialize InvestmentManager contract
      this.investmentManager = new ethers.Contract(
        addresses.InvestmentManager,
        InvestmentManagerABI.abi,
        this.provider,
      );
      console.log("✅ InvestmentManager initialized");

      // Initialize RevenueDistributor contract
      if (addresses.RevenueDistributor) {
        this.revenueDistributor = new ethers.Contract(
          addresses.RevenueDistributor,
          RevenueDistributorABI.abi,
          this.provider,
        );
        console.log("✅ RevenueDistributor initialized");
      }

      // Initialize SecondaryMarket contract
      if (addresses.SecondaryMarket) {
        this.secondaryMarket = new ethers.Contract(
          addresses.SecondaryMarket,
          SecondaryMarketABI.abi,
          this.provider,
        );
        console.log("✅ SecondaryMarket initialized");
      }

      console.log("📋 Contracts loaded:");
      console.log(`   AssetRegistry: ${addresses.AssetRegistry}`);
      console.log(`   RoleManager: ${addresses.RoleManager}`);
      console.log(`   KYCRegistry: ${addresses.KYCRegistry}`);

      console.log("🔄 About to start event listeners...");
      // Start event listeners immediately
      this.startEventListeners();
      this.startKYCEventListeners();
      this.startRoleManagerEventListeners();
      this.startPropertyNFTEventListeners();
      this.startInvestmentEventListeners();
      this.startRevenueDistributorEventListeners();
      this.startSecondaryMarketEventListeners();
      console.log("✅ Event listeners started");

      console.log("🔄 About to start periodic sync...");
      // Start periodic sync (backup mechanism)
      this.startPeriodicSync();
      console.log("✅ Periodic sync started");

      console.log("🔄 About to perform initial sync...");
      // Perform initial sync in background (non-blocking)
      this.performInitialSync().catch((err) => {
        console.log(
          "   ℹ️  Background initial sync error (non-blocking):",
          err.message,
        );
      });
      console.log("✅ Initial sync started in background");

      console.log("✅ Blockchain Sync Service initialized\n");
      return true;
    } catch (error) {
      console.error(
        "❌ Failed to initialize Blockchain Sync Service:",
        error.message,
      );
      console.log(
        "⚠️  System will run without auto-sync. Ensure blockchain is running.\n",
      );
      return false;
    }
  }

  async performInitialSync() {
    try {
      console.log("🔄 Starting KYC state reconciliation...");

      // Add timeout protection
      const syncPromise = this.syncKYCState();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Sync timeout")), 10000),
      );

      await Promise.race([syncPromise, timeoutPromise]);
      console.log("✅ KYC state reconciliation complete\n");
    } catch (error) {
      console.log(`   ⚠️  Initial sync skipped: ${error.message}`);
      console.log(
        "   ℹ️  Event listeners will handle ongoing synchronization\n",
      );
    }
  }

  async syncKYCState() {
    try {
      // Get all users with wallet addresses
      const usersWithWallets = await db
        .select(USER_FIELDS)
        .from(users)
        .where(isNotNull(users.walletAddress));

      if (usersWithWallets.length === 0) {
        console.log("   ℹ️  No users with wallets found");
        return;
      }

      let syncedCount = 0;
      let outOfSyncCount = 0;

      // Check each user's KYC status on blockchain
      for (const user of usersWithWallets.slice(0, 10)) {
        // Limit to first 10 for performance
        try {
          const isApproved = await this.kycRegistry.isKYCApproved(
            user.walletAddress,
          );

          // Get current KYC submission from DB
          const [kycSubmission] = await db
            .select()
            .from(kycSubmissions)
            .where(eq(kycSubmissions.userId, user.id))
            .limit(1);

          if (!kycSubmission) continue;

          // Check if DB status matches blockchain
          const dbApproved = kycSubmission.status === "approved";

          if (isApproved && !dbApproved) {
            // Blockchain says approved but DB says not approved - update DB
            await db
              .update(kycSubmissions)
              .set({
                status: "approved",
                reviewedAt: new Date(),
              })
              .where(eq(kycSubmissions.id, kycSubmission.id));

            await db
              .update(users)
              .set({ kycStatus: "approved" })
              .where(eq(users.id, user.id));

            outOfSyncCount++;
            console.log(
              `   🔧 Synced user ${user.email || user.walletAddress} to approved`,
            );
          } else {
            syncedCount++;
          }
        } catch (err) {
          // Skip individual errors (user might not have submitted KYC on-chain)
          continue;
        }
      }

      if (outOfSyncCount > 0) {
        console.log(
          `   ✅ Reconciled ${outOfSyncCount} out-of-sync KYC records`,
        );
      }
      console.log(`   ℹ️  ${syncedCount} records already in sync`);
    } catch (error) {
      console.error(`   ❌ KYC sync failed:`, error.message);
      throw error;
    }
  }

  startEventListeners() {
    console.log("👂 Starting event listeners...");

    // Listen for VerifierAssigned events
    this.assetRegistry.on(
      "VerifierAssigned",
      async (propertyId, verifierAddress, event) => {
        console.log(
          `📡 Event: VerifierAssigned(${propertyId}, ${verifierAddress})`,
        );
        await this.handleVerifierAssigned(propertyId, verifierAddress, event);
      },
    );

    // Listen for PropertyVerified events
    this.assetRegistry.on(
      "PropertyVerified",
      async (propertyId, verifierAddress, event) => {
        console.log(
          `📡 Event: PropertyVerified(${propertyId}, ${verifierAddress})`,
        );
        await this.handlePropertyVerified(propertyId, verifierAddress, event);
      },
    );

    // Listen for PropertyRejected events
    this.assetRegistry.on(
      "PropertyRejected",
      async (propertyId, verifierAddress, reason, event) => {
        console.log(`📡 Event: PropertyRejected(${propertyId}, ${reason})`);
        await this.handlePropertyRejected(
          propertyId,
          verifierAddress,
          reason,
          event,
        );
      },
    );

    // Listen for PropertyListed events (when property is first submitted)
    this.assetRegistry.on(
      "PropertyListed",
      async (propertyId, listerAddress, dataHash, timestamp, event) => {
        console.log(
          `📡 Event: PropertyListed(${propertyId}, ${listerAddress})`,
        );
        await this.handlePropertyListed(
          propertyId,
          listerAddress,
          dataHash,
          event,
        );
      },
    );

    // Listen for PropertyFinancialsSet events
    this.assetRegistry.on(
      "PropertyFinancialsSet",
      async (propertyId, valuation, expectedROI, event) => {
        console.log(
          `📡 Event: PropertyFinancialsSet(${propertyId}, valuation: ${valuation})`,
        );
        await this.handlePropertyFinancialsSet(
          propertyId,
          valuation,
          expectedROI,
          event,
        );
      },
    );

    // Listen for PropertyLegalSet events
    this.assetRegistry.on(
      "PropertyLegalSet",
      async (propertyId, titleDeedHash, event) => {
        console.log(`📡 Event: PropertyLegalSet(${propertyId})`);
        await this.handlePropertyLegalSet(propertyId, titleDeedHash, event);
      },
    );

    this.isListening = true;
    console.log("   ✅ Property event listeners active\n");
  }

  startKYCEventListeners() {
    console.log("👂 Starting KYC event listeners...");

    // Listen for KYCSubmitted events
    this.kycRegistry.on(
      "KYCSubmitted",
      async (userAddress, documentHash, timestamp, event) => {
        console.log(`📡 Event: KYCSubmitted(${userAddress}, ${documentHash})`);
        await this.handleKYCSubmitted(userAddress, documentHash, event);
      },
    );

    // Listen for KYCApproved events
    this.kycRegistry.on(
      "KYCApproved",
      async (userAddress, reviewerAddress, timestamp, event) => {
        console.log(
          `📡 Event: KYCApproved(${userAddress}, ${reviewerAddress})`,
        );
        await this.handleKYCApproved(userAddress, reviewerAddress, event);
      },
    );

    // Listen for KYCRejected events
    this.kycRegistry.on(
      "KYCRejected",
      async (userAddress, reviewerAddress, reason, timestamp, event) => {
        console.log(`📡 Event: KYCRejected(${userAddress}, ${reason})`);
        await this.handleKYCRejected(
          userAddress,
          reviewerAddress,
          reason,
          event,
        );
      },
    );

    // Listen for VerifierApplicationSubmitted events
    this.kycRegistry.on(
      "VerifierApplicationSubmitted",
      async (applicant, qualifications, timestamp, event) => {
        console.log(`📡 Event: VerifierApplicationSubmitted(${applicant})`);
        await this.handleVerifierApplicationSubmitted(
          applicant,
          qualifications,
          event,
        );
      },
    );

    // Listen for VerifierApplicationApproved events
    this.kycRegistry.on(
      "VerifierApplicationApproved",
      async (applicant, reviewer, timestamp, event) => {
        console.log(`📡 Event: VerifierApplicationApproved(${applicant})`);
        await this.handleVerifierApplicationApproved(
          applicant,
          reviewer,
          event,
        );
      },
    );

    // Listen for VerifierApplicationRejected events
    this.kycRegistry.on(
      "VerifierApplicationRejected",
      async (applicant, reviewer, timestamp, event) => {
        console.log(`📡 Event: VerifierApplicationRejected(${applicant})`);
        await this.handleVerifierApplicationRejected(
          applicant,
          reviewer,
          event,
        );
      },
    );

    console.log("   ✅ KYC event listeners active\n");
  }

  async handleVerifierAssigned(propertyId, verifierAddress, event) {
    try {
      // Find property by blockchain ID
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.assetRegistryId, propertyId.toString()))
        .limit(1);

      if (!property) {
        console.log(
          `   ⚠️  Property with blockchain ID ${propertyId} not found in DB`,
        );
        return;
      }

      // Find verifier by wallet address
      const [verifier] = await db
        .select(USER_FIELDS)
        .from(users)
        .where(eq(users.walletAddress, verifierAddress.toLowerCase()))
        .limit(1);

      if (!verifier) {
        console.log(`   ⚠️  Verifier ${verifierAddress} not found in DB`);
        return;
      }

      // Update property
      await db
        .update(properties)
        .set({
          assignedVerifierId: verifier.id,
          status: "verification_pending",
          assignedAt: new Date(),
          verifierAssignmentTransactionHash: event?.transactionHash,
        })
        .where(eq(properties.id, property.id));

      // Create or update assignment record
      const existingAssignment = await db
        .select()
        .from(verifierAssignments)
        .where(eq(verifierAssignments.propertyId, property.id))
        .limit(1);

      if (existingAssignment.length === 0) {
        await db.insert(verifierAssignments).values({
          verifierId: verifier.id,
          propertyId: property.id,
          assignedBy: 1,
          status: "assigned",
          assignedAt: new Date(),
          assignmentTransactionHash: event?.transactionHash,
        });
      } else {
        await db
          .update(verifierAssignments)
          .set({
            verifierId: verifier.id,
            status: "assigned",
            assignmentTransactionHash: event?.transactionHash,
          })
          .where(eq(verifierAssignments.id, existingAssignment[0].id));
      }

      console.log(
        `   ✅ Synced verifier assignment for property ${property.title}`,
      );
    } catch (error) {
      console.error(`   ❌ Failed to handle VerifierAssigned:`, error.message);
    }
  }

  async handlePropertyVerified(propertyId, verifierAddress, event) {
    try {
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.assetRegistryId, propertyId.toString()))
        .limit(1);

      if (!property) return;

      const [verifier] = await db
        .select(USER_FIELDS)
        .from(users)
        .where(eq(users.walletAddress, verifierAddress.toLowerCase()))
        .limit(1);

      await db
        .update(properties)
        .set({
          status: "verified",
          verifiedBy: verifier?.id,
          verifiedAt: new Date(),
          verificationTransactionHash: event?.transactionHash,
        })
        .where(eq(properties.id, property.id));

      // Update assignment
      await db
        .update(verifierAssignments)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(verifierAssignments.propertyId, property.id));

      console.log(`   ✅ Synced verification for property ${property.title}`);
    } catch (error) {
      console.error(`   ❌ Failed to handle PropertyVerified:`, error.message);
    }
  }

  async handlePropertyRejected(propertyId, verifierAddress, reason, event) {
    try {
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.assetRegistryId, propertyId.toString()))
        .limit(1);

      if (!property) return;

      const [verifier] = await db
        .select(USER_FIELDS)
        .from(users)
        .where(eq(users.walletAddress, verifierAddress.toLowerCase()))
        .limit(1);

      await db
        .update(properties)
        .set({
          status: "rejected",
          rejectedBy: verifier?.id,
          rejectedAt: new Date(),
          rejectionReason: reason,
          verificationTransactionHash: event?.transactionHash,
        })
        .where(eq(properties.id, property.id));

      // Update assignment
      await db
        .update(verifierAssignments)
        .set({
          status: "rejected",
          completedAt: new Date(),
        })
        .where(eq(verifierAssignments.propertyId, property.id));

      console.log(`   ✅ Synced rejection for property ${property.title}`);
    } catch (error) {
      console.error(`   ❌ Failed to handle PropertyRejected:`, error.message);
    }
  }

  async handlePropertyListed(propertyId, listerAddress, dataHash, event) {
    try {
      // Find property by blockchain ID or lister wallet address
      // First try to find by assetRegistryId
      let property = await db
        .select()
        .from(properties)
        .where(eq(properties.assetRegistryId, propertyId.toString()))
        .limit(1);

      // If not found by ID, try to find the most recent pending property from this lister
      if (!property || property.length === 0) {
        const [lister] = await db
          .select(USER_FIELDS)
          .from(users)
          .where(eq(users.walletAddress, listerAddress.toLowerCase()))
          .limit(1);

        if (lister) {
          property = await db
            .select()
            .from(properties)
            .where(
              and(
                eq(properties.listerId, lister.id),
                inArray(properties.status, [
                  "awaiting_blockchain",
                  "pending_assignment",
                ]),
              ),
            )
            .orderBy(desc(properties.createdAt))
            .limit(1);
        }
      }

      if (!property || property.length === 0) {
        console.log(
          `   ⚠️  Property not found for blockchain ID ${propertyId} or lister ${listerAddress}`,
        );
        return;
      }

      const propRecord = property[0];

      // Get transaction hash safely
      const transactionHash =
        event?.log?.transactionHash || event?.transactionHash || null;

      // Update property with blockchain ID and transaction hash
      await db
        .update(properties)
        .set({
          assetRegistryId: propertyId.toString(),
          listingTransactionHash: transactionHash,
          status: "pending_assignment", // Listed on blockchain, waiting for verifier assignment
        })
        .where(eq(properties.id, propRecord.id));

      console.log(
        `   ✅ Synced property listing for "${propRecord.title}" (ID: ${propertyId})`,
      );
    } catch (error) {
      console.error(`   ❌ Failed to handle PropertyListed:`, error.message);
      console.error(`   Event structure:`, event);
    }
  }

  /**
   * Find a user by wallet address using two lookup paths:
   *  1. users.wallet_address  (set when user explicitly links wallet)
   *  2. kyc_submissions.wallet_address  (set when user submits KYC)
   *
   * If found only via KYC submission, back-fills users.wallet_address so
   * all future lookups succeed without a second fallback query.
   */
  async _findUserByWallet(walletAddress) {
    const addr = walletAddress.toLowerCase();

    // Primary: direct wallet link on users table
    const [directUser] = await db
      .select(USER_FIELDS)
      .from(users)
      .where(eq(users.walletAddress, addr))
      .limit(1);

    if (directUser) return directUser;

    // Fallback: look up via kyc_submissions.wallet_address
    const [submission] = await db
      .select({ userId: kycSubmissions.userId })
      .from(kycSubmissions)
      .where(eq(kycSubmissions.walletAddress, addr))
      .orderBy(desc(kycSubmissions.submittedAt))
      .limit(1);

    if (!submission) return null;

    const [kycUser] = await db
      .select(USER_FIELDS)
      .from(users)
      .where(eq(users.id, submission.userId))
      .limit(1);

    if (!kycUser) return null;

    // Back-fill wallet_address on users row so primary lookup works next time
    try {
      await db
        .update(users)
        .set({ walletAddress: addr, isWalletConnected: true })
        .where(eq(users.id, kycUser.id));
      console.log(
        `   🔗 Auto-linked wallet ${walletAddress} → user ${kycUser.email} (via KYC submission)`,
      );
    } catch (_) {
      /* non-fatal — wallet may already be linked */
    }

    return { ...kycUser, walletAddress: addr };
  }

  async handleKYCSubmitted(userAddress, documentHash, event) {
    try {
      const user = await this._findUserByWallet(userAddress);

      if (!user) {
        console.log(`   ⚠️  User with wallet ${userAddress} not found in DB`);
        return;
      }

      // Update KYC submission status to pending
      await db
        .update(kycSubmissions)
        .set({
          status: "pending",
          submissionTransactionHash: event?.transactionHash,
          documentHash: documentHash,
        })
        .where(eq(kycSubmissions.userId, user.id));

      console.log(
        `   ✅ Synced KYC submission for user ${user.email || userAddress}`,
      );
    } catch (error) {
      console.error(`   ❌ Failed to handle KYCSubmitted:`, error.message);
    }
  }

  async handleKYCApproved(userAddress, reviewerAddress, event) {
    try {
      const user = await this._findUserByWallet(userAddress);

      if (!user) {
        console.log(`   ⚠️  User with wallet ${userAddress} not found in DB`);
        return;
      }

      // Find reviewer by wallet address
      const [reviewer] = await db
        .select(USER_FIELDS)
        .from(users)
        .where(eq(users.walletAddress, reviewerAddress.toLowerCase()))
        .limit(1);

      // Update KYC submission to approved
      await db
        .update(kycSubmissions)
        .set({
          status: "approved",
          reviewedBy: reviewer?.id,
          reviewedAt: new Date(),
          approvalTransactionHash: event?.transactionHash,
        })
        .where(eq(kycSubmissions.userId, user.id));

      // Update user KYC status
      await db
        .update(users)
        .set({
          kycStatus: "approved",
        })
        .where(eq(users.id, user.id));

      console.log(
        `   ✅ Synced KYC approval for user ${user.email || userAddress}`,
      );
    } catch (error) {
      console.error(`   ❌ Failed to handle KYCApproved:`, error.message);
    }
  }

  async handleKYCRejected(userAddress, reviewerAddress, reason, event) {
    try {
      const user = await this._findUserByWallet(userAddress);

      if (!user) {
        console.log(`   ⚠️  User with wallet ${userAddress} not found in DB`);
        return;
      }

      // Find reviewer by wallet address
      const [reviewer] = await db
        .select(USER_FIELDS)
        .from(users)
        .where(eq(users.walletAddress, reviewerAddress.toLowerCase()))
        .limit(1);

      // Update KYC submission to rejected
      await db
        .update(kycSubmissions)
        .set({
          status: "rejected",
          reviewedBy: reviewer?.id,
          reviewedAt: new Date(),
          rejectionReason: reason,
          approvalTransactionHash: event?.transactionHash,
        })
        .where(eq(kycSubmissions.userId, user.id));

      // Update user KYC status
      await db
        .update(users)
        .set({
          kycStatus: "rejected",
        })
        .where(eq(users.id, user.id));

      console.log(
        `   ✅ Synced KYC rejection for user ${user.email || userAddress}`,
      );
    } catch (error) {
      console.error(`   ❌ Failed to handle KYCRejected:`, error.message);
    }
  }

  // =============================================================================
  // ROLE MANAGER EVENT LISTENERS
  // =============================================================================

  startRoleManagerEventListeners() {
    console.log("👂 Starting RoleManager event listeners...");

    // Listen for RoleGrantedByAdmin events
    this.roleManager.on(
      "RoleGrantedByAdmin",
      async (role, account, grantor, event) => {
        console.log(
          `📡 Event: RoleGrantedByAdmin(${role}, ${account}, ${grantor})`,
        );
        await this.handleRoleGranted(role, account, grantor, event);
      },
    );

    // Listen for RoleRevokedByAdmin events
    this.roleManager.on(
      "RoleRevokedByAdmin",
      async (role, account, revoker, event) => {
        console.log(
          `📡 Event: RoleRevokedByAdmin(${role}, ${account}, ${revoker})`,
        );
        await this.handleRoleRevoked(role, account, revoker, event);
      },
    );

    // Listen for WalletMapped events
    this.roleManager.on("WalletMapped", async (userId, wallet, event) => {
      console.log(`📡 Event: WalletMapped(${userId}, ${wallet})`);
      await this.handleWalletMapped(userId, wallet, event);
    });

    // Listen for AdminTransferred events
    this.roleManager.on(
      "AdminTransferred",
      async (oldAdmin, newAdmin, event) => {
        console.log(`📡 Event: AdminTransferred(${oldAdmin} -> ${newAdmin})`);
        await this.handleAdminTransferred(oldAdmin, newAdmin, event);
      },
    );

    console.log("   ✅ RoleManager event listeners active\n");
  }

  async handleRoleGranted(role, account, grantor, event) {
    try {
      const user = await this._findUserByWallet(account);

      if (!user) {
        console.log(
          `   ⚠️  User with wallet ${account} not found - may be created soon`,
        );
        return;
      }

      // Decode role to determine user role type
      const VERIFIER_ROLE = ethers.id("VERIFIER_ROLE");
      const SUB_ADMIN_ROLE = ethers.id("SUB_ADMIN_ROLE");

      let userRole = user.role;
      if (role === VERIFIER_ROLE) {
        userRole = "verifier";
      } else if (role === SUB_ADMIN_ROLE) {
        userRole = "subadmin";
      }

      // Update user role in database
      await db
        .update(users)
        .set({
          role: userRole,
          roleGrantTransactionHash:
            event.log?.transactionHash || event.transactionHash,
        })
        .where(eq(users.id, user.id));

      console.log(
        `   ✅ Synced role grant for user ${user.email}: ${userRole}`,
      );
    } catch (error) {
      console.error(`   ❌ Failed to handle RoleGranted:`, error.message);
    }
  }

  async handleRoleRevoked(role, account, revoker, event) {
    try {
      const user = await this._findUserByWallet(account);

      if (!user) {
        console.log(`   ⚠️  User with wallet ${account} not found in database`);
        return;
      }

      // Revoke role - set back to regular user
      await db
        .update(users)
        .set({
          role: "user",
          roleRevokeTransactionHash:
            event.log?.transactionHash || event.transactionHash,
        })
        .where(eq(users.id, user.id));

      console.log(`   ✅ Synced role revocation for user ${user.email}`);
    } catch (error) {
      console.error(`   ❌ Failed to handle RoleRevoked:`, error.message);
    }
  }

  async handleWalletMapped(userId, wallet, event) {
    try {
      console.log(
        `   ℹ️  Wallet mapping event captured: ${userId} -> ${wallet}`,
      );
      // Back-fill wallet_address for the user identified by their backend userId string
      await db
        .update(users)
        .set({ walletAddress: wallet.toLowerCase() })
        .where(eq(users.id, Number(userId)));
      console.log(`   ✅ Synced wallet mapping for user ${userId}: ${wallet}`);
    } catch (error) {
      console.error(`   ❌ Failed to handle WalletMapped:`, error.message);
    }
  }

  // =============================================================================
  // PROPERTY NFT EVENT LISTENERS
  // =============================================================================

  startPropertyNFTEventListeners() {
    console.log("👂 Starting PropertyNFT event listeners...");

    // Listen for PropertyMinted events
    // ABI: PropertyMinted(tokenId, assetRegistryId, metadataURI, fractionalToken, fractionalSupply, creator)
    this.propertyNFT.on(
      "PropertyMinted",
      async (
        tokenId,
        assetRegistryId,
        metadataURI,
        fractionalToken,
        fractionalSupply,
        creator,
        event,
      ) => {
        console.log(
          `📡 Event: PropertyMinted(tokenId: ${tokenId}, assetId: ${assetRegistryId})`,
        );
        await this.handlePropertyMinted(
          tokenId,
          assetRegistryId,
          fractionalToken,
          fractionalSupply,
          event,
        );
      },
    );

    // Listen for PropertyActivated events
    this.propertyNFT.on("PropertyActivated", async (tokenId, event) => {
      console.log(`📡 Event: PropertyActivated(${tokenId})`);
      await this.handlePropertyActivated(tokenId, event);
    });

    // Listen for PropertyDeactivated events
    this.propertyNFT.on("PropertyDeactivated", async (tokenId, event) => {
      console.log(`📡 Event: PropertyDeactivated(${tokenId})`);
      await this.handlePropertyDeactivated(tokenId, event);
    });

    // Listen for MetadataUpdated events
    this.propertyNFT.on("MetadataUpdated", async (tokenId, newURI, event) => {
      console.log(`📡 Event: MetadataUpdated(${tokenId})`);
      await this.handleMetadataUpdated(tokenId, newURI, event);
    });

    // Listen for FractionalTokenUpdated events
    this.propertyNFT.on(
      "FractionalTokenUpdated",
      async (tokenId, newToken, event) => {
        console.log(
          `📡 Event: FractionalTokenUpdated(${tokenId}, ${newToken})`,
        );
        await this.handleFractionalTokenUpdated(tokenId, newToken, event);
      },
    );

    console.log("   ✅ PropertyNFT event listeners active\n");
  }

  async handlePropertyMinted(
    tokenId,
    assetRegistryId,
    fractionalToken,
    fractionalSupply,
    event,
  ) {
    try {
      // Find property by assetRegistryId (stored as string in DB)
      const [property] = await db
        .select()
        .from(properties)
        .where(
          eq(
            properties.assetRegistryId,
            BigInt(assetRegistryId.toString()).toString(),
          ),
        )
        .limit(1);

      if (!property) {
        console.log(
          `   ⚠️  Property with assetRegistryId ${assetRegistryId} not found in DB`,
        );
        return;
      }

      // If the atomic tokenization already updated this record correctly,
      // skip to avoid overwriting with stale data from the event payload.
      if (property.status === "tokenized" && property.nftTokenId != null) {
        console.log(
          `   ℹ️  Property "${property.title}" already tokenized by atomic tx — event listener skipping duplicate update`,
        );
        return;
      }

      const txHash = event.log?.transactionHash || event.transactionHash;

      // fractionalSupply from the contract event is in WEI (18 decimals).
      // The DB column total_fractional_supply is decimal(36,18) which can only
      // hold ~18 digits before the decimal point — convert to ether units.
      const fractionalSupplyEther = ethers.formatEther(fractionalSupply);

      // Update property with NFT token ID, fractional token details and status
      await db
        .update(properties)
        .set({
          nftTokenId: Number(tokenId),
          status: "tokenized",
          fractionalTokenAddress: fractionalToken.toLowerCase(),
          totalFractionalSupply: fractionalSupplyEther,
          tokenizationTransactionHash: txHash,
        })
        .where(eq(properties.id, property.id));

      console.log(
        `   ✅ Synced property NFT minting: "${property.title}" (Token ID: ${tokenId}, Fractional: ${fractionalToken})`,
      );
    } catch (error) {
      console.error(`   ❌ Failed to handle PropertyMinted:`, error.message);
    }
  }

  async handlePropertyActivated(tokenId, event) {
    try {
      // Find property by NFT token ID
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.nftTokenId, Number(tokenId)))
        .limit(1);

      if (!property) {
        console.log(`   ⚠️  Property with nftTokenId ${tokenId} not found`);
        return;
      }

      // Update property status to active
      await db
        .update(properties)
        .set({
          status: "active",
        })
        .where(eq(properties.id, property.id));

      console.log(`   ✅ Synced property activation: "${property.title}"`);
    } catch (error) {
      console.error(`   ❌ Failed to handle PropertyActivated:`, error.message);
    }
  }

  async handlePropertyDeactivated(tokenId, event) {
    try {
      // Find property by NFT token ID
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.nftTokenId, Number(tokenId)))
        .limit(1);

      if (!property) {
        console.log(`   ⚠️  Property with nftTokenId ${tokenId} not found`);
        return;
      }

      // Update property status
      await db
        .update(properties)
        .set({
          status: "tokenized", // Deactivated but still tokenized
        })
        .where(eq(properties.id, property.id));

      console.log(`   ✅ Synced property deactivation: "${property.title}"`);
    } catch (error) {
      console.error(
        `   ❌ Failed to handle PropertyDeactivated:`,
        error.message,
      );
    }
  }

  async handleMetadataUpdated(tokenId, newURI, event) {
    try {
      // Find property by NFT token ID
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.nftTokenId, Number(tokenId)))
        .limit(1);

      if (!property) {
        console.log(`   ⚠️  Property with nftTokenId ${tokenId} not found`);
        return;
      }

      // Update property metadata URL
      await db
        .update(properties)
        .set({
          metadataUrl: newURI,
        })
        .where(eq(properties.id, property.id));

      console.log(`   ✅ Synced metadata update for: "${property.title}"`);
    } catch (error) {
      console.error(`   ❌ Failed to handle MetadataUpdated:`, error.message);
    }
  }

  async handleFractionalTokenUpdated(tokenId, newToken, event) {
    try {
      // Find property by NFT token ID
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.nftTokenId, Number(tokenId)))
        .limit(1);

      if (!property) {
        console.log(`   ⚠️  Property with nftTokenId ${tokenId} not found`);
        return;
      }

      // Update fractional token address
      await db
        .update(properties)
        .set({
          fractionalTokenAddress: newToken.toLowerCase(),
        })
        .where(eq(properties.id, property.id));

      console.log(
        `   ✅ Synced fractional token update for: "${property.title}"`,
      );
    } catch (error) {
      console.error(
        `   ❌ Failed to handle FractionalTokenUpdated:`,
        error.message,
      );
    }
  }

  // =============================================================================
  // INVESTMENT MANAGER EVENT LISTENERS
  // =============================================================================

  startInvestmentEventListeners() {
    console.log("👂 Starting InvestmentManager event listeners...");

    // Listen for InvestmentPoolCreated events
    this.investmentManager.on(
      "InvestmentPoolCreated",
      async (nftTokenId, fractionalToken, totalSupply, event) => {
        console.log(
          `📡 Event: InvestmentPoolCreated(NFT: ${nftTokenId}, Token: ${fractionalToken})`,
        );
        await this.handleInvestmentPoolCreated(
          nftTokenId,
          fractionalToken,
          totalSupply,
          event,
        );
      },
    );

    // Listen for Invested events
    // ABI: Invested(investmentId indexed, investor indexed, nftTokenId indexed, platformTokenPaid, fractionalTokensReceived)
    this.investmentManager.on(
      "Invested",
      async (
        investmentId,
        investor,
        nftTokenId,
        amountPaid,
        tokensReceived,
        event,
      ) => {
        console.log(
          `📡 Event: Invested(id: ${investmentId}, investor: ${investor}, NFT: ${nftTokenId})`,
        );
        await this.handleInvested(
          investmentId,
          investor,
          nftTokenId,
          amountPaid,
          tokensReceived,
          event,
        );
      },
    );

    // Listen for InvestmentPoolClosed events
    this.investmentManager.on(
      "InvestmentPoolClosed",
      async (nftTokenId, event) => {
        console.log(`📡 Event: InvestmentPoolClosed(NFT: ${nftTokenId})`);
        await this.handleInvestmentPoolClosed(nftTokenId, event);
      },
    );

    console.log("   ✅ InvestmentManager event listeners active\n");
  }

  async handleInvestmentPoolCreated(
    nftTokenId,
    fractionalToken,
    totalSupply,
    event,
  ) {
    try {
      // Find property by NFT token ID
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.nftTokenId, Number(nftTokenId)))
        .limit(1);

      if (!property) {
        console.log(`   ⚠️  Property with nftTokenId ${nftTokenId} not found`);
        return;
      }

      // Update property with fractional token details
      await db
        .update(properties)
        .set({
          fractionalTokenAddress: fractionalToken.toLowerCase(),
          totalFractionalSupply: totalSupply.toString(),
        })
        .where(eq(properties.id, property.id));

      console.log(
        `   ✅ Synced investment pool creation for: "${property.title}"`,
      );
    } catch (error) {
      console.error(
        `   ❌ Failed to handle InvestmentPoolCreated:`,
        error.message,
      );
    }
  }

  async handleInvested(
    investmentId,
    investor,
    nftTokenId,
    amountPaid,
    tokensReceived,
    event,
  ) {
    try {
      const txHash = event.log?.transactionHash || event.transactionHash;

      // Idempotency guard — skip if we already recorded this tx
      const existing = await db
        .select({ id: investments.id })
        .from(investments)
        .where(eq(investments.transactionHash, txHash))
        .limit(1);
      if (existing.length > 0) {
        console.log(
          `   ℹ️  Investment tx ${txHash} already recorded, skipping`,
        );
        return;
      }

      // Find property by NFT token ID
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.nftTokenId, Number(nftTokenId)))
        .limit(1);

      if (!property) {
        console.log(`   ⚠️  Property with nftTokenId ${nftTokenId} not found`);
        return;
      }

      // Find investor user by wallet address
      const [user] = await db
        .select(USER_FIELDS)
        .from(users)
        .where(eq(users.walletAddress, investor.toLowerCase()))
        .limit(1);

      if (!user) {
        console.log(
          `   ⚠️  Investor with wallet ${investor} not found in database`,
        );
        return;
      }

      // Insert investment record
      await db.insert(investments).values({
        userId: user.id,
        propertyId: property.id,
        amountPaidRwaToken: ethers.formatEther(amountPaid),
        fractionalTokensReceived: ethers.formatEther(tokensReceived),
        transactionHash: txHash,
        investedAt: new Date(),
      });

      console.log(
        `   ✅ Investment recorded: ${user.email} invested in "${property.title}" — ${ethers.formatEther(amountPaid)} RWA`,
      );
    } catch (error) {
      console.error(`   ❌ Failed to handle Invested:`, error.message);
    }
  }

  async handleInvestmentPoolClosed(nftTokenId, event) {
    try {
      // Find property by NFT token ID
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.nftTokenId, Number(nftTokenId)))
        .limit(1);

      if (!property) {
        console.log(`   ⚠️  Property with nftTokenId ${nftTokenId} not found`);
        return;
      }

      // Pool closed means all fractional tokens are sold — mark property as active/trading
      await db
        .update(properties)
        .set({ status: "active" })
        .where(eq(properties.id, property.id));

      console.log(
        `   ✅ Investment pool closed for property: "${property.title}" — status set to active`,
      );
    } catch (error) {
      console.error(
        `   ❌ Failed to handle InvestmentPoolClosed:`,
        error.message,
      );
    }
  }

  // =============================================================================
  // REVENUE DISTRIBUTOR EVENT LISTENERS
  // =============================================================================

  startRevenueDistributorEventListeners() {
    if (!this.revenueDistributor) {
      console.log("⚠️  RevenueDistributor not initialized, skipping listeners");
      return;
    }
    console.log("👂 Starting RevenueDistributor event listeners...");

    // RevenueDeposited(uint256 assetId, address depositor, uint256 amount)
    this.revenueDistributor.on(
      "RevenueDeposited",
      async (assetId, depositor, amount, event) => {
        console.log(
          `📡 Event: RevenueDeposited(assetId: ${assetId}, amount: ${ethers.formatEther(amount)})`,
        );
        await this.handleRevenueDeposited(assetId, depositor, amount, event);
      },
    );

    // RevenueClaimed(uint256 assetId, address investor, uint256 amount)
    this.revenueDistributor.on(
      "RevenueClaimed",
      async (assetId, investor, amount, event) => {
        console.log(
          `📡 Event: RevenueClaimed(assetId: ${assetId}, investor: ${investor})`,
        );
        await this.handleRevenueClaimed(assetId, investor, amount, event);
      },
    );

    console.log("   ✅ RevenueDistributor event listeners active\n");
  }

  async handleRevenueDeposited(assetId, depositor, amount, event) {
    try {
      const txHash = event.log?.transactionHash || event.transactionHash;

      // Find property by assetRegistryId
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.assetRegistryId, assetId.toString()))
        .limit(1);

      if (!property) {
        console.log(
          `   ⚠️  Property with assetRegistryId ${assetId} not found`,
        );
        return;
      }

      // Record revenue distribution
      await db.insert(revenueDistributions).values({
        propertyId: property.id,
        totalRevenue: ethers.formatEther(amount),
        distributionDate: new Date(),
        transactionHash: txHash,
        status: "distributed",
      });

      console.log(
        `   ✅ Revenue deposited for "${property.title}": ${ethers.formatEther(amount)} tokens`,
      );
    } catch (error) {
      console.error(`   ❌ Failed to handle RevenueDeposited:`, error.message);
    }
  }

  async handleRevenueClaimed(assetId, investor, amount, event) {
    try {
      const amountEth = ethers.formatEther(amount);
      console.log(
        `   📡 RevenueClaimed: ${investor} claimed ${amountEth} ETH from asset ${assetId}`,
      );

      // 1. Find property by assetRegistryId
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.assetRegistryId, assetId.toString()))
        .limit(1);

      if (!property) {
        console.log(
          `   ⚠️  Property with assetRegistryId ${assetId} not found — skipping claim record`,
        );
        return;
      }

      // 2. Find investor user by wallet address
      const [user] = await db
        .select(USER_FIELDS)
        .from(users)
        .where(eq(users.walletAddress, investor.toLowerCase()))
        .limit(1);

      if (!user) {
        console.log(
          `   ⚠️  User with wallet ${investor} not found — skipping claim record`,
        );
        return;
      }

      // 3. Find most recent distribution for this property
      const [distribution] = await db
        .select()
        .from(revenueDistributions)
        .where(eq(revenueDistributions.propertyId, property.id))
        .orderBy(desc(revenueDistributions.distributionDate))
        .limit(1);

      if (!distribution) {
        console.log(
          `   ⚠️  No distribution record for property ${property.id} — claim recorded on-chain only`,
        );
        return;
      }

      // 4. Insert revenue share record
      await db
        .insert(revenueShares)
        .values({
          distributionId: distribution.id,
          investorId: user.id,
          shareAmount: amountEth,
          tokensHeld: "0",
        })
        .onConflictDoNothing();

      console.log(
        `   ✅ Revenue claim recorded: user ${user.id} claimed ${amountEth} ETH from distribution ${distribution.id}`,
      );
    } catch (error) {
      console.error(`   ❌ Failed to handle RevenueClaimed:`, error.message);
    }
  }

  // =============================================================================
  // SECONDARY MARKET EVENT LISTENERS
  // =============================================================================

  startSecondaryMarketEventListeners() {
    if (!this.secondaryMarket) {
      console.log("⚠️  SecondaryMarket not initialized, skipping listeners");
      return;
    }
    console.log("👂 Starting SecondaryMarket event listeners...");

    // OrderCreated(uint256 orderId, address trader, uint256 assetId, uint256 tokenAmount, uint256 pricePerToken, uint8 orderType)
    this.secondaryMarket.on(
      "OrderCreated",
      async (
        orderId,
        trader,
        assetId,
        tokenAmount,
        pricePerToken,
        orderType,
        event,
      ) => {
        console.log(
          `📡 Event: OrderCreated(orderId: ${orderId}, trader: ${trader}, assetId: ${assetId})`,
        );
        await this.handleOrderCreated(
          orderId,
          trader,
          assetId,
          tokenAmount,
          pricePerToken,
          orderType,
          event,
        );
      },
    );

    // OrderExecuted(uint256 orderId, uint256 tradeId, address buyer, address seller, uint256 assetId, uint256 amount, uint256 pricePerToken, uint256 totalPrice)
    this.secondaryMarket.on(
      "OrderExecuted",
      async (
        orderId,
        tradeId,
        buyer,
        seller,
        assetId,
        amount,
        pricePerToken,
        totalPrice,
        event,
      ) => {
        console.log(
          `📡 Event: OrderExecuted(orderId: ${orderId}, buyer: ${buyer}, seller: ${seller})`,
        );
        await this.handleOrderExecuted(
          orderId,
          tradeId,
          buyer,
          seller,
          assetId,
          amount,
          pricePerToken,
          totalPrice,
          event,
        );
      },
    );

    // OrderCancelled(uint256 orderId, address trader)
    this.secondaryMarket.on(
      "OrderCancelled",
      async (orderId, trader, event) => {
        console.log(
          `📡 Event: OrderCancelled(orderId: ${orderId}, trader: ${trader})`,
        );
        await this.handleOrderCancelled(orderId, trader, event);
      },
    );

    console.log("   ✅ SecondaryMarket event listeners active\n");
  }

  async handleOrderCreated(
    orderId,
    trader,
    assetId,
    tokenAmount,
    pricePerToken,
    orderType,
    event,
  ) {
    try {
      const txHash = event.log?.transactionHash || event.transactionHash;

      // Find seller user by wallet
      const [user] = await db
        .select(USER_FIELDS)
        .from(users)
        .where(eq(users.walletAddress, trader.toLowerCase()))
        .limit(1);

      if (!user) {
        console.log(`   ⚠️  Trader ${trader} not found in database`);
        return;
      }

      // Upsert listing record (identified by onChain orderId stored in externalOrderId if column exists)
      await db
        .insert(secondaryMarketListings)
        .values({
          sellerId: user.id,
          fractionalTokenId: Number(assetId), // assetId maps to fractional token context
          amount: ethers.formatEther(tokenAmount),
          pricePerToken: ethers.formatEther(pricePerToken),
          status: "active",
          listedAt: new Date(),
        })
        .onConflictDoNothing();

      console.log(
        `   ✅ Secondary market order created: orderId ${orderId} by ${trader}`,
      );
    } catch (error) {
      console.error(`   ❌ Failed to handle OrderCreated:`, error.message);
    }
  }

  async handleOrderExecuted(
    orderId,
    tradeId,
    buyer,
    seller,
    assetId,
    amount,
    pricePerToken,
    totalPrice,
    event,
  ) {
    try {
      const txHash = event.log?.transactionHash || event.transactionHash;

      // Find buyer user
      const [buyerUser] = await db
        .select(USER_FIELDS)
        .from(users)
        .where(eq(users.walletAddress, buyer.toLowerCase()))
        .limit(1);

      if (!buyerUser) {
        console.log(`   ⚠️  Buyer ${buyer} not found in database`);
        return;
      }

      // Find active listing for this order (simplified: get most recent active listing for seller/asset)
      const [listing] = await db
        .select()
        .from(secondaryMarketListings)
        .where(eq(secondaryMarketListings.status, "active"))
        .orderBy(desc(secondaryMarketListings.id))
        .limit(1);

      if (!listing) {
        console.log(`   ⚠️  No active listing found for order ${orderId}`);
        return;
      }

      // Mark listing as sold
      await db
        .update(secondaryMarketListings)
        .set({ status: "sold" })
        .where(eq(secondaryMarketListings.id, listing.id));

      // Record the trade
      await db
        .insert(secondaryMarketTrades)
        .values({
          listingId: listing.id,
          buyerId: buyerUser.id,
          amount: ethers.formatEther(amount),
          pricePerToken: ethers.formatEther(pricePerToken),
          totalPrice: ethers.formatEther(totalPrice),
          transactionHash: txHash,
          tradedAt: new Date(),
        })
        .onConflictDoNothing();

      console.log(
        `   ✅ Secondary market trade executed: orderId ${orderId}, buyer ${buyer}`,
      );
    } catch (error) {
      console.error(`   ❌ Failed to handle OrderExecuted:`, error.message);
    }
  }

  async handleOrderCancelled(orderId, trader, event) {
    try {
      // Find trader user
      const [user] = await db
        .select(USER_FIELDS)
        .from(users)
        .where(eq(users.walletAddress, trader.toLowerCase()))
        .limit(1);

      if (!user) {
        console.log(`   ⚠️  Trader ${trader} not found in database`);
        return;
      }

      // Mark most recent active listing by this user as cancelled
      const [listing] = await db
        .select()
        .from(secondaryMarketListings)
        .where(
          and(
            eq(secondaryMarketListings.sellerId, user.id),
            eq(secondaryMarketListings.status, "active"),
          ),
        )
        .orderBy(desc(secondaryMarketListings.id))
        .limit(1);

      if (listing) {
        await db
          .update(secondaryMarketListings)
          .set({ status: "cancelled" })
          .where(eq(secondaryMarketListings.id, listing.id));
      }

      console.log(
        `   ✅ Secondary market order cancelled: orderId ${orderId} by ${trader}`,
      );
    } catch (error) {
      console.error(`   ❌ Failed to handle OrderCancelled:`, error.message);
    }
  }

  // =============================================================================
  // NEW HANDLER METHODS
  // =============================================================================

  async handlePropertyFinancialsSet(propertyId, valuation, expectedROI, event) {
    try {
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.assetRegistryId, propertyId.toString()))
        .limit(1);

      if (!property) {
        console.log(
          `   ⚠️  Property with assetRegistryId ${propertyId} not found`,
        );
        return;
      }

      await db
        .update(properties)
        .set({
          valuation: valuation.toString(),
          expectedROI: expectedROI.toString(),
        })
        .where(eq(properties.id, property.id));

      console.log(
        `   ✅ Synced financials for property ${propertyId}: valuation=${valuation}`,
      );
    } catch (error) {
      console.error(
        `   ❌ Failed to handle PropertyFinancialsSet:`,
        error.message,
      );
    }
  }

  async handlePropertyLegalSet(propertyId, titleDeedHash, event) {
    try {
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.assetRegistryId, propertyId.toString()))
        .limit(1);

      if (!property) {
        console.log(
          `   ⚠️  Property with assetRegistryId ${propertyId} not found`,
        );
        return;
      }

      await db
        .update(properties)
        .set({ titleDeedHash })
        .where(eq(properties.id, property.id));

      console.log(`   ✅ Synced legal data for property ${propertyId}`);
    } catch (error) {
      console.error(`   ❌ Failed to handle PropertyLegalSet:`, error.message);
    }
  }

  async handleVerifierApplicationSubmitted(applicant, qualifications, event) {
    try {
      // Find user by wallet address
      const [user] = await db
        .select(USER_FIELDS)
        .from(users)
        .where(eq(users.walletAddress, applicant.toLowerCase()))
        .limit(1);

      if (!user) {
        console.log(`   ⚠️  Applicant ${applicant} not found in database`);
        return;
      }

      // Check if application already exists
      const existingApp = await db
        .select({ id: verifierApplications.id })
        .from(verifierApplications)
        .where(eq(verifierApplications.userId, user.id))
        .limit(1);

      if (existingApp.length === 0) {
        await db.insert(verifierApplications).values({
          userId: user.id,
          walletAddress: applicant.toLowerCase(),
          qualifications: qualifications || "",
          experience: "",
          specialization: "general",
          status: "pending",
        });
        console.log(`   ✅ Verifier application recorded for ${applicant}`);
      } else {
        console.log(
          `   ℹ️  Verifier application for ${applicant} already exists`,
        );
      }
    } catch (error) {
      console.error(
        `   ❌ Failed to handle VerifierApplicationSubmitted:`,
        error.message,
      );
    }
  }

  async handleVerifierApplicationApproved(applicant, reviewer, event) {
    try {
      const [user] = await db
        .select(USER_FIELDS)
        .from(users)
        .where(eq(users.walletAddress, applicant.toLowerCase()))
        .limit(1);

      if (!user) {
        console.log(`   ⚠️  Applicant ${applicant} not found in database`);
        return;
      }

      // Update application status
      await db
        .update(verifierApplications)
        .set({ status: "approved" })
        .where(eq(verifierApplications.userId, user.id));

      // Promote user role to verifier
      await db
        .update(users)
        .set({ role: "verifier" })
        .where(eq(users.id, user.id));

      console.log(`   ✅ Verifier application approved for ${applicant}`);
    } catch (error) {
      console.error(
        `   ❌ Failed to handle VerifierApplicationApproved:`,
        error.message,
      );
    }
  }

  async handleVerifierApplicationRejected(applicant, reviewer, event) {
    try {
      const [user] = await db
        .select(USER_FIELDS)
        .from(users)
        .where(eq(users.walletAddress, applicant.toLowerCase()))
        .limit(1);

      if (!user) {
        console.log(`   ⚠️  Applicant ${applicant} not found in database`);
        return;
      }

      await db
        .update(verifierApplications)
        .set({ status: "rejected" })
        .where(eq(verifierApplications.userId, user.id));

      console.log(`   ✅ Verifier application rejected for ${applicant}`);
    } catch (error) {
      console.error(
        `   ❌ Failed to handle VerifierApplicationRejected:`,
        error.message,
      );
    }
  }

  async handleAdminTransferred(oldAdmin, newAdmin, event) {
    try {
      // Demote old admin
      const [oldUser] = await db
        .select(USER_FIELDS)
        .from(users)
        .where(eq(users.walletAddress, oldAdmin.toLowerCase()))
        .limit(1);
      if (oldUser) {
        await db
          .update(users)
          .set({ role: "user" })
          .where(eq(users.id, oldUser.id));
      }

      // Promote new admin
      const [newUser] = await db
        .select(USER_FIELDS)
        .from(users)
        .where(eq(users.walletAddress, newAdmin.toLowerCase()))
        .limit(1);
      if (newUser) {
        await db
          .update(users)
          .set({ role: "admin" })
          .where(eq(users.id, newUser.id));
      }

      console.log(`   ✅ Admin transferred from ${oldAdmin} to ${newAdmin}`);
    } catch (error) {
      console.error(`   ❌ Failed to handle AdminTransferred:`, error.message);
    }
  }

  startPeriodicSync() {
    // Backup sync every 30 seconds (catches any missed events)
    this.syncInterval = setInterval(async () => {
      await this.performInitialSync();
    }, 30000);

    console.log("⏱️  Periodic sync enabled (every 30s)");
  }

  stop() {
    if (this.isListening) {
      this.assetRegistry.removeAllListeners();
      this.kycRegistry.removeAllListeners();
      this.roleManager.removeAllListeners();
      this.propertyNFT.removeAllListeners();
      this.investmentManager.removeAllListeners();
      if (this.revenueDistributor) this.revenueDistributor.removeAllListeners();
      if (this.secondaryMarket) this.secondaryMarket.removeAllListeners();
      console.log("🛑 Event listeners stopped");
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      console.log("🛑 Periodic sync stopped");
    }
  }
}

// Export singleton instance
export const blockchainSyncService = new BlockchainSyncService();
