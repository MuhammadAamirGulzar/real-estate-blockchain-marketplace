import { and, desc, eq } from "drizzle-orm";
import { ethers } from "ethers";
import { db } from "../db/connection.js";
import {
  properties,
  revenueDistributions,
  revenueShares,
  users,
} from "../db/schema.js";
import { web3Service } from "./web3Service.js";

/**
 * @title RevenueDistributionService
 * @notice Service for managing revenue distribution for tokenized properties
 * @dev Integrates with RevenueDistributor.sol contract
 *
 * Flow:
 * 1. Admin deposits ETH revenue for an asset via depositRevenue()
 * 2. Backend tracks the distribution in DB
 * 3. Investors check claimable amounts via getClaimableRevenue()
 * 4. Investors claim directly from frontend (contract transfers ETH to msg.sender)
 * 5. Backend records claims from blockchain events
 */
class RevenueDistributionService {
  /**
   * Get the RevenueDistributor contract instance
   */
  getContract() {
    if (!web3Service.initialized) {
      throw new Error("Web3Service not initialized");
    }
    const contract = web3Service.contracts.RevenueDistributor;
    if (!contract) {
      throw new Error("RevenueDistributor contract not available");
    }
    return contract;
  }

  /**
   * Activate revenue distribution for a property asset
   * @param {bigint|number|string} assetId - The asset registry ID
   */
  async activateAssetRevenue(assetId) {
    const contract = this.getContract();
    console.log(`🔓 Activating revenue distribution for asset ${assetId}...`);
    const tx = await contract.activateAssetRevenue(BigInt(assetId));
    const receipt = await tx.wait();
    console.log(`✅ Revenue activated for asset ${assetId}`);
    return receipt;
  }

  /**
   * Deposit revenue for a property (admin deposits ETH)
   * @param {Object} params
   * @param {number} params.propertyId - DB property ID
   * @param {string} params.amountEth - Amount in ETH (e.g., "0.5")
   * @param {number} params.adminUserId - Admin user ID for DB tracking
   * @param {string} params.description - Optional description / notes
   */
  async depositRevenue({ propertyId, amountEth, adminUserId, description }) {
    const contract = this.getContract();

    // Fetch property and get assetRegistryId
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, propertyId));

    if (!property) throw new Error(`Property ${propertyId} not found`);
    if (!property.assetRegistryId) {
      throw new Error(
        `Property ${propertyId} has no assetRegistryId - must be registered on blockchain first`,
      );
    }
    if (!property.nftTokenId) {
      throw new Error(`Property ${propertyId} is not tokenized yet`);
    }

    const assetId = BigInt(property.assetRegistryId);
    const amountWei = ethers.parseEther(amountEth.toString());

    console.log(
      `💰 Depositing ${amountEth} ETH revenue for property ${propertyId} (assetId: ${assetId})`,
    );

    // Ensure asset revenue is activated first
    try {
      const assetRevInfo = await contract.getAssetRevenueInfo(assetId);
      if (!assetRevInfo.isActive) {
        console.log(`🔓 Asset revenue not active - activating first...`);
        await this.activateAssetRevenue(assetId);
      }
    } catch (err) {
      console.warn(`Could not check asset revenue status: ${err.message}`);
      // Try activating anyway
      await this.activateAssetRevenue(assetId);
    }

    // Deposit revenue on blockchain
    const tx = await contract.depositRevenue(assetId, { value: amountWei });
    const receipt = await tx.wait();

    console.log(`✅ Revenue deposited - tx: ${receipt.hash}`);

    // Record in database after successful blockchain transaction
    const [distribution] = await db
      .insert(revenueDistributions)
      .values({
        propertyId,
        totalRevenue: amountEth.toString(),
        distributionDate: new Date(),
        transactionHash: receipt.hash,
        status: "completed",
        distributionMessage: description || null,
        distributedBy: adminUserId,
      })
      .returning();

    return {
      distributionId: distribution.id,
      transactionHash: receipt.hash,
      amountEth,
      assetId: assetId.toString(),
      propertyId,
    };
  }

  /**
   * Get claimable revenue for an investor for a specific asset
   * @param {string} investorAddress - Investor wallet address
   * @param {bigint|number|string} assetId - Asset registry ID
   * @returns {string} Claimable amount in ETH
   */
  async getClaimableRevenue(investorAddress, assetId) {
    const contract = this.getContract();
    const claimableWei = await contract.getClaimableRevenue(
      BigInt(assetId),
      investorAddress,
    );
    return ethers.formatEther(claimableWei);
  }

  /**
   * Get total claimable revenue for an investor across multiple assets
   * @param {string} investorAddress - Investor wallet address
   * @param {Array<bigint|string>} assetIds - Array of asset registry IDs
   * @returns {string} Total claimable amount in ETH
   */
  async getTotalClaimableRevenue(investorAddress, assetIds) {
    const contract = this.getContract();
    const bigintIds = assetIds.map((id) => BigInt(id));
    const totalWei = await contract.getTotalClaimableRevenue(
      investorAddress,
      bigintIds,
    );
    return ethers.formatEther(totalWei);
  }

  /**
   * Get claimable revenue across all user's invested properties
   * @param {number} userId - DB user ID
   * @param {string} walletAddress - User wallet address
   * @returns {Array} Per-property claimable amounts
   */
  async getUserClaimableRevenue(userId, walletAddress) {
    const contract = this.getContract();

    if (!walletAddress) {
      return { properties: [], totalClaimable: "0" };
    }

    // Get all tokenized properties (they could have revenue)
    const tokenizedProperties = await db
      .select({
        id: properties.id,
        title: properties.title,
        location: properties.location,
        assetRegistryId: properties.assetRegistryId,
        nftTokenId: properties.nftTokenId,
      })
      .from(properties)
      .where(and(eq(properties.status, "tokenized")));

    const results = [];
    let totalClaimableWei = 0n;

    for (const prop of tokenizedProperties) {
      if (!prop.assetRegistryId) continue;

      try {
        const assetId = BigInt(prop.assetRegistryId);
        const claimableWei = await contract.getClaimableRevenue(
          assetId,
          walletAddress,
        );

        if (claimableWei > 0n) {
          totalClaimableWei += claimableWei;
          results.push({
            propertyId: prop.id,
            propertyTitle: prop.title,
            propertyLocation: prop.location,
            assetRegistryId: prop.assetRegistryId.toString(),
            assetId: assetId.toString(),
            claimableEth: ethers.formatEther(claimableWei),
            claimableWei: claimableWei.toString(),
          });
        }
      } catch (err) {
        console.warn(
          `Could not get claimable for asset ${prop.assetRegistryId}: ${err.message}`,
        );
      }
    }

    return {
      properties: results,
      totalClaimable: ethers.formatEther(totalClaimableWei),
    };
  }

  /**
   * Get asset revenue information from blockchain
   * @param {bigint|number|string} assetId - Asset registry ID
   */
  async getAssetRevenueInfo(assetId) {
    const contract = this.getContract();
    const info = await contract.getAssetRevenueInfo(BigInt(assetId));
    return {
      totalDeposited: ethers.formatEther(info.totalDeposited),
      totalClaimed: ethers.formatEther(info.totalClaimed),
      unclaimed: ethers.formatEther(info.totalDeposited - info.totalClaimed),
      lastDistributionTime:
        info.lastDistributionTime.toString() !== "0"
          ? new Date(Number(info.lastDistributionTime) * 1000)
          : null,
      isActive: info.isActive,
    };
  }

  /**
   * Get revenue distribution history for a property from DB
   * @param {number} propertyId - DB property ID
   */
  async getPropertyRevenueHistory(propertyId) {
    return db
      .select({
        id: revenueDistributions.id,
        totalRevenue: revenueDistributions.totalRevenue,
        distributionDate: revenueDistributions.distributionDate,
        transactionHash: revenueDistributions.transactionHash,
        status: revenueDistributions.status,
        notes: revenueDistributions.distributionMessage,
        adminFirstName: users.firstName,
        adminLastName: users.lastName,
        adminEmail: users.email,
      })
      .from(revenueDistributions)
      .leftJoin(users, eq(revenueDistributions.distributedBy, users.id))
      .where(eq(revenueDistributions.propertyId, propertyId))
      .orderBy(desc(revenueDistributions.distributionDate));
  }

  /**
   * Get all revenue distributions (admin view)
   */
  async getAllRevenueDistributions() {
    return db
      .select({
        id: revenueDistributions.id,
        propertyId: revenueDistributions.propertyId,
        propertyTitle: properties.title,
        propertyLocation: properties.location,
        assetRegistryId: properties.assetRegistryId,
        totalRevenue: revenueDistributions.totalRevenue,
        distributionDate: revenueDistributions.distributionDate,
        transactionHash: revenueDistributions.transactionHash,
        status: revenueDistributions.status,
        notes: revenueDistributions.distributionMessage,
        adminFirstName: users.firstName,
        adminLastName: users.lastName,
      })
      .from(revenueDistributions)
      .leftJoin(properties, eq(revenueDistributions.propertyId, properties.id))
      .leftJoin(users, eq(revenueDistributions.distributedBy, users.id))
      .orderBy(desc(revenueDistributions.distributionDate));
  }

  /**
   * Record a claim event (called after frontend confirms on-chain claim)
   * @param {Object} params - Claim details
   */
  async recordClaim({ userId, propertyId, assetId, amountEth, txHash }) {
    const [distribution] = await db
      .select()
      .from(revenueDistributions)
      .where(
        and(
          eq(revenueDistributions.propertyId, propertyId),
          eq(revenueDistributions.status, "completed"),
        ),
      )
      .orderBy(desc(revenueDistributions.distributionDate))
      .limit(1);

    if (distribution) {
      await db.insert(revenueShares).values({
        distributionId: distribution.id,
        investorId: userId,
        shareAmount: amountEth.toString(),
        tokensHeld: "0", // Could be enriched with actual token balance
      });
    }

    return { recorded: true, txHash };
  }
}

export default new RevenueDistributionService();
