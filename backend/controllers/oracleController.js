import currencyConversionService from "../services/currencyConversionService.js";
import oracleService from "../services/oracleService.js";
import propertyPricingService from "../services/propertyPricingService.js";

/**
 * @title OracleController
 * @description Handles all oracle and price-related API endpoints
 * @routes
 * - GET  /api/oracle/property-price/:propertyId
 * - GET  /api/oracle/currency-rate/:from/:to
 * - GET  /api/oracle/price-history/:propertyId
 * - POST /api/oracle/update-property/:propertyId
 * - GET  /api/oracle/supported-currencies
 * - POST /api/oracle/manual-override/:propertyId
 * - GET  /api/oracle/anomalies
 * - POST /api/oracle/sync-prices
 */

/**
 * Get current property price
 * @route GET /api/oracle/property-price/:propertyId
 * @access Public
 */
export const getPropertyPrice = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { currency = "USD" } = req.query;

    const valuation = await propertyPricingService.getLatestValuation(
      parseInt(propertyId),
    );

    if (!valuation) {
      return res.status(404).json({
        success: false,
        error: "Property valuation not found",
      });
    }

    // Convert to requested currency if needed
    let priceInCurrency = valuation.price;
    if (currency.toUpperCase() !== valuation.currency.toUpperCase()) {
      const convertedAmount = await currencyConversionService.convertAmount(
        valuation.price,
        valuation.currency,
        currency.toUpperCase(),
      );
      priceInCurrency = convertedAmount;
    }

    // Set cache header (5 minutes)
    res.set("Cache-Control", "public, max-age=300");

    return res.status(200).json({
      success: true,
      propertyId: parseInt(propertyId),
      price: priceInCurrency,
      baseCurrency: currency.toUpperCase(),
      originalPrice: valuation.price,
      originalCurrency: valuation.currency,
      source: valuation.priceSource,
      confidenceScore: valuation.confidenceScore,
      lastUpdated: valuation.valuationDate,
      valuationId: valuation.id,
    });
  } catch (error) {
    console.error("Error in getPropertyPrice:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get currency exchange rate
 * @route GET /api/oracle/currency-rate/:from/:to
 * @access Public
 */
export const getCurrencyRate = async (req, res) => {
  try {
    const { from, to } = req.params;
    const { amount = 1 } = req.query;

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

    // Set cache header (5 minutes)
    res.set("Cache-Control", "public, max-age=300");

    return res.status(200).json({
      success: true,
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      rate: rateInfo.formattedRate,
      rateRaw: rateInfo.rateRaw || rateInfo.rate,
      rateWei: rateInfo.rateWei,
      amount: numericAmount,
      convertedAmount,
      timestamp: rateInfo.timestamp,
    });
  } catch (error) {
    console.error("Error in getCurrencyRate:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get property price history
 * @route GET /api/oracle/price-history/:propertyId
 * @access Public
 */
export const getPropertyPriceHistory = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { startDate, endDate, currency = "USD", limit = 100 } = req.query;

    const filters = {
      limit: parseInt(limit),
    };

    if (startDate) {
      filters.startDate = new Date(startDate);
    }

    if (endDate) {
      filters.endDate = new Date(endDate);
    }

    const history = await propertyPricingService.getPriceHistory(
      parseInt(propertyId),
      filters,
    );

    // Convert prices to requested currency if needed
    const convertedHistory = await Promise.all(
      history.map(async (record) => {
        if (record.currency.toUpperCase() !== currency.toUpperCase()) {
          const converted = await currencyConversionService.convertAmount(
            record.price,
            record.currency,
            currency.toUpperCase(),
          );
          return {
            ...record,
            priceInRequestedCurrency: converted,
            requestedCurrency: currency.toUpperCase(),
          };
        }
        return {
          ...record,
          priceInRequestedCurrency: record.price,
          requestedCurrency: currency.toUpperCase(),
        };
      }),
    );

    // Set cache header (10 minutes for historical data)
    res.set("Cache-Control", "public, max-age=600");

    return res.status(200).json({
      success: true,
      propertyId: parseInt(propertyId),
      currency: currency.toUpperCase(),
      count: convertedHistory.length,
      history: convertedHistory,
    });
  } catch (error) {
    console.error("Error in getPropertyPriceHistory:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Update property price (Admin or automated oracle)
 * @route POST /api/oracle/update-property/:propertyId
 * @access Private (Admin)
 */
export const updatePropertyPrice = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { newPrice, currency, source, metadata } = req.body;

    if (!newPrice || !currency) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: newPrice, currency",
      });
    }

    const result = await propertyPricingService.updatePropertyPrice({
      propertyId: parseInt(propertyId),
      newPrice: parseFloat(newPrice),
      currency: currency.toUpperCase(),
      source: source || "manual",
      metadata: metadata || {},
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in updatePropertyPrice:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get supported currencies
 * @route GET /api/oracle/supported-currencies
 * @access Public
 */
export const getSupportedCurrencies = async (req, res) => {
  try {
    const currencies = await oracleService.getSupportedCurrencies();

    // Set cache header (1 hour)
    res.set("Cache-Control", "public, max-age=3600");

    return res.status(200).json({
      success: true,
      currencies,
    });
  } catch (error) {
    console.error("Error in getSupportedCurrencies:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Apply manual price override (fraud prevention)
 * @route POST /api/oracle/manual-override/:propertyId
 * @access Private (Admin only)
 */
export const applyManualOverride = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { newPrice, reason, currency } = req.body;
    const adminId = req.user.id;

    if (!newPrice || !reason || !currency) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: newPrice, reason, currency",
      });
    }

    const result = await propertyPricingService.applyManualOverride({
      propertyId: parseInt(propertyId),
      newPrice: parseFloat(newPrice),
      adminId,
      reason,
      currency: currency.toUpperCase(),
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in applyManualOverride:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get price anomalies
 * @route GET /api/oracle/anomalies
 * @access Private (Admin)
 */
export const getPriceAnomalies = async (req, res) => {
  try {
    const { threshold = 20 } = req.query;

    const anomalies = await propertyPricingService.detectPriceAnomalies(
      parseFloat(threshold),
    );

    return res.status(200).json({
      success: true,
      count: anomalies.length,
      threshold: parseFloat(threshold),
      anomalies,
    });
  } catch (error) {
    console.error("Error in getPriceAnomalies:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Sync property prices from blockchain
 * @route POST /api/oracle/sync-prices
 * @access Private (Admin)
 */
export const syncPricesFromChain = async (req, res) => {
  try {
    const { propertyIds } = req.body;

    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "propertyIds array is required and must not be empty",
      });
    }

    const result =
      await propertyPricingService.syncPricesFromChain(propertyIds);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in syncPricesFromChain:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get multi-currency display
 * @route GET /api/oracle/multi-currency/:propertyId
 * @access Public
 */
export const getMultiCurrencyDisplay = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const valuation = await propertyPricingService.getLatestValuation(
      parseInt(propertyId),
    );

    if (!valuation) {
      return res.status(404).json({
        success: false,
        error: "Property valuation not found",
      });
    }

    // Get prices in all supported currencies
    const currencies = ["USD", "PKR", "AED", "EUR", "GBP"];
    const prices = {};

    for (const currency of currencies) {
      try {
        const converted = await currencyConversionService.convertAmount(
          valuation.price,
          valuation.currency,
          currency,
        );
        prices[currency] = {
          amount: converted.convertedAmount,
          formatted: converted.formattedAmount,
        };
      } catch (error) {
        prices[currency] = {
          error: error.message,
        };
      }
    }

    // Add crypto equivalents
    const cryptos = ["ETH", "USDC", "USDT"];
    for (const crypto of cryptos) {
      try {
        const cryptoEquiv = await currencyConversionService.getCryptoEquivalent(
          valuation.price,
          valuation.currency,
          crypto,
        );
        prices[crypto] = {
          amount: cryptoEquiv.cryptoAmount,
          formatted: cryptoEquiv.formattedAmount,
        };
      } catch (error) {
        prices[crypto] = {
          error: error.message,
        };
      }
    }

    // Set cache header (5 minutes)
    res.set("Cache-Control", "public, max-age=300");

    return res.status(200).json({
      success: true,
      propertyId: parseInt(propertyId),
      baseCurrency: valuation.currency,
      basePrice: valuation.price,
      source: valuation.priceSource,
      lastUpdated: valuation.valuationDate,
      prices,
    });
  } catch (error) {
    console.error("Error in getMultiCurrencyDisplay:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Fetch real-world property valuation from external API
 * Uses Rentcast (US) / ATTOM / configurable API / heuristic fallback
 * @route POST /api/oracle/fetch-realworld-price/:propertyId
 * @access Private (Admin)
 */
export const fetchRealWorldPropertyPrice = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { updateBlockchain = false } = req.body;

    const result = await propertyPricingService.fetchRealWorldPropertyPrice(
      parseInt(propertyId),
      updateBlockchain === true || updateBlockchain === "true",
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error in fetchRealWorldPropertyPrice:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export default {
  getPropertyPrice,
  getCurrencyRate,
  getPropertyPriceHistory,
  updatePropertyPrice,
  fetchRealWorldPropertyPrice,
  getSupportedCurrencies,
  applyManualOverride,
  getPriceAnomalies,
  syncPricesFromChain,
  getMultiCurrencyDisplay,
};
