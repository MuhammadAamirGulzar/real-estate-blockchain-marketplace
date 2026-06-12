import bankTransferService from "../services/bankTransferService.js";
import currencyConversionService from "../services/currencyConversionService.js";
import paymentService from "../services/paymentService.js";
import stripeService, {
  StripeServiceError,
} from "../services/stripeService.js";

/**
 * @title PaymentController
 * @description Handles all payment-related API endpoints
 * @routes
 * - POST /api/payments/initiate-crypto
 * - POST /api/payments/initiate-fiat
 * - POST /api/payments/upload-proof
 * - POST /api/payments/verify/:paymentProofId
 * - GET  /api/payments/status/:investmentId
 * - GET  /api/payments/instructions/:investmentId
 * - GET  /api/payments/exchange-rates
 * - POST /api/payments/refund/:investmentId
 * - GET  /api/payments/methods
 * - POST /api/payments/calculate
 */

/**
 * Initiate crypto payment
 * @route POST /api/payments/initiate-crypto
 * @access Private (User)
 */
export const initiateCryptoPayment = async (req, res) => {
  try {
    const { propertyId, amount, currency, walletAddress } = req.body;
    const userId = req.user.id;

    if (!propertyId || !amount || !currency || !walletAddress) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: propertyId, amount, currency, walletAddress",
      });
    }

    // Validate currency
    const supportedCrypto = ["RWAP", "ETH", "USDC", "USDT"];
    if (!supportedCrypto.includes(currency.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: `Unsupported currency. Supported: ${supportedCrypto.join(", ")}`,
      });
    }

    const result = await paymentService.initiateCryptoPayment({
      userId,
      propertyId: parseInt(propertyId),
      amount: parseFloat(amount),
      currency: currency.toUpperCase(),
      walletAddress,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in initiateCryptoPayment:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Initiate fiat bank transfer payment
 * @route POST /api/payments/initiate-fiat
 * @access Private (User)
 */
export const initiateFiatPayment = async (req, res) => {
  try {
    const { propertyId, amount, currency } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    if (!propertyId || !amount || !currency) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: propertyId, amount, currency",
      });
    }

    // Validate currency
    const supportedFiat = ["USD", "PKR", "AED", "EUR", "GBP"];
    if (!supportedFiat.includes(currency.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: `Unsupported currency. Supported: ${supportedFiat.join(", ")}`,
      });
    }

    const result = await paymentService.initiateFiatPayment({
      userId,
      propertyId: parseInt(propertyId),
      amount: parseFloat(amount),
      currency: currency.toUpperCase(),
      userEmail,
    });

    // Send payment instructions email
    await bankTransferService.sendPaymentInstructions(
      userId,
      result.investment.id,
      currency.toUpperCase(),
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in initiateFiatPayment:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Upload bank transfer proof
 * @route POST /api/payments/upload-proof
 * @access Private (User)
 */
export const uploadPaymentProof = async (req, res) => {
  try {
    const { investmentId, transactionReference } = req.body;
    const userId = req.user.id;
    const documentFile = req.file; // Multer middleware should populate this

    if (!investmentId || !documentFile) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: investmentId, documentFile",
      });
    }

    const result = await bankTransferService.uploadBankProof({
      investmentId: parseInt(investmentId),
      userId,
      documentFile,
      transactionReference,
      metadata: {
        originalName: documentFile.originalname,
        size: documentFile.size,
        mimeType: documentFile.mimetype,
      },
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in uploadPaymentProof:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Admin verify bank transfer payment
 * @route POST /api/payments/verify/:paymentProofId
 * @access Private (Admin)
 */
export const verifyBankTransfer = async (req, res) => {
  try {
    const { paymentProofId } = req.params;
    const { approved, verificationNotes } = req.body;
    const adminId = req.user.id;

    if (approved === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: approved (boolean)",
      });
    }

    const result = await bankTransferService.verifyBankTransfer({
      paymentProofId: parseInt(paymentProofId),
      adminId,
      approved: Boolean(approved),
      verificationNotes: verificationNotes || "",
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in verifyBankTransfer:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get payment status
 * @route GET /api/payments/status/:investmentId
 * @access Private (User/Admin)
 */
export const getPaymentStatus = async (req, res) => {
  try {
    const { investmentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const status = await paymentService.getPaymentStatus(
      parseInt(investmentId),
    );

    // Check authorization (user can only see their own, admin can see all)
    if (
      userRole !== "admin" &&
      userRole !== "subadmin" &&
      status.userId !== userId
    ) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized to view this payment status",
      });
    }

    return res.status(200).json({
      success: true,
      status,
    });
  } catch (error) {
    console.error("Error in getPaymentStatus:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get bank payment instructions
 * @route GET /api/payments/instructions/:investmentId
 * @access Private (User)
 */
export const getPaymentInstructions = async (req, res) => {
  try {
    const { investmentId } = req.params;
    const userId = req.user.id;

    const status = await paymentService.getPaymentStatus(
      parseInt(investmentId),
    );

    // Check authorization
    if (status.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized to view payment instructions",
      });
    }

    // Get bank instructions
    const instructions = await paymentService.getBankInstructions(
      status.currency,
    );

    return res.status(200).json({
      success: true,
      investmentId: parseInt(investmentId),
      paymentReference: status.paymentProof?.bankReference,
      currency: status.currency,
      amount: status.amount,
      instructions,
      expiresAt: status.paymentProof?.expiresAt,
    });
  } catch (error) {
    console.error("Error in getPaymentInstructions:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get live exchange rates
 * @route GET /api/payments/exchange-rates
 * @access Public
 */
export const getExchangeRates = async (req, res) => {
  try {
    const { base = "USD", quotes } = req.query;

    // Default quote currencies if not specified
    const quoteCurrencies = quotes
      ? quotes.split(",")
      : ["PKR", "AED", "EUR", "GBP", "ETH", "USDC", "USDT"];

    const rates = {};

    for (const quote of quoteCurrencies) {
      try {
        const rate = await currencyConversionService.getConversionRate(
          base.toUpperCase(),
          quote.toUpperCase(),
        );
        rates[quote.toUpperCase()] = {
          rate: rate.formattedRate,
          rateRaw: rate.rateRaw || rate.rate,
          rateWei: rate.rateWei,
          timestamp: rate.timestamp,
        };
      } catch (error) {
        rates[quote.toUpperCase()] = {
          error: error.message,
        };
      }
    }

    return res.status(200).json({
      success: true,
      baseCurrency: base.toUpperCase(),
      rates,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error in getExchangeRates:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Process refund (admin only)
 * @route POST /api/payments/refund/:investmentId
 * @access Private (Admin)
 */
export const refundPayment = async (req, res) => {
  try {
    const { investmentId } = req.params;
    const { reason } = req.body;

    const result = await paymentService.cancelPayment(
      parseInt(investmentId),
      reason || "Admin refund",
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in refundPayment:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get supported payment methods
 * @route GET /api/payments/methods
 * @access Public
 */
export const getSupportedPaymentMethods = async (req, res) => {
  try {
    const methods = await paymentService.getSupportedPaymentMethods();

    return res.status(200).json({
      success: true,
      methods,
    });
  } catch (error) {
    console.error("Error in getSupportedPaymentMethods:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Convert currency amount (compatibility endpoint)
 * @route GET /api/payments/convert
 * @access Public
 */
export const convertCurrency = async (req, res) => {
  try {
    const { amount = 1, from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: "Missing required query params: from, to",
      });
    }

    const numericAmount = parseFloat(amount);

    const [convertedAmount, rateInfo] = await Promise.all([
      currencyConversionService.convertAmount(
        numericAmount,
        from.toUpperCase(),
        to.toUpperCase(),
      ),
      currencyConversionService.getConversionRate(
        from.toUpperCase(),
        to.toUpperCase(),
      ),
    ]);

    return res.status(200).json({
      success: true,
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      amount: numericAmount,
      convertedAmount,
      rate: rateInfo.formattedRate,
      rateRaw: rateInfo.rateRaw || rateInfo.rate,
      rateWei: rateInfo.rateWei,
      timestamp: rateInfo.timestamp,
    });
  } catch (error) {
    console.error("Error in convertCurrency:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get crypto token methods only (compatibility endpoint)
 * @route GET /api/payments/crypto-tokens
 * @access Public
 */
export const getSupportedCryptoTokens = async (req, res) => {
  try {
    const methods = await paymentService.getSupportedPaymentMethods();
    return res.status(200).json({
      success: true,
      tokens: methods.crypto || [],
    });
  } catch (error) {
    console.error("Error in getSupportedCryptoTokens:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get fiat currencies only (compatibility endpoint)
 * @route GET /api/payments/fiat-currencies
 * @access Public
 */
export const getSupportedFiatCurrencies = async (req, res) => {
  try {
    const methods = await paymentService.getSupportedPaymentMethods();
    return res.status(200).json({
      success: true,
      currencies: methods.fiat || [],
    });
  } catch (error) {
    console.error("Error in getSupportedFiatCurrencies:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get bank instructions by currency (compatibility endpoint)
 * @route GET /api/payments/bank-details
 * @access Public
 */
export const getBankDetails = async (req, res) => {
  try {
    const { currency = "USD", region = null } = req.query;
    const instructions = await paymentService.getBankInstructions(
      currency.toUpperCase(),
      region,
    );

    return res.status(200).json({
      success: true,
      currency: currency.toUpperCase(),
      instructions,
    });
  } catch (error) {
    console.error("Error in getBankDetails:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Calculate investment details
 * @route POST /api/payments/calculate
 * @access Public
 */
export const calculateInvestment = async (req, res) => {
  try {
    const { propertyId, paymentAmount, paymentCurrency } = req.body;

    if (!propertyId || !paymentAmount || !paymentCurrency) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: propertyId, paymentAmount, paymentCurrency",
      });
    }

    const breakdown = await paymentService.calculateInvestmentDetails({
      propertyId: parseInt(propertyId),
      paymentAmount: parseFloat(paymentAmount),
      paymentCurrency: paymentCurrency.toUpperCase(),
    });

    return res.status(200).json({
      success: true,
      breakdown,
    });
  } catch (error) {
    console.error("Error in calculateInvestment:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get pending bank transfers (Admin dashboard)
 * @route GET /api/payments/pending-bank-transfers
 * @access Private (Admin)
 */
export const getPendingBankTransfers = async (req, res) => {
  try {
    const { currency, minAmount } = req.query;

    const filters = {};
    if (currency) filters.currency = currency.toUpperCase();
    if (minAmount) filters.minAmount = parseFloat(minAmount);

    const pendingTransfers =
      await bankTransferService.getPendingBankTransfers(filters);

    return res.status(200).json({
      success: true,
      count: pendingTransfers.length,
      transfers: pendingTransfers,
    });
  } catch (error) {
    console.error("Error in getPendingBankTransfers:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Batch verify bank transfers (Admin)
 * @route POST /api/payments/batch-verify
 * @access Private (Admin)
 */
export const batchVerifyBankTransfers = async (req, res) => {
  try {
    const { verifications } = req.body; // Array of {paymentProofId, approved, notes}
    const adminId = req.user.id;

    if (!Array.isArray(verifications) || verifications.length === 0) {
      return res.status(400).json({
        success: false,
        error: "verifications array is required and must not be empty",
      });
    }

    const result = await bankTransferService.batchVerifyBankTransfers(
      verifications,
      adminId,
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in batchVerifyBankTransfers:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ============================================================
// STRIPE ENDPOINTS (USD test-mode card payments)
// ============================================================

/**
 * Create a Stripe PaymentIntent for a USD investment
 * @route POST /api/payments/stripe/create-intent
 * @access Private (User, KYC required)
 * @body { investmentId?, propertyId?, amountUSD, propertyTitle }
 */
export const createStripePaymentIntent = async (req, res) => {
  try {
    const { investmentId, propertyId, amountUSD, propertyTitle, returnUrl } =
      req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    if (!amountUSD || (!investmentId && !propertyId)) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: amountUSD and either investmentId or propertyId",
      });
    }

    const result = await stripeService.createPaymentIntent({
      investmentId: investmentId ? parseInt(investmentId) : undefined,
      propertyId: propertyId ? parseInt(propertyId) : undefined,
      amountUSD: parseFloat(amountUSD),
      userEmail,
      userId,
      propertyTitle,
      returnUrl,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in createStripePaymentIntent:", error);

    if (error instanceof StripeServiceError) {
      return res.status(error.httpStatus || 500).json({
        success: false,
        error: error.message,
        code: error.code,
        type: error.type,
      });
    }

    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Stripe webhook receiver — processes payment_intent.succeeded events
 * IMPORTANT: Must use raw body parser (express.raw) upstream for signature verification
 * @route POST /api/payments/stripe/webhook
 * @access Public (verified by Stripe signature)
 */
export const stripeWebhook = async (req, res) => {
  try {
    const signature = req.headers["stripe-signature"];
    const rawBody = Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(req.body || {}));

    const result = await stripeService.handleWebhook(rawBody, signature);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Stripe webhook error:", error.message);
    return res.status(400).json({ success: false, error: error.message });
  }
};

/**
 * Manually confirm a Stripe PaymentIntent (test mode convenience endpoint)
 * Use when testing without a live webhook — call after Stripe test payment succeeds
 * @route POST /api/payments/stripe/confirm
 * @access Private (Authenticated user)
 * @body { paymentIntentId, paymentMethodId? }
 */
export const confirmStripePayment = async (req, res) => {
  try {
    const { paymentIntentId, paymentMethodId, returnUrl, propertyId } =
      req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: paymentIntentId",
      });
    }

    if (typeof paymentIntentId !== "string") {
      return res.status(400).json({
        success: false,
        error: "paymentIntentId must be a string",
      });
    }

    if (paymentMethodId && typeof paymentMethodId !== "string") {
      return res.status(400).json({
        success: false,
        error: "paymentMethodId must be a string when provided",
      });
    }

    if (returnUrl && typeof returnUrl !== "string") {
      return res.status(400).json({
        success: false,
        error: "returnUrl must be a string URL when provided",
      });
    }

    const result = await stripeService.confirmPaymentIntent(paymentIntentId, {
      paymentMethodId,
      returnUrl,
      propertyId:
        Number.isInteger(propertyId) ||
        (typeof propertyId === "string" && propertyId.trim())
          ? parseInt(propertyId, 10)
          : undefined,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in confirmStripePayment:", error);

    if (error instanceof StripeServiceError) {
      return res.status(error.httpStatus || 500).json({
        success: false,
        error: error.message,
        code: error.code,
        type: error.type,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to confirm Stripe payment",
    });
  }
};

export default {
  initiateCryptoPayment,
  initiateFiatPayment,
  uploadPaymentProof,
  verifyBankTransfer,
  getPaymentStatus,
  getPaymentInstructions,
  getExchangeRates,
  refundPayment,
  getSupportedPaymentMethods,
  convertCurrency,
  getSupportedCryptoTokens,
  getSupportedFiatCurrencies,
  getBankDetails,
  calculateInvestment,
  getPendingBankTransfers,
  batchVerifyBankTransfers,
  createStripePaymentIntent,
  stripeWebhook,
  confirmStripePayment,
};
