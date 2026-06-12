import { and, eq } from "drizzle-orm";
import { ethers } from "ethers";
import { db } from "../db/connection.js";
import {
  bankPaymentInstructions,
  investments,
  paymentProofs,
  properties,
  users,
} from "../db/schema.js";
import currencyConversionService from "./currencyConversionService.js";
import oracleService from "./oracleService.js";

/**
 * @title PaymentService
 * @description Manages payment workflows for both crypto and bank transfers
 * @features
 * - Initiate crypto payments (RWAP, ETH, USDC, USDT)
 * - Initiate fiat bank transfer payments
 * - Generate unique payment references
 * - Provide bank account instructions
 * - Process payment completion after verification
 * - Calculate investment details with currency conversion
 */

class PaymentService {
  /**
   * Initiate cryptocurrency payment
   * @param {Object} params - Payment parameters
   * @returns {Promise<Object>} Investment and payment details
   */
  async initiateCryptoPayment({
    userId,
    propertyId,
    amount,
    currency, // RWAP, ETH, USDC, USDT
    walletAddress,
  }) {
    try {
      // Validate inputs
      if (!userId || !propertyId || !amount || !currency || !walletAddress) {
        throw new Error("Missing required parameters");
      }

      // Get property details
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      if (!property) {
        throw new Error("Property not found");
      }

      if (property.status !== "active" && property.status !== "tokenized") {
        throw new Error("Property is not available for investment");
      }

      // Convert payment amount to USD for calculation
      let amountUSD;
      if (currency === "USD") {
        amountUSD = amount;
      } else {
        amountUSD = await currencyConversionService.convertAmount(
          amount,
          currency,
          "USD",
        );
      }

      // Get exchange rate at time of purchase
      const exchangeRate = await oracleService.getExchangeRate(currency, "USD");

      // Calculate fractional tokens
      // Assuming pricePerToken is stored in property or calculated
      const pricePerToken =
        property.propertyValue / property.totalFractionalSupply || 1;
      const fractionalTokens =
        await currencyConversionService.calculateFractionalTokens(
          amount,
          currency,
          pricePerToken,
        );

      // Create investment record with pending status
      const [investment] = await db
        .insert(investments)
        .values({
          userId,
          propertyId,
          amountPaidRwaToken: ethers
            .parseUnits(amount.toString(), 18)
            .toString(),
          fractionalTokensReceived: ethers
            .parseUnits(fractionalTokens, 18)
            .toString(),
          paymentCurrency: currency,
          fiatAmount: amountUSD,
          exchangeRateAtPurchase: exchangeRate,
          paymentMethod: `crypto_${currency.toLowerCase()}`,
          paymentStatus: "pending_proof", // Will be updated when blockchain tx confirms
          investedAt: new Date(),
        })
        .returning();

      return {
        success: true,
        investment,
        paymentDetails: {
          amount,
          currency,
          amountUSD,
          exchangeRate: ethers.formatUnits(exchangeRate, 18),
          fractionalTokens,
          walletAddress,
        },
        nextSteps: {
          action: "approve_and_transfer",
          description: `Approve ${currency} spending and transfer ${amount} ${currency} to complete investment`,
        },
      };
    } catch (error) {
      console.error("Error initiating crypto payment:", error);
      throw error;
    }
  }

  /**
   * Initiate fiat bank transfer payment
   * @param {Object} params - Payment parameters
   * @returns {Promise<Object>} Payment instructions and reference
   */
  async initiateFiatPayment({
    userId,
    propertyId,
    amount,
    currency, // USD, PKR, AED, EUR, GBP
    userEmail,
  }) {
    try {
      // Validate inputs
      if (!userId || !propertyId || !amount || !currency) {
        throw new Error("Missing required parameters");
      }

      // Get property details
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      if (!property) {
        throw new Error("Property not found");
      }

      if (property.status !== "active" && property.status !== "tokenized") {
        throw new Error("Property is not available for investment");
      }

      // Convert payment amount to USD
      let amountUSD;
      if (currency === "USD") {
        amountUSD = amount;
      } else {
        amountUSD = await currencyConversionService.convertAmount(
          amount,
          currency,
          "USD",
        );
      }

      // Get exchange rate
      const exchangeRate = await oracleService.getExchangeRate(currency, "USD");

      // Calculate fractional tokens
      const pricePerToken =
        property.propertyValue / property.totalFractionalSupply || 1;
      const fractionalTokens =
        await currencyConversionService.calculateFractionalTokens(
          amount,
          currency,
          pricePerToken,
        );

      // Create investment record with pending status
      const [investment] = await db
        .insert(investments)
        .values({
          userId,
          propertyId,
          amountPaidRwaToken: "0", // Will be filled after verification
          fractionalTokensReceived: ethers
            .parseUnits(fractionalTokens, 18)
            .toString(),
          paymentCurrency: currency,
          fiatAmount: amountUSD,
          exchangeRateAtPurchase: exchangeRate,
          paymentMethod: "bank_transfer",
          paymentStatus: "pending_proof",
          transactionHash:
            "0x0000000000000000000000000000000000000000000000000000000000000000", // Placeholder for bank transfers
          investedAt: new Date(),
        })
        .returning();

      // Generate unique payment reference
      const paymentReference = this.generatePaymentReference(investment.id);

      // Get bank instructions for currency
      const bankInstructions = await this.getBankInstructions(currency);

      // Calculate expiry (7 days from now)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Create payment proof placeholder
      const [paymentProof] = await db
        .insert(paymentProofs)
        .values({
          investmentId: investment.id,
          userId,
          proofType: "bank_transfer",
          bankReference: paymentReference,
          amount: amountUSD,
          currency,
          status: "pending",
          expiresAt,
          uploadedAt: new Date(),
        })
        .returning();

      // Update investment with payment proof ID
      await db
        .update(investments)
        .set({ paymentProofId: paymentProof.id })
        .where(eq(investments.id, investment.id));

      return {
        success: true,
        investment,
        paymentProof,
        paymentReference,
        bankInstructions,
        paymentDetails: {
          amount,
          currency,
          amountUSD,
          exchangeRate: ethers.formatUnits(exchangeRate, 18),
          fractionalTokens,
          expiresAt,
        },
        nextSteps: {
          action: "bank_transfer",
          description: `Transfer ${amount} ${currency} to the provided bank account with reference: ${paymentReference}`,
          warning:
            "Include the reference number in your transfer description/memo",
        },
      };
    } catch (error) {
      console.error("Error initiating fiat payment:", error);
      throw error;
    }
  }

  /**
   * Generate unique payment reference
   * @param {number} investmentId - Investment ID
   * @returns {string} Unique reference
   */
  generatePaymentReference(investmentId) {
    const prefix = process.env.PAYMENT_REFERENCE_PREFIX || "RWA-INV";
    const timestamp = Date.now().toString().slice(-6);
    const investmentIdPadded = investmentId.toString().padStart(6, "0");
    return `${prefix}-${investmentIdPadded}-${timestamp}`;
  }

  /**
   * Get bank payment instructions for currency
   * @param {string} currency - Currency code
   * @param {string} region - Optional region override
   * @returns {Promise<Object>} Bank instructions
   */
  async getBankInstructions(currency, region = null) {
    try {
      // Determine region from currency if not provided
      if (!region) {
        const currencyToRegion = {
          USD: "US",
          PKR: "PK",
          AED: "AE",
          EUR: "EU",
          GBP: "GB",
        };
        region = currencyToRegion[currency] || "US";
      }

      // Get bank instructions from database
      const [instructions] = await db
        .select()
        .from(bankPaymentInstructions)
        .where(
          and(
            eq(bankPaymentInstructions.currency, currency),
            eq(bankPaymentInstructions.region, region),
            eq(bankPaymentInstructions.isActive, true),
          ),
        )
        .orderBy(bankPaymentInstructions.displayOrder)
        .limit(1);

      if (!instructions) {
        throw new Error(
          `No bank instructions found for ${currency} in ${region}`,
        );
      }

      // Return instructions (account number should be decrypted if encrypted)
      return {
        currency,
        region,
        bankName: instructions.bankName,
        accountHolder: instructions.accountHolder,
        accountNumber: instructions.accountNumber, // TODO: Decrypt if encrypted
        routingNumber: instructions.routingNumber,
        swiftCode: instructions.swiftCode,
        iban: instructions.iban,
        bankAddress: instructions.bankAddress,
        instructions: instructions.instructions,
        referencePrefix: instructions.referencePrefix,
      };
    } catch (error) {
      console.error("Error getting bank instructions:", error);
      throw error;
    }
  }

  /**
   * Process payment completion after verification
   * @param {number} investmentId - Investment ID
   * @param {string} transactionHash - Blockchain transaction hash (if applicable)
   * @returns {Promise<Object>} Updated investment
   */
  async processPaymentCompletion(investmentId, transactionHash = null) {
    try {
      // Get investment details
      const [investment] = await db
        .select()
        .from(investments)
        .where(eq(investments.id, investmentId))
        .limit(1);

      if (!investment) {
        throw new Error("Investment not found");
      }

      if (investment.paymentStatus === "completed") {
        throw new Error("Investment already completed");
      }

      // Update investment status
      const updateData = {
        paymentStatus: "completed",
        completedAt: new Date(),
      };

      if (transactionHash) {
        updateData.transactionHash = transactionHash;
      }

      const [updatedInvestment] = await db
        .update(investments)
        .set(updateData)
        .where(eq(investments.id, investmentId))
        .returning();

      // Update payment proof status if exists
      if (investment.paymentProofId) {
        await db
          .update(paymentProofs)
          .set({
            status: "verified",
            verifiedAt: new Date(),
          })
          .where(eq(paymentProofs.id, investment.paymentProofId));
      }

      // TODO: Trigger token minting if not already done
      // This would call InvestmentManager smart contract

      return {
        success: true,
        investment: updatedInvestment,
        message:
          "Payment completed successfully. Tokens will be transferred to your wallet.",
      };
    } catch (error) {
      console.error("Error processing payment completion:", error);
      throw error;
    }
  }

  /**
   * Calculate investment details with all conversions
   * @param {Object} params - Calculation parameters
   * @returns {Promise<Object>} Detailed breakdown
   */
  async calculateInvestmentDetails({
    propertyId,
    paymentAmount,
    paymentCurrency,
  }) {
    try {
      // Get property details
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      if (!property) {
        throw new Error("Property not found");
      }

      // Get property price and currency
      const propertyPrice =
        property.currentMarketPrice || property.propertyValue;
      const propertyCurrency = property.baseCurrency || "USD";

      // Calculate price per token
      const totalSupply = parseFloat(
        ethers.formatUnits(
          property.totalFractionalSupply || "1000000000000000000000000",
          18,
        ),
      );
      const pricePerToken = parseFloat(propertyPrice) / totalSupply;

      // Use currency conversion service for detailed breakdown
      const breakdown =
        await currencyConversionService.calculateInvestmentBreakdown({
          propertyPrice: propertyPrice.toString(),
          propertyCurrency,
          investmentAmount: paymentAmount.toString(),
          investmentCurrency: paymentCurrency,
          pricePerToken: pricePerToken.toString(),
        });

      // Add property-specific details
      breakdown.property = {
        id: property.id,
        title: property.title,
        totalValue: propertyPrice.toString(),
        currency: propertyCurrency,
        totalSupply: totalSupply.toString(),
        pricePerToken: pricePerToken.toString(),
      };

      return breakdown;
    } catch (error) {
      console.error("Error calculating investment details:", error);
      throw error;
    }
  }

  /**
   * Get payment status
   * @param {number} investmentId - Investment ID
   * @returns {Promise<Object>} Payment status details
   */
  async getPaymentStatus(investmentId) {
    try {
      const [investment] = await db
        .select({
          investment: investments,
          paymentProof: paymentProofs,
          property: properties,
          user: users,
        })
        .from(investments)
        .leftJoin(
          paymentProofs,
          eq(investments.paymentProofId, paymentProofs.id),
        )
        .leftJoin(properties, eq(investments.propertyId, properties.id))
        .leftJoin(users, eq(investments.userId, users.id))
        .where(eq(investments.id, investmentId))
        .limit(1);

      if (!investment) {
        throw new Error("Investment not found");
      }

      return {
        investmentId: investment.investment.id,
        userId: investment.investment.userId,
        userEmail: investment.user?.email,
        propertyId: investment.investment.propertyId,
        propertyTitle: investment.property?.title,
        amount: investment.investment.fiatAmount,
        currency: investment.investment.paymentCurrency,
        paymentMethod: investment.investment.paymentMethod,
        paymentStatus: investment.investment.paymentStatus,
        fractionalTokens: ethers.formatUnits(
          investment.investment.fractionalTokensReceived || "0",
          18,
        ),
        transactionHash: investment.investment.transactionHash,
        createdAt: investment.investment.investedAt,
        completedAt: investment.investment.completedAt,
        paymentProof: investment.paymentProof
          ? {
              id: investment.paymentProof.id,
              bankReference: investment.paymentProof.bankReference,
              documentHash: investment.paymentProof.documentHash,
              documentUrl: investment.paymentProof.documentUrl,
              status: investment.paymentProof.status,
              uploadedAt: investment.paymentProof.uploadedAt,
              verifiedAt: investment.paymentProof.verifiedAt,
              verificationNotes: investment.paymentProof.verificationNotes,
              expiresAt: investment.paymentProof.expiresAt,
            }
          : null,
      };
    } catch (error) {
      console.error("Error getting payment status:", error);
      throw error;
    }
  }

  /**
   * Get all supported payment methods
   * @returns {Promise<Array>} Payment methods
   */
  async getSupportedPaymentMethods() {
    try {
      // Get supported crypto tokens
      const cryptoTokens = ["RWAP", "ETH", "USDC", "USDT"];

      // Get supported fiat currencies
      const fiatCurrencies = ["USD", "PKR", "AED", "EUR", "GBP"];

      return {
        crypto: cryptoTokens.map((token) => ({
          code: token,
          name: token === "RWAP" ? "RWA Platform Token" : token,
          type: "crypto",
          method: `crypto_${token.toLowerCase()}`,
          estimatedTime: "Instant",
          fees: "Gas fees only",
        })),
        fiat: fiatCurrencies.map((currency) => ({
          code: currency,
          symbol: currencyConversionService.getCurrencySymbol(currency),
          type: "fiat",
          method: "bank_transfer",
          estimatedTime: "2-5 business days",
          fees: "Bank transfer fees may apply",
        })),
      };
    } catch (error) {
      console.error("Error getting supported payment methods:", error);
      throw error;
    }
  }

  /**
   * Cancel pending payment
   * @param {number} investmentId - Investment ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelPayment(investmentId, reason = "User cancelled") {
    try {
      const [investment] = await db
        .select()
        .from(investments)
        .where(eq(investments.id, investmentId))
        .limit(1);

      if (!investment) {
        throw new Error("Investment not found");
      }

      if (investment.paymentStatus === "completed") {
        throw new Error("Cannot cancel completed payment");
      }

      // Update investment status
      await db
        .update(investments)
        .set({
          paymentStatus: "failed",
        })
        .where(eq(investments.id, investmentId));

      // Update payment proof if exists
      if (investment.paymentProofId) {
        await db
          .update(paymentProofs)
          .set({
            status: "rejected",
            rejectionReason: reason,
          })
          .where(eq(paymentProofs.id, investment.paymentProofId));
      }

      return {
        success: true,
        message: "Payment cancelled successfully",
      };
    } catch (error) {
      console.error("Error cancelling payment:", error);
      throw error;
    }
  }
}

// Create singleton instance
const paymentService = new PaymentService();

export default paymentService;
