import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { loadContractABI } from "../config/contracts.config.js";
import { db } from "../db/connection.js";
import {
  blockchainTransactions,
  investments,
  properties,
  users,
} from "../db/schema.js";
import currencyConversionService from "../services/currencyConversionService.js";
import fractionalTokenService from "../services/fractionalTokenService.js";
import investmentService, {
  canUserInvest,
  completeInvestment,
  createInvestment,
  getInvestorPortfolio,
} from "../services/investmentService.js";
import { web3Service } from "../services/web3Service.js";

const FRACTIONAL_PROPERTY_TOKEN_ABI = loadContractABI(
  "FractionalPropertyToken",
);

const resolveTreasurySigner = async (provider, treasuryAddress) => {
  const defaultSigner = web3Service.signer;
  const defaultSignerAddress = await defaultSigner.getAddress();

  if (defaultSignerAddress.toLowerCase() === treasuryAddress.toLowerCase()) {
    return defaultSigner;
  }

  const treasuryPrivateKey = process.env.TREASURY_PRIVATE_KEY;
  if (!treasuryPrivateKey) {
    return null;
  }

  const treasurySigner = new ethers.Wallet(treasuryPrivateKey, provider);
  const treasurySignerAddress = await treasurySigner.getAddress();

  if (treasurySignerAddress.toLowerCase() !== treasuryAddress.toLowerCase()) {
    return null;
  }

  return treasurySigner;
};

/**
 * POST /api/investment/create
 * Create new investment
 */
export const createInvestmentHandler = async (req, res) => {
  try {
    const { propertyId, amount, paymentMethod, paymentReference } = req.body;
    const userId = req.user.id;
    const walletAddress = req.user.walletAddress;

    // Validate
    if (!propertyId || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Check eligibility
    const eligibility = await canUserInvest(walletAddress);
    if (!eligibility.canInvest) {
      return res.status(403).json({
        success: false,
        message: "Investment not allowed",
        details: eligibility,
      });
    }

    // Create investment
    const result = await createInvestment({
      userId,
      walletAddress,
      propertyId,
      investmentAmount: amount,
      paymentMethod,
      paymentReference,
    });

    res.json({
      success: true,
      message: "Investment created successfully",
      data: result,
    });
  } catch (error) {
    console.error("Investment creation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create investment",
      error: error.message,
    });
  }
};

/**
 * POST /api/investment/:id/complete
 * Complete investment (admin only, after payment verification)
 */
export const completeInvestmentHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await completeInvestment(parseInt(id));

    res.json({
      success: true,
      message: "Investment completed and tokens minted",
      data: result,
    });
  } catch (error) {
    console.error("Investment completion error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete investment",
      error: error.message,
    });
  }
};

/**
 * GET /api/investment/portfolio
 * Get user's investment portfolio
 */
export const getPortfolioHandler = async (req, res) => {
  try {
    const walletAddress = req.user.walletAddress;

    const portfolio = await getInvestorPortfolio(walletAddress);

    res.json({
      success: true,
      data: portfolio,
    });
  } catch (error) {
    console.error("Portfolio fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch portfolio",
      error: error.message,
    });
  }
};

/**
 * GET /api/investment/check-eligibility
 * Check if user can invest
 */
export const checkEligibilityHandler = async (req, res) => {
  const walletAddress = req.user.walletAddress;

  // No wallet = ineligible, not a server error
  if (!walletAddress) {
    return res.json({
      success: true,
      data: {
        canInvest: false,
        hasUserRole: false,
        isKYCApproved: false,
        reason: "No wallet connected",
      },
    });
  }

  // Try blockchain first, fall back to DB if Anvil is down
  try {
    const eligibility = await canUserInvest(walletAddress);
    return res.json({ success: true, data: eligibility });
  } catch (blockchainError) {
    console.warn(
      "⚠️ Blockchain eligibility check failed, using DB fallback:",
      blockchainError.message,
    );
    try {
      const [user] = await db
        .select({ kycStatus: users.kycStatus, role: users.role })
        .from(users)
        .where(eq(users.id, req.user.id))
        .limit(1);
      const isKYCApproved = user?.kycStatus === "approved";
      return res.json({
        success: true,
        data: {
          canInvest: isKYCApproved,
          hasUserRole: !!user?.role,
          isKYCApproved,
          source: "database",
        },
      });
    } catch (dbError) {
      return res.status(500).json({
        success: false,
        message: "Failed to check eligibility",
        error: dbError.message,
      });
    }
  }
};

/**
 * POST /api/investment/convert-eth-to-rwap
 * Convert a confirmed ETH transfer to treasury into RWAP by minting equivalent amount.
 */
export const convertEthToRwapHandler = async (req, res) => {
  try {
    const { ethTxHash } = req.body;
    const walletAddress = req.user.walletAddress;

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: "User wallet is not connected",
      });
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(ethTxHash || "")) {
      return res.status(400).json({
        success: false,
        message: "A valid ETH transaction hash is required",
      });
    }

    const [existingConversion] = await db
      .select()
      .from(blockchainTransactions)
      .where(eq(blockchainTransactions.transactionHash, ethTxHash))
      .limit(1);

    if (existingConversion) {
      return res.status(200).json({
        success: true,
        data: {
          ethTxHash,
          alreadyProcessed: true,
        },
        message: "This ETH conversion transaction has already been processed",
      });
    }

    await web3Service.ensureInitialized();

    const provider = web3Service.provider;
    const investmentManager = web3Service.getContract("InvestmentManager");
    const rwaToken = web3Service.getContract("RWAToken");
    const treasury = await investmentManager.treasury();

    const [tx, receipt] = await Promise.all([
      provider.getTransaction(ethTxHash),
      provider.getTransactionReceipt(ethTxHash),
    ]);

    if (!tx || !receipt || receipt.status !== 1) {
      return res.status(400).json({
        success: false,
        message: "ETH transaction is not confirmed on-chain",
      });
    }

    if ((tx.from || "").toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: "ETH transaction does not belong to the connected wallet",
      });
    }

    if (!tx.to || tx.to.toLowerCase() !== treasury.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "ETH transaction must be sent to the investment treasury",
      });
    }

    if (tx.value <= 0n) {
      return res.status(400).json({
        success: false,
        message: "ETH transaction value must be greater than zero",
      });
    }

    const ethAmount = ethers.formatEther(tx.value);
    const rwapAmount = await currencyConversionService.convertAmount(
      ethAmount,
      "ETH",
      "USD",
    );

    const mintAmountWei = ethers.parseUnits(rwapAmount, 18);
    if (mintAmountWei <= 0n) {
      return res.status(400).json({
        success: false,
        message: "Converted RWAP amount is zero. Send more ETH and retry.",
      });
    }

    const minterRole = await rwaToken.MINTER_ROLE();
    const signerAddress = await web3Service.signer.getAddress();
    const signerCanMint = await rwaToken.hasRole(minterRole, signerAddress);

    if (!signerCanMint) {
      return res.status(500).json({
        success: false,
        message:
          "Backend signer does not have RWAP minter role. Contact admin.",
      });
    }

    const mintResult = await web3Service.executeTransaction({
      contract: "RWAToken",
      function: "mint",
      args: [walletAddress, mintAmountWei],
      relatedEntity: { type: "eth_conversion", id: req.user.id },
    });

    try {
      await db.insert(blockchainTransactions).values({
        transactionHash: ethTxHash,
        contractName: "NATIVE_ETH",
        functionName: "convertEthToRwap",
        from: walletAddress,
        to: treasury,
        status: "confirmed",
        confirmations: 1,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString() || null,
        relatedEntityType: "eth_conversion",
        relatedEntityId: req.user.id,
        confirmedAt: new Date(),
      });
    } catch (dbError) {
      // If another request stored the same ETH tx concurrently, treat this flow as idempotent.
      if (dbError?.code === "23505") {
        return res.status(200).json({
          success: true,
          data: {
            ethTxHash,
            mintTxHash: mintResult.transactionHash,
            ethAmount,
            mintedRwap: rwapAmount,
            alreadyProcessed: true,
          },
          message: "ETH conversion was already recorded",
        });
      }

      throw dbError;
    }

    return res.status(200).json({
      success: true,
      data: {
        ethTxHash,
        mintTxHash: mintResult.transactionHash,
        ethAmount,
        mintedRwap: rwapAmount,
      },
      message: "ETH converted to RWAP successfully",
    });
  } catch (error) {
    console.error("ETH to RWAP conversion error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to convert ETH to RWAP",
      error: error.message,
    });
  }
};

/**
 * POST /api/investment/ensure-pool-allowance
 * Ensure treasury approved InvestmentManager for pool fractional token transfers.
 */
export const ensurePoolAllowanceHandler = async (req, res) => {
  try {
    const { nftTokenId, requiredAmount } = req.body;

    if (nftTokenId === undefined || nftTokenId === null || nftTokenId === "") {
      return res.status(400).json({
        success: false,
        message: "nftTokenId is required",
      });
    }

    const nftTokenIdBigInt = BigInt(nftTokenId);

    const requiredAmountString = String(requiredAmount ?? "0").trim();
    if (!/^\d+$/.test(requiredAmountString)) {
      return res.status(400).json({
        success: false,
        message: "requiredAmount must be a non-negative integer string",
      });
    }
    const requiredAmountWei = BigInt(requiredAmountString);

    await web3Service.ensureInitialized();

    const provider = web3Service.provider;
    const investmentManager = web3Service.getContract("InvestmentManager");
    const investmentManagerAddress =
      investmentManager.target || investmentManager.address;

    const pool = await investmentManager.investmentPools(nftTokenIdBigInt);
    if (!pool.isOpen) {
      return res.status(400).json({
        success: false,
        message: "Investment pool is not open",
      });
    }

    if (!ethers.isAddress(pool.fractionalTokenContract)) {
      return res.status(400).json({
        success: false,
        message: "Pool fractional token contract is not configured",
      });
    }

    const treasuryAddress = await investmentManager.treasury();

    const fractionalTokenRead = new ethers.Contract(
      pool.fractionalTokenContract,
      FRACTIONAL_PROPERTY_TOKEN_ABI,
      provider,
    );

    const currentAllowance = await fractionalTokenRead.allowance(
      treasuryAddress,
      investmentManagerAddress,
    );

    const needsApproval =
      currentAllowance === 0n || currentAllowance < requiredAmountWei;

    if (!needsApproval) {
      return res.status(200).json({
        success: true,
        message: "Pool treasury allowance is already configured",
        data: {
          nftTokenId: nftTokenIdBigInt.toString(),
          fractionalTokenContract: pool.fractionalTokenContract,
          treasuryAddress,
          allowance: currentAllowance.toString(),
          alreadyConfigured: true,
        },
      });
    }

    const treasurySigner = await resolveTreasurySigner(
      provider,
      treasuryAddress,
    );
    if (!treasurySigner) {
      return res.status(500).json({
        success: false,
        message:
          "Treasury signer is not configured on backend. Set TREASURY_PRIVATE_KEY or use treasury wallet to approve fractional token allowance manually.",
      });
    }

    const fractionalTokenWrite = new ethers.Contract(
      pool.fractionalTokenContract,
      FRACTIONAL_PROPERTY_TOKEN_ABI,
      treasurySigner,
    );

    const approveTx = await fractionalTokenWrite.approve(
      investmentManagerAddress,
      ethers.MaxUint256,
    );
    await approveTx.wait();

    const updatedAllowance = await fractionalTokenRead.allowance(
      treasuryAddress,
      investmentManagerAddress,
    );

    return res.status(200).json({
      success: true,
      message: "Pool treasury allowance configured successfully",
      data: {
        nftTokenId: nftTokenIdBigInt.toString(),
        fractionalTokenContract: pool.fractionalTokenContract,
        treasuryAddress,
        allowance: updatedAllowance.toString(),
        transactionHash: approveTx.hash,
      },
    });
  } catch (error) {
    console.error("Pool allowance configuration error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to configure pool treasury allowance",
      error: error.message,
    });
  }
};

/**
 * Create a new investment (direct blockchain processing)
 */
export const createInvestmentDirect = async (req, res) => {
  const { propertyId, platformTokenAmount } = req.body;
  const userId = req.user.id;

  try {
    // 1. Verify user KYC
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (user.kycStatus !== "approved") {
      return res.status(403).json({ message: "KYC approval required" });
    }

    if (!user.walletAddress) {
      return res.status(400).json({ message: "Wallet address not connected" });
    }

    // 2. Fetch property
    const property = await db.query.properties.findFirst({
      where: eq(properties.id, propertyId),
    });

    if (!property || property.status !== "active") {
      return res
        .status(400)
        .json({ message: "Property not available for investment" });
    }

    if (!property.nftTokenId) {
      return res.status(400).json({ message: "Property NFT not minted yet" });
    }

    // 3. Process investment on-chain
    const investmentResult = await investmentService.processInvestment({
      investorAddress: user.walletAddress,
      nftTokenId: property.nftTokenId,
      platformTokenAmount: parseFloat(platformTokenAmount),
    });

    // 4. Record investment in database
    const [newInvestment] = await db
      .insert(investments)
      .values({
        userId,
        propertyId,
        investmentAmount: platformTokenAmount,
        tokensAmount: Math.floor(
          parseFloat(investmentResult.fractionalTokensReceived),
        ), // Legacy field
        platformTokenPaid: platformTokenAmount,
        fractionalTokensReceived: investmentResult.fractionalTokensReceived,
        transactionHash: investmentResult.transactionHash,
        onChainInvestmentId: investmentResult.investmentId,
        paymentMethod: "crypto",
        paymentReference: investmentResult.transactionHash,
        status: "completed",
        completedAt: new Date(),
      })
      .returning();

    res.status(201).json({
      message: "Investment successful",
      data: {
        investment: newInvestment,
        fractionalTokensReceived: investmentResult.fractionalTokensReceived,
        transactionHash: investmentResult.transactionHash,
      },
    });
  } catch (error) {
    console.error("Investment error:", error);
    res.status(500).json({
      message: "Investment failed",
      error: error.message,
    });
  }
};

/**
 * Get user's portfolio
 */
export const getPortfolio = async (req, res) => {
  const userId = req.user.id;

  try {
    const userInvestments = await db.query.investments.findMany({
      where: eq(investments.userId, userId),
      with: {
        property: true,
      },
    });

    // Get fractional token balances for each investment
    const portfolioWithBalances = await Promise.all(
      userInvestments.map(async (inv) => {
        const property = await db.query.properties.findFirst({
          where: eq(properties.id, inv.propertyId),
        });

        let currentBalance = "0";
        if (property?.fractionalTokenAddress) {
          const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
          });

          if (user?.walletAddress) {
            currentBalance = await fractionalTokenService.getBalance(
              property.fractionalTokenAddress,
              user.walletAddress,
            );
          }
        }

        return {
          ...inv,
          currentFractionalTokenBalance: currentBalance,
        };
      }),
    );

    res.status(200).json({
      message: "Portfolio fetched successfully",
      data: portfolioWithBalances,
    });
  } catch (error) {
    console.error("Error fetching portfolio:", error);
    res.status(500).json({ message: "Failed to fetch portfolio" });
  }
};

/**
 * GET /api/investments/user
 * Get all investments for current user (simpler than portfolio)
 */
export const getUserInvestments = async (req, res) => {
  const userId = req.user.id;

  try {
    const serializeForJson = (value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }

      if (value instanceof Date || value === null || value === undefined) {
        return value;
      }

      if (Array.isArray(value)) {
        return value.map(serializeForJson);
      }

      if (typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value).map(([key, nestedValue]) => [
            key,
            serializeForJson(nestedValue),
          ]),
        );
      }

      return value;
    };

    const normalizeRows = (rows) => {
      if (Array.isArray(rows)) {
        return rows;
      }

      // Mock DB fallback can return an object with orderBy()/limit() helpers.
      if (rows && typeof rows.orderBy === "function") {
        const orderedRows = rows.orderBy(() => []);
        return Array.isArray(orderedRows) ? orderedRows : [];
      }

      return [];
    };

    let userInvestments = [];

    try {
      userInvestments = await db.query.investments.findMany({
        where: eq(investments.userId, userId),
        with: {
          property: true,
        },
        orderBy: (investments, { desc }) => [desc(investments.investedAt)],
      });
    } catch (queryError) {
      console.warn(
        "Falling back to basic investments query (without relations):",
        queryError.message,
      );

      try {
        const basicQueryRows = await db.query.investments.findMany({
          where: eq(investments.userId, userId),
          orderBy: (investments, { desc }) => [desc(investments.investedAt)],
        });

        const basicInvestments = normalizeRows(basicQueryRows);

        userInvestments = basicInvestments.map((investment) => ({
          ...investment,
          property: null,
        }));
      } catch (basicQueryError) {
        console.warn(
          "Falling back to plain select investments query:",
          basicQueryError.message,
        );

        const rawQueryRows = await db
          .select()
          .from(investments)
          .where(eq(investments.userId, userId));

        const rawInvestments = normalizeRows(rawQueryRows);

        userInvestments = rawInvestments
          .map((investment) => ({
            ...investment,
            property: null,
          }))
          .sort(
            (a, b) =>
              new Date(b.investedAt || 0).getTime() -
              new Date(a.investedAt || 0).getTime(),
          );
      }
    }

    const safeUserInvestments = serializeForJson(userInvestments);

    res.status(200).json({
      success: true,
      data: safeUserInvestments,
    });
  } catch (error) {
    console.error("Error fetching user investments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch investments",
      error: error.message,
    });
  }
};

/**
 * GET /api/investments/history
 * Get investment history with pagination
 */
export const getInvestmentHistory = async (req, res) => {
  const userId = req.user.id;
  const { limit = 50, offset = 0 } = req.query;

  try {
    const userInvestments = await db.query.investments.findMany({
      where: eq(investments.userId, userId),
      with: {
        property: true,
      },
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy: (investments, { desc }) => [desc(investments.investedAt)],
    });

    res.status(200).json({
      success: true,
      data: {
        investments: userInvestments,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: userInvestments.length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching investment history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch investment history",
      error: error.message,
    });
  }
};

/**
 * POST /api/investments/calculate-returns
 * Calculate projected returns for an investment amount
 */
export const calculateReturns = async (req, res) => {
  const { propertyId, amount } = req.body;

  try {
    if (!propertyId || !amount) {
      return res.status(400).json({
        success: false,
        message: "propertyId and amount are required",
      });
    }

    // Fetch property
    const property = await db.query.properties.findFirst({
      where: eq(properties.id, propertyId),
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    if (property.status !== "active" && property.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Property not available for investment",
      });
    }

    // Calculate returns
    const investmentAmount = parseFloat(amount);
    const propertyValue = parseFloat(
      property.propertyValue || property.estimatedValue || 0,
    );
    const annualReturn = parseFloat(property.expectedReturn || 0);

    // Simple calculations (can be enhanced with more sophisticated models)
    const tokensReceived =
      investmentAmount / parseFloat(property.pricePerToken || 1);
    const ownershipPercentage = (investmentAmount / propertyValue) * 100;
    const annualReturnAmount = investmentAmount * (annualReturn / 100);
    const monthlyReturnAmount = annualReturnAmount / 12;

    res.status(200).json({
      success: true,
      data: {
        investmentAmount,
        propertyValue,
        tokensReceived: Math.floor(tokensReceived),
        ownershipPercentage: ownershipPercentage.toFixed(4),
        expectedAnnualReturn: annualReturn,
        expectedAnnualReturnAmount: annualReturnAmount.toFixed(2),
        expectedMonthlyReturnAmount: monthlyReturnAmount.toFixed(2),
        pricePerToken: parseFloat(property.pricePerToken || 1),
      },
    });
  } catch (error) {
    console.error("Error calculating returns:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate returns",
      error: error.message,
    });
  }
};
