import crypto from "crypto";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { db } from "../db/connection.js";
import { investments, properties, users } from "../db/schema.js";
import stripeService from "./stripeService.js";
import { web3Service } from "./web3Service.js";

dotenv.config();

class InvestmentService {
  constructor() {
    // Contract will be loaded via web3Service singleton
    this.contract = null;
  }

  /**
   * Get InvestmentManager contract instance
   * Lazy-loads from web3Service when needed
   */
  async getContract() {
    if (!this.contract) {
      await web3Service.ensureInitialized();
      this.contract = web3Service.getContract("InvestmentManager");
    }
    return this.contract;
  }

  /**
   * Create an investment pool for a property
   * @param {Object} params - Pool parameters
   */
  async createInvestmentPool({ nftTokenId, pricePerToken, minInvestment }) {
    try {
      console.log(`🏊 Creating investment pool for NFT ${nftTokenId}...`);

      const contract = await this.getContract();
      const tx = await contract.createInvestmentPool(
        nftTokenId,
        ethers.parseEther(pricePerToken.toString()), // Price per fractional token in RWAP
        ethers.parseEther(minInvestment.toString()), // Min RWAP investment
      );

      const receipt = await tx.wait();

      console.log(`✅ Investment pool created for NFT ${nftTokenId}`);
      return receipt;
    } catch (error) {
      console.error("❌ Failed to create investment pool:", error);
      throw error;
    }
  }

  /**
   * Process an investment
   * @param {Object} params - Investment parameters
   */
  async processInvestment({
    investorAddress,
    nftTokenId,
    platformTokenAmount,
  }) {
    try {
      console.log(`💰 Processing investment for ${investorAddress}...`);

      // Create a signer for the investor
      await web3Service.ensureInitialized();
      const provider = web3Service.provider;
      const investorSigner = new ethers.Wallet(
        process.env.INVESTOR_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY,
        provider,
      );
      const contract = await this.getContract();
      const investorContract = contract.connect(investorSigner);

      const tx = await investorContract.invest(
        nftTokenId,
        ethers.parseEther(platformTokenAmount.toString()),
      );

      const receipt = await tx.wait();

      // Extract investment event (contract already declared above)
      const investEvent = receipt.logs.find(
        (log) =>
          log.topics[0] === contract.interface.getEvent("Invested").topicHash,
      );

      const investmentId = investEvent ? Number(investEvent.args[0]) : null;
      const fractionalTokensReceived = investEvent
        ? ethers.formatEther(investEvent.args[4])
        : "0";

      console.log(`✅ Investment processed - ID: ${investmentId}`);

      return {
        investmentId,
        fractionalTokensReceived,
        transactionHash: receipt.hash,
      };
    } catch (error) {
      console.error("❌ Failed to process investment:", error);
      throw error;
    }
  }

  /**
   * Get investor's portfolio
   * @param {string} investorAddress - Investor wallet address
   */
  async getInvestorPortfolio(investorAddress) {
    try {
      const contract = await this.getContract();
      const investments =
        await contract.getInvestorInvestments(investorAddress);

      return investments.map((inv) => ({
        investmentId: inv.investmentId.toString(),
        nftTokenId: inv.nftTokenId.toString(),
        platformTokenPaid: ethers.formatEther(inv.platformTokenPaid),
        fractionalTokensReceived: ethers.formatEther(
          inv.fractionalTokensReceived,
        ),
        timestamp: new Date(Number(inv.timestamp) * 1000),
        isActive: inv.isActive,
      }));
    } catch (error) {
      console.error("❌ Failed to get portfolio:", error);
      throw error;
    }
  }

  /**
   * Close an investment pool
   * @param {number} nftTokenId - NFT token ID
   */
  async closeInvestmentPool(nftTokenId) {
    try {
      const contract = await this.getContract();
      const tx = await contract.closeInvestmentPool(nftTokenId);
      const receipt = await tx.wait();

      console.log(`✅ Investment pool closed for NFT ${nftTokenId}`);
      return receipt;
    } catch (error) {
      console.error("❌ Failed to close investment pool:", error);
      throw error;
    }
  }

  /**
   * Get investment pool details
   * @param {number} nftTokenId - NFT token ID
   */
  async getInvestmentPool(nftTokenId) {
    try {
      const contract = await this.getContract();
      const pool = await contract.investmentPools(nftTokenId);

      return {
        nftTokenId: pool.nftTokenId.toString(),
        fractionalTokenContract: pool.fractionalTokenContract,
        totalFractionalTokens: ethers.formatEther(pool.totalFractionalTokens),
        availableFractionalTokens: ethers.formatEther(
          pool.availableFractionalTokens,
        ),
        pricePerToken: ethers.formatEther(pool.pricePerToken),
        minInvestment: ethers.formatEther(pool.minInvestment),
        isOpen: pool.isOpen,
      };
    } catch (error) {
      console.error("❌ Failed to get investment pool:", error);
      throw error;
    }
  }

  /**
   * Create investment (user intent)
   */
  async createInvestment({
    userId,
    walletAddress,
    propertyId,
    investmentAmount, // USD cents
    paymentMethod, // 'crypto' or 'fiat'
    paymentReference,
  }) {
    try {
      console.log(
        `💸 Creating investment for user ${userId} in property ${propertyId}...`,
      );

      await web3Service.ensureInitialized();

      // Verify KYC
      const kycRegistry = web3Service.getContract("KYCRegistry");
      const isKYCApproved = await kycRegistry.isKYCApproved(walletAddress);

      if (!isKYCApproved) {
        throw new Error("KYC approval required before investing");
      }

      // Get property details
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.id, propertyId));

      if (!property) throw new Error("Property not found");
      if (
        !["tokenized", "active", "open_for_investment"].includes(
          property.status,
        )
      ) {
        throw new Error("Property is not available for investment");
      }

      const isStripeFiatPayment =
        paymentMethod === "fiat" &&
        typeof paymentReference === "string" &&
        paymentReference.startsWith("pi_");

      const normalizedPaymentMethod =
        paymentMethod === "crypto"
          ? "crypto_rwap"
          : isStripeFiatPayment
            ? "stripe"
            : paymentMethod;

      const parsedInvestmentAmount = Number(investmentAmount);
      const normalizedFiatAmount = Number.isFinite(parsedInvestmentAmount)
        ? (parsedInvestmentAmount / 1_000_000).toFixed(2)
        : null;

      let transactionHash = `0x${crypto.randomBytes(32).toString("hex")}`;
      let amountPaidRwaToken = "0";
      let fractionalTokensReceived = "0";
      let paymentStatus = "pending_proof";

      const formatWeiToTokenDecimal = (valueWei) =>
        ethers.formatUnits(BigInt(valueWei.toString()), 18);

      if (paymentMethod === "crypto") {
        if (!walletAddress || !ethers.isAddress(walletAddress)) {
          throw new Error(
            "Valid wallet address is required for crypto investment",
          );
        }

        if (!/^0x[a-fA-F0-9]{64}$/.test(paymentReference || "")) {
          throw new Error("Valid crypto transaction hash is required");
        }

        if (property.nftTokenId === null || property.nftTokenId === undefined) {
          throw new Error(
            "Property is not linked to an on-chain investment pool",
          );
        }

        const investmentManager = web3Service.getContract("InvestmentManager");
        const receipt =
          await web3Service.provider.getTransactionReceipt(paymentReference);

        if (!receipt || receipt.status !== 1) {
          throw new Error("Crypto transaction is not confirmed on-chain yet");
        }

        const investedEvent = receipt.logs
          .map((log) => {
            try {
              return investmentManager.interface.parseLog(log);
            } catch {
              return null;
            }
          })
          .find((parsedLog) => parsedLog?.name === "Invested");

        if (!investedEvent) {
          throw new Error("Investment transaction is missing Invested event");
        }

        const eventWallet = (investedEvent.args.investor || "").toLowerCase();
        if (eventWallet !== walletAddress.toLowerCase()) {
          throw new Error("Transaction investor does not match your wallet");
        }

        const eventNftTokenId = Number(investedEvent.args.nftTokenId);
        if (eventNftTokenId !== Number(property.nftTokenId)) {
          throw new Error("Transaction is for a different property");
        }

        transactionHash = receipt.hash;
        amountPaidRwaToken = formatWeiToTokenDecimal(
          investedEvent.args.platformTokenPaid,
        );
        fractionalTokensReceived = formatWeiToTokenDecimal(
          investedEvent.args.fractionalTokensReceived,
        );
        paymentStatus = "completed";

        // If event listener already inserted this tx, return existing record.
        const [existingByTx] = await db
          .select()
          .from(investments)
          .where(eq(investments.transactionHash, transactionHash))
          .limit(1);

        if (existingByTx) {
          return {
            success: true,
            investmentId: existingByTx.id,
            onChainInvestmentId: null,
            sharesReceived: existingByTx.fractionalTokensReceived,
            transactionHash,
          };
        }
      } else if (isStripeFiatPayment) {
        const paymentIntent =
          await stripeService.getPaymentIntentStatus(paymentReference);

        if (paymentIntent.status !== "succeeded") {
          throw new Error(
            `Stripe payment is ${paymentIntent.status}. Complete payment before investing.`,
          );
        }

        // Keep transaction_hash format consistent with on-chain hashes.
        transactionHash = `0x${crypto.createHash("sha256").update(paymentReference).digest("hex")}`;
        paymentStatus = "completed";
      }

      let dbInvestment;

      try {
        [dbInvestment] = await db
          .insert(investments)
          .values({
            userId,
            propertyId,
            amountPaidRwaToken,
            fractionalTokensReceived,
            transactionHash,
            paymentMethod: normalizedPaymentMethod,
            paymentCurrency: "USD",
            fiatAmount: paymentMethod === "fiat" ? normalizedFiatAmount : null,
            paymentStatus,
          })
          .returning();
      } catch (dbError) {
        // Idempotency fallback for concurrent event-listener insertion.
        if (dbError?.code === "23505" || dbError?.cause?.code === "23505") {
          const [existingByTx] = await db
            .select()
            .from(investments)
            .where(eq(investments.transactionHash, transactionHash))
            .limit(1);

          if (existingByTx) {
            dbInvestment = existingByTx;
          } else {
            throw dbError;
          }
        } else {
          throw dbError;
        }
      }

      console.log(`✅ Investment intent created: DB ID ${dbInvestment.id}`);

      return {
        success: true,
        investmentId: dbInvestment.id,
        onChainInvestmentId: null,
        sharesReceived: fractionalTokensReceived,
        transactionHash,
      };
    } catch (error) {
      console.error("❌ Investment creation failed:", error);
      throw error;
    }
  }

  /**
   * Complete investment (mint tokens after payment verification)
   */
  async completeInvestment(investmentId) {
    try {
      console.log(`✅ Completing investment ${investmentId}...`);

      await web3Service.ensureInitialized();

      // Get investment from database
      const [investment] = await db
        .select()
        .from(investments)
        .where(eq(investments.id, investmentId));

      if (!investment) throw new Error("Investment not found");
      if (investment.status !== "pending") {
        throw new Error("Investment not in pending status");
      }

      // Complete on blockchain (mints tokens)
      const investmentManager = web3Service.getContract("InvestmentManager");

      const tx = await investmentManager.completeInvestment(
        investment.blockchainInvestmentId,
      );

      const receipt = await tx.wait();
      console.log(`✅ Investment completed on-chain. Tx: ${receipt.hash}`);

      // Update database
      await db
        .update(investments)
        .set({
          status: "completed",
          completedAt: new Date(),
          completionTransactionHash: receipt.hash,
        })
        .where(eq(investments.id, investmentId));

      // Update property available shares
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.id, investment.propertyId));

      const newAvailableShares =
        BigInt(property.availableShares) - BigInt(investment.sharesReceived);

      await db
        .update(properties)
        .set({
          availableShares: newAvailableShares.toString(),
          updatedAt: new Date(),
        })
        .where(eq(properties.id, investment.propertyId));

      console.log(`✅ Investment ${investmentId} completed successfully`);

      return {
        success: true,
        transactionHash: receipt.hash,
      };
    } catch (error) {
      console.error("❌ Investment completion failed:", error);
      throw error;
    }
  }

  /**
   * Get investor portfolio (combine on-chain + database)
   */
  async getInvestorPortfolio(walletAddress) {
    try {
      await web3Service.ensureInitialized();

      // Get on-chain portfolio
      const investmentManager = web3Service.getContract("InvestmentManager");
      const onChainPortfolio =
        await investmentManager.getInvestorPortfolio(walletAddress);

      // Get user from database
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.walletAddress, walletAddress));

      if (!user) return [];

      // Get database investments
      const dbInvestments = await db
        .select({
          investment: investments,
          property: properties,
        })
        .from(investments)
        .leftJoin(properties, eq(investments.propertyId, properties.id))
        .where(eq(investments.userId, user.id));

      // Combine data
      const portfolio = dbInvestments.map((item) => ({
        investmentId: item.investment.id,
        onChainInvestmentId: item.investment.blockchainInvestmentId,
        property: {
          id: item.property.id,
          title: item.property.title,
          address: item.property.address,
          city: item.property.city,
          imageUrl: item.property.imageUrl,
          valuation: item.property.valuation,
          nftTokenId: item.property.nftTokenId,
        },
        investmentAmount: item.investment.amount,
        sharesReceived: item.investment.sharesReceived,
        status: item.investment.status,
        createdAt: item.investment.createdAt,
        completedAt: item.investment.completedAt,
      }));

      return portfolio;
    } catch (error) {
      console.error("❌ Failed to get portfolio:", error);
      throw error;
    }
  }

  /**
   * Check if user can invest (KYC + role checks)
   */
  async canUserInvest(walletAddress) {
    try {
      await web3Service.ensureInitialized();

      const roleManager = web3Service.getContract("RoleManager");
      const kycRegistry = web3Service.getContract("KYCRegistry");

      const [hasUserRole, isKYCApproved] = await Promise.all([
        roleManager.isUser(walletAddress),
        kycRegistry.isKYCApproved(walletAddress),
      ]);

      return {
        canInvest: hasUserRole && isKYCApproved,
        hasUserRole,
        isKYCApproved,
      };
    } catch (error) {
      console.error("❌ Failed to check investment eligibility:", error);
      throw error;
    }
  }
}

/**
 * Create investment (user intent)
 */
export const createInvestment = async ({
  userId,
  walletAddress,
  propertyId,
  investmentAmount, // USD cents
  paymentMethod, // 'crypto' or 'fiat'
  paymentReference,
}) =>
  investmentServiceInstance.createInvestment({
    userId,
    walletAddress,
    propertyId,
    investmentAmount,
    paymentMethod,
    paymentReference,
  });

/**
 * Complete investment (mint tokens after payment verification)
 */
export const completeInvestment = async (investmentId) => {
  return investmentServiceInstance.completeInvestment(investmentId);
};

/**
 * Get investor portfolio (combine on-chain + database)
 */
export const getInvestorPortfolio = async (walletAddress) => {
  return investmentServiceInstance.getInvestorPortfolio(walletAddress);
};

/**
 * Check if user can invest (KYC + role checks)
 */
export const canUserInvest = async (walletAddress) => {
  return investmentServiceInstance.canUserInvest(walletAddress);
};

// Export class instance for default imports
const investmentServiceInstance = new InvestmentService();

export default investmentServiceInstance;
