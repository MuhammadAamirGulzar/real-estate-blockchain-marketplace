import { eq, isNotNull } from "drizzle-orm";
import { ethers } from "ethers";
import { db } from "../db/connection.js";
import { kycSubmissions, properties, users } from "../db/schema.js";
import { web3Service } from "./web3Service.js";

/**
 * State Reconciliation Service
 * Compares database state with blockchain state and fixes mismatches
 * Blockchain is always the source of truth
 */
class StateReconciliationService {
  constructor() {
    this.reconcileInterval = null;
    this.isReconciling = false;
    this.lastReconciliation = null;
    this.reconciliationResults = {
      kycMismatches: 0,
      propertyMismatches: 0,
      roleMismatches: 0,
      fixed: 0,
      errors: 0,
    };
  }

  /**
   * Start automatic reconciliation on a schedule
   * @param {number} intervalMinutes - Interval in minutes between reconciliation runs
   */
  startAutoReconciliation(intervalMinutes = 60) {
    if (this.reconcileInterval) {
      console.warn("⚠️ Auto-reconciliation already running");
      return;
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(
      `🔄 Starting auto-reconciliation every ${intervalMinutes} minutes`,
    );

    this.reconcileInterval = setInterval(async () => {
      await this.reconcileAll();
    }, intervalMs);

    // Run immediately on start
    this.reconcileAll();
  }

  /**
   * Stop automatic reconciliation
   */
  stopAutoReconciliation() {
    if (this.reconcileInterval) {
      clearInterval(this.reconcileInterval);
      this.reconcileInterval = null;
      console.log("🛑 Auto-reconciliation stopped");
    }
  }

  /**
   * Run full reconciliation (KYC, Properties, Roles)
   * @param {boolean} autoFix - Whether to automatically fix mismatches
   */
  async reconcileAll(autoFix = true) {
    if (this.isReconciling) {
      console.warn("⚠️ Reconciliation already in progress");
      return null;
    }

    this.isReconciling = true;
    console.log("🔄 Starting full state reconciliation...");

    try {
      await web3Service.ensureInitialized();

      // Reset results
      this.reconciliationResults = {
        kycMismatches: 0,
        propertyMismatches: 0,
        roleMismatches: 0,
        fixed: 0,
        errors: 0,
      };

      // Run all reconciliation checks
      await this.reconcileKYCStatuses(autoFix);
      await this.reconcilePropertyStatuses(autoFix);
      await this.reconcileUserRoles(autoFix);

      this.lastReconciliation = new Date();

      console.log("✅ Full reconciliation complete");
      console.log("📊 Results:", this.reconciliationResults);

      return this.reconciliationResults;
    } catch (error) {
      console.error("❌ Reconciliation failed:", error);
      throw error;
    } finally {
      this.isReconciling = false;
    }
  }

  /**
   * Reconcile KYC statuses between database and blockchain
   */
  async reconcileKYCStatuses(autoFix = true) {
    console.log("🔍 Reconciling KYC statuses...");

    try {
      // Get all users with wallet addresses
      const usersWithWallets = await db
        .select()
        .from(users)
        .where(isNotNull(users.walletAddress));

      console.log(`Checking ${usersWithWallets.length} users...`);

      for (const user of usersWithWallets) {
        try {
          // Get blockchain KYC status
          const blockchainStatus = await web3Service.getKYCStatus(
            user.walletAddress,
          );
          const blockchainApproved = await web3Service.isKycApproved(
            user.walletAddress,
          );

          // Map blockchain status to DB status
          // KYCRegistry enum: 0=NotSubmitted, 1=Pending, 2=Approved, 3=Rejected
          let expectedDbStatus;
          switch (Number(blockchainStatus)) {
            case 0:
              expectedDbStatus = "not_submitted";
              break;
            case 1:
              expectedDbStatus = "pending";
              break;
            case 2:
              expectedDbStatus = "approved";
              break;
            case 3:
              expectedDbStatus = "rejected";
              break;
            default:
              expectedDbStatus = "not_submitted";
          }

          // Get DB KYC status
          const [kycSubmission] = await db
            .select()
            .from(kycSubmissions)
            .where(eq(kycSubmissions.userId, user.id))
            .limit(1);

          const dbStatus = kycSubmission?.status || "not_submitted";
          const dbKycStatus = user.kycStatus;

          // Check for mismatches
          if (
            dbStatus !== expectedDbStatus ||
            dbKycStatus !== expectedDbStatus
          ) {
            console.log(`⚠️ KYC mismatch for user ${user.email}:`);
            console.log(`  - Blockchain: ${expectedDbStatus}`);
            console.log(`  - DB kyc_submissions: ${dbStatus}`);
            console.log(`  - DB users.kycStatus: ${dbKycStatus}`);

            this.reconciliationResults.kycMismatches++;

            if (autoFix) {
              // Fix the mismatch (blockchain is source of truth)
              if (kycSubmission) {
                await db
                  .update(kycSubmissions)
                  .set({
                    status: expectedDbStatus,
                    updatedAt: new Date(),
                  })
                  .where(eq(kycSubmissions.id, kycSubmission.id));
              }

              await db
                .update(users)
                .set({ kycStatus: expectedDbStatus })
                .where(eq(users.id, user.id));

              console.log(`  ✅ Fixed → ${expectedDbStatus}`);
              this.reconciliationResults.fixed++;
            }
          }
        } catch (error) {
          console.error(
            `  ❌ Error checking user ${user.email}:`,
            error.message,
          );
          this.reconciliationResults.errors++;
        }
      }

      console.log(
        `✅ KYC reconciliation complete: ${this.reconciliationResults.kycMismatches} mismatches found`,
      );
    } catch (error) {
      console.error("❌ KYC reconciliation failed:", error);
      throw error;
    }
  }

  /**
   * Reconcile property statuses and verification states
   */
  async reconcilePropertyStatuses(autoFix = true) {
    console.log("🔍 Reconciling property statuses...");

    try {
      // Get all properties with blockchain IDs
      const propertiesWithIds = await db
        .select()
        .from(properties)
        .where(isNotNull(properties.assetRegistryId));

      console.log(`Checking ${propertiesWithIds.length} properties...`);

      for (const property of propertiesWithIds) {
        try {
          const propertyId = property.assetRegistryId;

          // Get blockchain property data
          const blockchainProperty = await web3Service
            .getContract("AssetRegistry")
            .getProperty(propertyId);

          // Check if property exists on blockchain
          if (
            !blockchainProperty ||
            blockchainProperty.lister === ethers.ZeroAddress
          ) {
            console.log(`⚠️ Property ${property.id} not found on blockchain`);
            this.reconciliationResults.propertyMismatches++;
            continue;
          }

          // Map blockchain verification status to DB status
          const isVerified = blockchainProperty.isVerified || false;
          const expectedDbStatus = isVerified ? "verified" : property.status;

          // Check for mismatch
          if (property.status !== expectedDbStatus) {
            console.log(`⚠️ Property mismatch for ${property.title}:`);
            console.log(`  - Blockchain verified: ${isVerified}`);
            console.log(`  - DB status: ${property.status}`);

            this.reconciliationResults.propertyMismatches++;

            if (autoFix && isVerified && property.status !== "verified") {
              await db
                .update(properties)
                .set({
                  status: "verified",
                  updatedAt: new Date(),
                })
                .where(eq(properties.id, property.id));

              console.log(`  ✅ Fixed → verified`);
              this.reconciliationResults.fixed++;
            }
          }

          // Check verifier assignment
          const blockchainVerifier = blockchainProperty.verifier;
          if (blockchainVerifier && blockchainVerifier !== ethers.ZeroAddress) {
            const [verifierUser] = await db
              .select()
              .from(users)
              .where(eq(users.walletAddress, blockchainVerifier.toLowerCase()))
              .limit(1);

            if (
              verifierUser &&
              property.assignedVerifierId !== verifierUser.id
            ) {
              console.log(
                `⚠️ Verifier mismatch for property ${property.title}`,
              );
              console.log(`  - Blockchain verifier: ${blockchainVerifier}`);
              console.log(`  - DB verifier ID: ${property.assignedVerifierId}`);

              this.reconciliationResults.propertyMismatches++;

              if (autoFix) {
                await db
                  .update(properties)
                  .set({
                    assignedVerifierId: verifierUser.id,
                    updatedAt: new Date(),
                  })
                  .where(eq(properties.id, property.id));

                console.log(`  ✅ Fixed verifier assignment`);
                this.reconciliationResults.fixed++;
              }
            }
          }
        } catch (error) {
          // Property might not exist on blockchain yet
          if (error.message.includes("Property does not exist")) {
            console.log(
              `  ℹ️ Property ${property.title} pending blockchain registration`,
            );
          } else {
            console.error(
              `  ❌ Error checking property ${property.id}:`,
              error.message,
            );
            this.reconciliationResults.errors++;
          }
        }
      }

      console.log(
        `✅ Property reconciliation complete: ${this.reconciliationResults.propertyMismatches} mismatches found`,
      );
    } catch (error) {
      console.error("❌ Property reconciliation failed:", error);
      throw error;
    }
  }

  /**
   * Reconcile user roles with blockchain
   */
  async reconcileUserRoles(autoFix = true) {
    console.log("🔍 Reconciling user roles...");

    try {
      const usersWithWallets = await db
        .select()
        .from(users)
        .where(isNotNull(users.walletAddress));

      console.log(`Checking ${usersWithWallets.length} user roles...`);

      const ADMIN_ROLE = ethers.id("ADMIN_ROLE");
      const SUB_ADMIN_ROLE = ethers.id("SUB_ADMIN_ROLE");
      const VERIFIER_ROLE = ethers.id("VERIFIER_ROLE");
      const USER_ROLE = ethers.id("USER_ROLE");

      for (const user of usersWithWallets) {
        try {
          // Check all roles on blockchain
          const hasAdmin = await web3Service.hasRole(
            ADMIN_ROLE,
            user.walletAddress,
          );
          const hasSubAdmin = await web3Service.hasRole(
            SUB_ADMIN_ROLE,
            user.walletAddress,
          );
          const hasVerifier = await web3Service.hasRole(
            VERIFIER_ROLE,
            user.walletAddress,
          );
          const hasUserRole = await web3Service.hasRole(
            USER_ROLE,
            user.walletAddress,
          );

          // Determine expected role based on blockchain
          let expectedDbRole = "user"; // default

          if (hasAdmin || hasSubAdmin) {
            expectedDbRole = "admin";
          } else if (hasVerifier) {
            expectedDbRole = "verifier";
          } else if (hasUserRole) {
            expectedDbRole = "user";
          }

          // Check for mismatch
          if (user.role !== expectedDbRole) {
            console.log(`⚠️ Role mismatch for user ${user.email}:`);
            console.log(
              `  - Blockchain roles: Admin=${hasAdmin}, SubAdmin=${hasSubAdmin}, Verifier=${hasVerifier}, User=${hasUserRole}`,
            );
            console.log(`  - DB role: ${user.role}`);
            console.log(`  - Expected role: ${expectedDbRole}`);

            this.reconciliationResults.roleMismatches++;

            if (autoFix) {
              await db
                .update(users)
                .set({ role: expectedDbRole })
                .where(eq(users.id, user.id));

              console.log(`  ✅ Fixed → ${expectedDbRole}`);
              this.reconciliationResults.fixed++;
            }
          }
        } catch (error) {
          console.error(
            `  ❌ Error checking roles for user ${user.email}:`,
            error.message,
          );
          this.reconciliationResults.errors++;
        }
      }

      console.log(
        `✅ Role reconciliation complete: ${this.reconciliationResults.roleMismatches} mismatches found`,
      );
    } catch (error) {
      console.error("❌ Role reconciliation failed:", error);
      throw error;
    }
  }

  /**
   * Get last reconciliation results
   */
  getLastResults() {
    return {
      lastRun: this.lastReconciliation,
      results: this.reconciliationResults,
      isReconciling: this.isReconciling,
    };
  }

  /**
   * Generate reconciliation report
   */
  async generateReport(autoFix = false) {
    console.log("📊 Generating reconciliation report...");

    const results = await this.reconcileAll(autoFix);

    const report = {
      timestamp: new Date().toISOString(),
      totalMismatches:
        results.kycMismatches +
        results.propertyMismatches +
        results.roleMismatches,
      autoFixEnabled: autoFix,
      details: {
        kyc: {
          mismatches: results.kycMismatches,
          fixed: autoFix ? results.fixed : 0,
        },
        properties: {
          mismatches: results.propertyMismatches,
          fixed: autoFix ? results.fixed : 0,
        },
        roles: {
          mismatches: results.roleMismatches,
          fixed: autoFix ? results.fixed : 0,
        },
        errors: results.errors,
      },
      recommendation:
        results.kycMismatches +
          results.propertyMismatches +
          results.roleMismatches >
        0
          ? "Mismatches detected. Consider running with autoFix=true or investigating root cause."
          : "System in sync. No action needed.",
    };

    console.log("📄 Reconciliation Report:");
    console.log(JSON.stringify(report, null, 2));

    return report;
  }
}

// Export singleton instance
export const stateReconciliationService = new StateReconciliationService();

// Auto-start option (disabled by default for production safety)
const AUTO_START = process.env.STATE_RECONCILIATION_AUTO_START === "true";
const RECONCILE_INTERVAL = parseInt(
  process.env.RECONCILE_INTERVAL_MINUTES || "60",
  10,
);

if (AUTO_START) {
  stateReconciliationService.startAutoReconciliation(RECONCILE_INTERVAL);
}
