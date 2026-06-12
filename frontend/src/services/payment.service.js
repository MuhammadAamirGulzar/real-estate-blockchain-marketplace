import api from "./api";

/**
 * Payment Service - Handles all payment-related API calls
 * Supports multi-currency fiat and crypto payments
 */

/**
 * Get available payment methods
 * @returns {Promise<Object>} Available payment methods (fiat and crypto)
 */
export const getPaymentMethods = async () => {
  const response = await api.get("/payments/methods");
  return response.data;
};

/**
 * Initiate a new payment (fiat or crypto)
 * @param {Object} paymentData - Payment details (propertyId, amount, currency, method, walletAddress)
 * @returns {Promise<Object>} Payment initiation result with payment ID and instructions
 */
export const initiatePayment = async (paymentData) => {
  const method = paymentData?.method;

  if (method === "crypto") {
    const response = await api.post("/payments/initiate-crypto", paymentData);
    return response.data;
  }

  if (method === "fiat" || method === "bank_transfer") {
    const response = await api.post("/payments/initiate-fiat", paymentData);
    return response.data;
  }

  throw new Error("Unsupported payment method. Use 'crypto' or 'fiat'.");
};

export const initiateCryptoPayment = async (paymentData) => {
  const response = await api.post("/payments/initiate-crypto", paymentData);
  return response.data;
};

export const initiateFiatPayment = async (paymentData) => {
  const response = await api.post("/payments/initiate-fiat", paymentData);
  return response.data;
};

/**
 * Get payment status by payment ID
 * @param {string|number} investmentId - Investment ID
 * @returns {Promise<Object>} Payment status and details
 */
export const getPaymentStatus = async (investmentId) => {
  const response = await api.get(`/payments/status/${investmentId}`);
  return response.data;
};

/**
 * Upload payment proof for fiat payments (bank transfer receipt)
 * @param {string|number} investmentId - Investment ID
 * @param {File} proofFile - Proof file (image/PDF of bank transfer)
 * @param {string} transactionReference - Bank transaction reference
 * @returns {Promise<Object>} Upload result
 */
export const uploadProof = async (
  investmentId,
  proofFile,
  transactionReference = "",
) => {
  const formData = new FormData();
  formData.append("documentFile", proofFile);
  formData.append("investmentId", investmentId);
  if (transactionReference) {
    formData.append("transactionReference", transactionReference);
  }

  const response = await api.post("/payments/upload-proof", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

/**
 * Confirm crypto payment with transaction hash
 * @param {string} paymentId - Payment ID
 * @param {string} txHash - Blockchain transaction hash
 * @returns {Promise<Object>} Confirmation result
 */
export const confirmCryptoPayment = async (paymentId, txHash) => {
  const response = await api.post(`/payments/stripe/confirm`, {
    transactionHash: txHash,
    paymentIntentId: paymentId,
  });
  return response.data;
};

/**
 * Convert currency amount
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency (e.g., "USD", "ETH")
 * @param {string} toCurrency - Target currency (e.g., "PKR", "USDC")
 * @returns {Promise<Object>} Conversion result with converted amount and rate
 */
export const convertCurrency = async (amount, fromCurrency, toCurrency) => {
  const response = await api.get(
    `/oracle/currency-rate/${fromCurrency}/${toCurrency}`,
    {
      params: { amount },
    },
  );
  return response.data;
};

/**
 * Get real-time exchange rates
 * @param {string} baseCurrency - Base currency (default: USD)
 * @returns {Promise<Object>} Exchange rates for all supported currencies
 */
export const getExchangeRates = async (baseCurrency = "USD") => {
  const response = await api.get("/payments/exchange-rates", {
    params: { base: baseCurrency },
  });
  return response.data;
};

/**
 * Get supported cryptocurrencies for payments
 * @returns {Promise<Array>} List of supported crypto tokens
 */
export const getSupportedCryptos = async () => {
  const response = await api.get("/payments/methods");
  return response.data?.methods?.crypto || [];
};

/**
 * Get supported fiat currencies
 * @returns {Promise<Array>} List of supported fiat currencies
 */
export const getSupportedFiat = async () => {
  const response = await api.get("/payments/methods");
  return response.data?.methods?.fiat || [];
};

/**
 * Get payment history for current user
 * @param {Object} filters - Optional filters (status, method, dateRange)
 * @returns {Promise<Array>} Payment history
 */
export const getPaymentHistory = async (filters = {}) => {
  const response = await api.get("/investment/user", {
    params: filters,
  });
  return response.data;
};

/**
 * Cancel a pending payment
 * @param {string} paymentId - Payment ID
 * @returns {Promise<Object>} Cancellation result
 */
export const cancelPayment = async (paymentId) => {
  const response = await api.post(`/payments/refund/${paymentId}`);
  return response.data;
};

/**
 * Request payment refund (admin approval required)
 * @param {string} paymentId - Payment ID
 * @param {string} reason - Refund reason
 * @returns {Promise<Object>} Refund request result
 */
export const requestRefund = async (paymentId, reason) => {
  const response = await api.post(`/payments/refund/${paymentId}`, {
    reason,
  });
  return response.data;
};

/**
 * Get bank account details for wire transfer
 * @param {string} currency - Currency code (e.g., "USD", "PKR")
 * @returns {Promise<Object>} Bank account details
 */
export const getBankDetails = async (currency) => {
  const response = await api.get("/payments/methods");

  const fiatMethods = response.data?.methods?.fiat || [];
  const matched = fiatMethods.find(
    (item) => item.code?.toUpperCase() === currency?.toUpperCase(),
  );

  if (!matched) {
    return {
      success: false,
      error: `No bank details configured for ${currency}`,
    };
  }

  return {
    success: true,
    instructions: matched.bankInstructions,
    currency: matched.code,
  };
};

export const getPendingBankTransfers = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const response = await api.get(
    `/payments/pending-bank-transfers${params ? `?${params}` : ""}`,
  );
  return response.data;
};

export const verifyBankTransfer = async (
  paymentProofId,
  approved,
  verificationNotes = "",
) => {
  const response = await api.post(`/payments/verify/${paymentProofId}`, {
    approved,
    verificationNotes,
  });
  return response.data;
};

export const batchVerifyBankTransfers = async (verifications) => {
  const response = await api.post("/payments/batch-verify", {
    verifications,
  });
  return response.data;
};

const paymentService = {
  getPaymentMethods,
  initiatePayment,
  initiateCryptoPayment,
  initiateFiatPayment,
  getPaymentStatus,
  uploadProof,
  confirmCryptoPayment,
  convertCurrency,
  getExchangeRates,
  getSupportedCryptos,
  getSupportedFiat,
  getPaymentHistory,
  cancelPayment,
  requestRefund,
  getBankDetails,
  getPendingBankTransfers,
  verifyBankTransfer,
  batchVerifyBankTransfers,
};

export default paymentService;
