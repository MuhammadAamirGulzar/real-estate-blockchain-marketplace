import { ethers } from "ethers";
import oracleService from "./oracleService.js";

const WAD = 10n ** 18n;
const CRYPTO_CURRENCIES = new Set(["ETH", "BTC", "USDC", "USDT", "RWAP"]);
const FIAT_CURRENCIES = new Set(["USD", "PKR", "AED", "EUR", "GBP"]);

/**
 * @title CurrencyConversionService
 * @description Handles currency conversions using oracle exchange rates
 * @features
 * - Convert between fiat currencies (USD, PKR, AED, EUR, GBP)
 * - Convert between crypto and fiat
 * - Calculate fractional token amounts for investments
 * - Display price formatting for frontend
 */

class CurrencyConversionService {
  normalizeAmountInput(amount) {
    if (amount === null || amount === undefined) {
      throw new Error("Amount is required");
    }

    let normalized;

    if (typeof amount === "number") {
      if (!Number.isFinite(amount)) {
        throw new Error("Amount must be a finite number");
      }

      normalized = amount.toLocaleString("en-US", {
        useGrouping: false,
        maximumFractionDigits: 18,
      });
    } else {
      normalized = String(amount).trim().replace(/,/g, "");
    }

    if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
      throw new Error(`Invalid amount format: ${amount}`);
    }

    const [whole, fraction = ""] = normalized.split(".");
    const safeFraction = fraction.slice(0, 18);

    return safeFraction.length > 0 ? `${whole}.${safeFraction}` : whole;
  }

  normalizeRateToWad(rate) {
    const normalizedRate = this.normalizeAmountInput(rate);

    // Backward compatibility: some sources may already store rates in 18-decimal fixed-point.
    if (!normalizedRate.includes(".") && normalizedRate.length > 20) {
      return BigInt(normalizedRate);
    }

    return ethers.parseUnits(normalizedRate, 18);
  }

  orientRateForPair(rateWad, fromCurrency, toCurrency) {
    const from = String(fromCurrency || "").toUpperCase();
    const to = String(toCurrency || "").toUpperCase();

    const fromIsFiat = FIAT_CURRENCIES.has(from);
    const toIsFiat = FIAT_CURRENCIES.has(to);
    const fromIsCrypto = CRYPTO_CURRENCIES.has(from);
    const toIsCrypto = CRYPTO_CURRENCIES.has(to);

    // Some stored crypto rates are base-per-quote (e.g., USD per ETH) while
    // conversion needs quote-per-base (ETH per USD). Invert when shape is inverted.
    if (fromIsFiat && toIsCrypto && rateWad > WAD) {
      return (WAD * WAD) / rateWad;
    }

    if (fromIsCrypto && toIsFiat && rateWad < WAD) {
      return (WAD * WAD) / rateWad;
    }

    return rateWad;
  }

  /**
   * Convert amount from one currency to another
   * @param {string} amount - Amount to convert (can be string or number)
   * @param {string} fromCurrency - Source currency code
   * @param {string} toCurrency - Target currency code
   * @returns {Promise<string>} Converted amount
   */
  async convertAmount(amount, fromCurrency, toCurrency) {
    try {
      if (fromCurrency === toCurrency) {
        return amount.toString();
      }

      // Convert amount to 18-decimal fixed-point value.
      const normalizedAmount = this.normalizeAmountInput(amount);
      const amountWei = ethers.parseUnits(normalizedAmount, 18);

      // Get exchange rate
      const rate = await oracleService.getExchangeRate(
        fromCurrency,
        toCurrency,
      );
      const rawRateWad = this.normalizeRateToWad(rate);
      const rateBigInt = this.orientRateForPair(
        rawRateWad,
        fromCurrency,
        toCurrency,
      );

      // Calculate: (amount * rate) / 1e18
      const convertedWei = (amountWei * rateBigInt) / WAD;

      // Return in base units (not wei)
      return ethers.formatUnits(convertedWei, 18);
    } catch (error) {
      console.error(
        `Error converting ${fromCurrency} to ${toCurrency}:`,
        error,
      );
      throw new Error(`Currency conversion failed: ${error.message}`);
    }
  }

  /**
   * Get display price with proper formatting
   * @param {string|number} price - Price amount
   * @param {string} baseCurrency - Original currency
   * @param {string} targetCurrency - Display currency
   * @returns {Promise<{amount: string, formattedAmount: string, symbol: string}>}
   */
  async getDisplayPrice(price, baseCurrency, targetCurrency) {
    try {
      const convertedAmount = await this.convertAmount(
        price,
        baseCurrency,
        targetCurrency,
      );

      // Get currency symbol
      const symbols = {
        USD: "$",
        PKR: "₨",
        AED: "د.إ",
        EUR: "€",
        GBP: "£",
        ETH: "ETH",
        USDC: "USDC",
        USDT: "USDT",
        RWAP: "RWAP",
      };

      const symbol = symbols[targetCurrency] || targetCurrency;

      // Format number with commas
      const formattedAmount = this.formatNumber(convertedAmount);

      return {
        amount: convertedAmount,
        formattedAmount,
        symbol,
        currency: targetCurrency,
      };
    } catch (error) {
      console.error("Error getting display price:", error);
      throw error;
    }
  }

  /**
   * Calculate fractional tokens received for investment
   * @param {string|number} fiatAmount - Investment amount in fiat
   * @param {string} fiatCurrency - Fiat currency code
   * @param {string|number} pricePerToken - Price per fractional token in USD
   * @returns {Promise<string>} Fractional tokens amount
   */
  async calculateFractionalTokens(fiatAmount, fiatCurrency, pricePerToken) {
    try {
      // Convert fiat amount to USD
      let amountInUSD;
      if (fiatCurrency === "USD") {
        amountInUSD = fiatAmount.toString();
      } else {
        amountInUSD = await this.convertAmount(fiatAmount, fiatCurrency, "USD");
      }

      // Parse to BigInt for precision
      const amountWei = ethers.parseUnits(amountInUSD, 18);
      const priceWei = ethers.parseUnits(pricePerToken.toString(), 18);

      // Calculate: (amount * 1e18) / pricePerToken
      const fractionalTokensWei = (amountWei * WAD) / priceWei;

      return ethers.formatUnits(fractionalTokensWei, 18);
    } catch (error) {
      console.error("Error calculating fractional tokens:", error);
      throw error;
    }
  }

  /**
   * Calculate crypto token equivalent for fiat amount
   * @param {string|number} fiatAmount - Fiat amount
   * @param {string} fiatCurrency - Fiat currency code
   * @param {string} cryptoToken - Crypto token (ETH, USDC, USDT, RWAP)
   * @returns {Promise<string>} Crypto amount
   */
  async getCryptoEquivalent(fiatAmount, fiatCurrency, cryptoToken) {
    try {
      // First convert fiat to USD if needed
      let amountInUSD = fiatAmount.toString();
      if (fiatCurrency !== "USD") {
        amountInUSD = await this.convertAmount(fiatAmount, fiatCurrency, "USD");
      }

      // Get crypto price in USD
      const cryptoPair = `${cryptoToken}/USD`;
      let cryptoPrice;

      try {
        const priceData = await oracleService.fetchChainlinkPrice(cryptoPair);
        cryptoPrice = priceData.price;
      } catch (error) {
        console.error(`Failed to get ${cryptoToken} price, using fallback`);
        // Fallback prices (should be updated by oracle)
        const fallbackPrices = {
          ETH: ethers.parseUnits("2500", 18).toString(), // $2500
          USDC: ethers.parseUnits("1", 18).toString(), // $1
          USDT: ethers.parseUnits("1", 18).toString(), // $1
          RWAP: ethers.parseUnits("1", 18).toString(), // $1 (adjust as needed)
        };
        cryptoPrice =
          fallbackPrices[cryptoToken] || ethers.parseUnits("1", 18).toString();
      }

      // Calculate: (fiatAmount * 1e18) / cryptoPrice
      const amountWei = ethers.parseUnits(amountInUSD, 18);
      const priceWei = this.normalizeRateToWad(cryptoPrice);

      const cryptoAmount = (amountWei * WAD) / priceWei;

      return ethers.formatUnits(cryptoAmount, 18);
    } catch (error) {
      console.error("Error calculating crypto equivalent:", error);
      throw error;
    }
  }

  /**
   * Get conversion rate between two currencies
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @returns {Promise<{rate: string, formattedRate: string, timestamp: Date}>}
   */
  async getConversionRate(fromCurrency, toCurrency) {
    try {
      const rate = await oracleService.getExchangeRate(
        fromCurrency,
        toCurrency,
      );
      const rawRateWei = this.normalizeRateToWad(rate);
      const rateWei = this.orientRateForPair(
        rawRateWei,
        fromCurrency,
        toCurrency,
      );
      const rateFormatted = ethers.formatUnits(rateWei, 18);
      const rateNumeric = Number(rateFormatted);
      const displayDecimals =
        Number.isFinite(rateNumeric) &&
        Math.abs(rateNumeric) > 0 &&
        Math.abs(rateNumeric) < 1
          ? 8
          : 2;

      return {
        rate: rateFormatted,
        rateRaw: this.normalizeAmountInput(rate),
        rateWei: rateWei.toString(),
        formattedRate: this.formatNumber(rateFormatted, displayDecimals),
        fromCurrency,
        toCurrency,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error("Error getting conversion rate:", error);
      throw error;
    }
  }

  /**
   * Convert multiple currencies at once (for displaying property in all currencies)
   * @param {string|number} baseAmount - Amount in base currency
   * @param {string} baseCurrency - Base currency
   * @param {Array<string>} targetCurrencies - Array of target currencies
   * @returns {Promise<Object>} Object with currency: amount pairs
   */
  async convertToMultipleCurrencies(
    baseAmount,
    baseCurrency,
    targetCurrencies,
  ) {
    try {
      const results = {};

      for (const targetCurrency of targetCurrencies) {
        try {
          const displayPrice = await this.getDisplayPrice(
            baseAmount,
            baseCurrency,
            targetCurrency,
          );
          results[targetCurrency] = displayPrice;
        } catch (error) {
          console.error(
            `Failed to convert to ${targetCurrency}:`,
            error.message,
          );
          results[targetCurrency] = {
            error: error.message,
            amount: "0",
            formattedAmount: "N/A",
            symbol: targetCurrency,
          };
        }
      }

      return results;
    } catch (error) {
      console.error("Error converting to multiple currencies:", error);
      throw error;
    }
  }

  /**
   * Calculate investment breakdown
   * @param {Object} params - Investment parameters
   * @returns {Promise<Object>} Detailed investment breakdown
   */
  async calculateInvestmentBreakdown({
    propertyPrice,
    propertyCurrency,
    investmentAmount,
    investmentCurrency,
    pricePerToken,
  }) {
    try {
      // Convert property price to USD
      const propertyPriceUSD =
        propertyCurrency === "USD"
          ? propertyPrice
          : await this.convertAmount(propertyPrice, propertyCurrency, "USD");

      // Convert investment amount to USD
      const investmentUSD =
        investmentCurrency === "USD"
          ? investmentAmount
          : await this.convertAmount(
              investmentAmount,
              investmentCurrency,
              "USD",
            );

      // Calculate fractional tokens
      const fractionalTokens = await this.calculateFractionalTokens(
        investmentAmount,
        investmentCurrency,
        pricePerToken,
      );

      // Calculate ownership percentage
      const ownershipPercent =
        (parseFloat(investmentUSD) / parseFloat(propertyPriceUSD)) * 100;

      // Get exchange rate used
      const exchangeRate = await this.getConversionRate(
        investmentCurrency,
        "USD",
      );

      return {
        propertyPrice: {
          amount: propertyPrice,
          currency: propertyCurrency,
          usd: propertyPriceUSD,
        },
        investment: {
          amount: investmentAmount,
          currency: investmentCurrency,
          usd: investmentUSD,
        },
        fractionalTokens: {
          amount: fractionalTokens,
          pricePerToken,
        },
        ownership: {
          percent: ownershipPercent.toFixed(4),
          decimal: (ownershipPercent / 100).toString(),
        },
        exchangeRate: {
          rate: exchangeRate.formattedRate,
          from: investmentCurrency,
          to: "USD",
        },
      };
    } catch (error) {
      console.error("Error calculating investment breakdown:", error);
      throw error;
    }
  }

  /**
   * Format number with commas and proper decimals
   * @param {string|number} number - Number to format
   * @param {number} decimals - Number of decimal places (default: 2)
   * @returns {string} Formatted number
   */
  formatNumber(number, decimals = 2) {
    try {
      const num = typeof number === "string" ? parseFloat(number) : number;
      if (isNaN(num)) return "0.00";

      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(num);
    } catch (error) {
      return number.toString();
    }
  }

  /**
   * Parse currency amount from string (handles different formats)
   * @param {string} amountStr - Amount string (e.g., "1,234.56", "$1234", "₨100,000")
   * @returns {string} Cleaned numeric string
   */
  parseCurrencyAmount(amountStr) {
    try {
      // Remove currency symbols and commas
      const cleaned = amountStr.replace(/[$₨د.إ€£,\s]/g, "");

      // Validate it's a number
      if (isNaN(parseFloat(cleaned))) {
        throw new Error("Invalid currency amount");
      }

      return cleaned;
    } catch (error) {
      console.error("Error parsing currency amount:", error);
      throw error;
    }
  }

  /**
   * Get currency symbol
   * @param {string} currencyCode - Currency code
   * @returns {string} Currency symbol
   */
  getCurrencySymbol(currencyCode) {
    const symbols = {
      USD: "$",
      PKR: "₨",
      AED: "د.إ",
      EUR: "€",
      GBP: "£",
      ETH: "Ξ",
      USDC: "USDC",
      USDT: "USDT",
      RWAP: "RWAP",
    };

    return symbols[currencyCode] || currencyCode;
  }

  /**
   * Check if currency is crypto
   * @param {string} currencyCode - Currency code
   * @returns {boolean}
   */
  isCrypto(currencyCode) {
    return ["ETH", "BTC", "USDC", "USDT", "RWAP"].includes(currencyCode);
  }

  /**
   * Check if currency is fiat
   * @param {string} currencyCode - Currency code
   * @returns {boolean}
   */
  isFiat(currencyCode) {
    return ["USD", "PKR", "AED", "EUR", "GBP"].includes(currencyCode);
  }
}

// Create singleton instance
const currencyConversionService = new CurrencyConversionService();

export default currencyConversionService;
