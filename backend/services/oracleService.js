import { and, desc, eq } from "drizzle-orm";
import { ethers } from "ethers";
import cron from "node-cron";
import contractConfig from "../config/contracts.config.js";
import { db } from "../db/connection.js";
import { currencyExchangeRates } from "../db/schema.js";
import { loadABI } from "../utils/loadABI.js";

const PriceOracleABI = loadABI("PriceOracle");
const WAD = 10n ** 18n;

/**
 * @title OracleService
 * @description Manages Chainlink oracle price feeds and exchange rate synchronization
 * @features
 * - Fetches prices from Chainlink on-chain feeds
 * - Updates database with latest exchange rates
 * - Fallback to external APIs when Chainlink unavailable
 * - Scheduled cron jobs for automatic updates
 */

class OracleService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.priceOracleAddress = null;
    this.priceOracleContract = null;
    this.updateInterval = parseInt(process.env.ORACLE_UPDATE_INTERVAL || "300");
    this.rateCacheExpiry = 300000;
    this.rateCache = new Map();
  }

  normalizeRateToWad(rate) {
    const normalized = String(rate ?? "")
      .trim()
      .replace(/,/g, "");

    if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized)) {
      throw new Error(`Invalid rate value: ${rate}`);
    }

    // Backward compatibility for already-wei values.
    if (!normalized.includes(".") && normalized.length > 20) {
      return BigInt(normalized);
    }

    return ethers.parseUnits(normalized, 18);
  }

  invertRate(rate) {
    const rateWad = this.normalizeRateToWad(rate);
    if (rateWad <= 0n) {
      throw new Error(`Cannot invert non-positive rate: ${rate}`);
    }

    const invertedWad = (WAD * WAD) / rateWad;
    return ethers.formatUnits(invertedWad, 18);
  }

  async getActiveRateRecord(baseCurrency, quoteCurrency) {
    const [rate] = await db
      .select()
      .from(currencyExchangeRates)
      .where(
        and(
          eq(currencyExchangeRates.baseCurrency, baseCurrency),
          eq(currencyExchangeRates.quoteCurrency, quoteCurrency),
          eq(currencyExchangeRates.isActive, true),
        ),
      )
      .orderBy(desc(currencyExchangeRates.lastUpdate))
      .limit(1);

    return rate || null;
  }

  async upsertRateRecord(
    baseCurrency,
    quoteCurrency,
    rateValue,
    source,
    timestamp,
  ) {
    await db
      .update(currencyExchangeRates)
      .set({ isActive: false })
      .where(
        and(
          eq(currencyExchangeRates.baseCurrency, baseCurrency),
          eq(currencyExchangeRates.quoteCurrency, quoteCurrency),
        ),
      );

    await db.insert(currencyExchangeRates).values({
      baseCurrency,
      quoteCurrency,
      rate: rateValue,
      source,
      oracleChainlinkAddress:
        source === "chainlink" ? this.priceOracleAddress : null,
      lastUpdate: new Date((timestamp || Math.floor(Date.now() / 1000)) * 1000),
      isActive: true,
      confidence: source === "chainlink" ? 100 : 80,
    });

    this.rateCache.set(`${baseCurrency}_${quoteCurrency}`, {
      rate: rateValue,
      timestamp: Date.now(),
    });
  }

  async refreshSingleRate(baseCurrency, quoteCurrency) {
    try {
      const direct = await this.fetchChainlinkPrice(
        `${baseCurrency}/${quoteCurrency}`,
      );

      await this.upsertRateRecord(
        baseCurrency,
        quoteCurrency,
        String(direct.price),
        direct.source || "fallback_api",
        direct.timestamp,
      );

      return String(direct.price);
    } catch {
      const reverse = await this.fetchChainlinkPrice(
        `${quoteCurrency}/${baseCurrency}`,
      );

      const invertedRate = this.invertRate(reverse.price);

      await this.upsertRateRecord(
        baseCurrency,
        quoteCurrency,
        invertedRate,
        reverse.source || "fallback_api",
        reverse.timestamp,
      );

      return invertedRate;
    }
  }

  async initialize() {
    try {
      const config = contractConfig.loadContractAddresses();
      this.priceOracleAddress = config.PriceOracle;

      if (!this.priceOracleAddress) {
        console.warn("⚠️  PriceOracle address not configured");
        return;
      }

      // Check if ABI was loaded
      if (!PriceOracleABI.abi || PriceOracleABI.abi.length === 0) {
        console.warn(
          "⚠️  PriceOracle ABI not available. Skipping contract initialization.",
        );
        return;
      }

      this.priceOracleContract = new ethers.Contract(
        this.priceOracleAddress,
        PriceOracleABI.abi,
        this.provider,
      );

      console.log(
        "✅ OracleService initialized with PriceOracle:",
        this.priceOracleAddress,
      );

      this.startCronJobs();
    } catch (error) {
      console.error("Failed to initialize OracleService:", error);
    }
  }

  /**
   * Fetch latest price from Chainlink through on-chain oracle
   * @param {string} currency - Currency pair (e.g., "ETH/USD", "EUR/USD")
   * @returns {Promise<{price: bigint, timestamp: number}>}
   */
  async fetchChainlinkPrice(currency) {
    try {
      if (!this.priceOracleContract) {
        throw new Error("OracleService not initialized");
      }

      const [price, timestamp] =
        await this.priceOracleContract.getChainlinkPrice(currency);

      return {
        price: price.toString(),
        timestamp: parseInt(timestamp.toString()),
        source: "chainlink",
      };
    } catch (error) {
      console.error(
        `Error fetching Chainlink price for ${currency}:`,
        error.message,
      );

      // Fallback to external API
      return await this.fetchFallbackAPI(currency);
    }
  }

  /**
   * Fallback to external API when Chainlink is unavailable
   * @param {string} currency - Currency pair
   * @returns {Promise<Object>}
   */
  async fetchFallbackAPI(currency) {
    try {
      // Parse currency pair (e.g., "ETH/USD" -> base: ETH, quote: USD)
      const [base, quote] = currency.split("/");

      // Use CoinGecko API for crypto prices
      if (["ETH", "BTC", "USDC", "USDT", "RWAP"].includes(base)) {
        return await this.fetchCryptoPrice(base, quote);
      }

      // Use Exchange Rate API for fiat currencies
      return await this.fetchFiatRate(base, quote);
    } catch (error) {
      console.error(`Fallback API failed for ${currency}:`, error.message);
      throw new Error(`All oracle sources failed for ${currency}`);
    }
  }

  /**
   * Dev-only fallback prices used when CoinGecko is rate-limited or unreachable.
   * Approximate values — good enough for local testing.
   */
  _devFallbackPrices(cryptos) {
    const DEV = { ETH: "2000", BTC: "60000", USDC: "1", USDT: "1", RWAP: "1" };
    const now = Math.floor(Date.now() / 1000);
    if (typeof cryptos === "string") {
      return {
        price: DEV[cryptos] ?? "1",
        timestamp: now,
        source: "dev_fallback",
      };
    }
    const result = {};
    for (const sym of cryptos) {
      result[sym] = {
        price: DEV[sym] ?? "1",
        timestamp: now,
        source: "dev_fallback",
      };
    }
    return result;
  }

  /**
   * Fetch one or many cryptocurrency prices from CoinGecko in a single request.
   * Retries up to 3 times on 429, then falls back to hardcoded dev prices.
   *
   * @param {string|string[]} cryptos - e.g. "ETH" or ["ETH","USDC","USDT"]
   * @param {string} fiat - Quote currency (default "USD")
   */
  async fetchCryptoPrice(cryptos, fiat = "USD") {
    const coinIds = {
      ETH: "ethereum",
      BTC: "bitcoin",
      USDC: "usd-coin",
      USDT: "tether",
      RWAP: "rwa-platform-token",
    };

    const single = typeof cryptos === "string";
    const symbols = single ? [cryptos] : cryptos;
    const ids = symbols
      .map((s) => coinIds[s])
      .filter(Boolean)
      .join(",");
    if (!ids) throw new Error(`Unsupported crypto: ${symbols.join(",")}`);

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 1) {
        const wait = attempt * 3000; // 3 s, 6 s
        console.log(
          `⏳ CoinGecko retry ${attempt}/${MAX_RETRIES} in ${wait / 1000}s...`,
        );
        await new Promise((r) => setTimeout(r, wait));
      }
      try {
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${fiat.toLowerCase()}`,
        );
        if (response.status === 429) {
          if (attempt < MAX_RETRIES) continue; // will retry
          break; // exhausted — fall through to dev fallback
        }
        if (!response.ok)
          throw new Error(`CoinGecko API error: ${response.statusText}`);

        const data = await response.json();
        const now = Math.floor(Date.now() / 1000);

        if (single) {
          const price = data[coinIds[symbols[0]]]?.[fiat.toLowerCase()];
          if (price == null)
            throw new Error(`No price returned for ${symbols[0]}`);
          return {
            price: price.toString(),
            timestamp: now,
            source: "coingecko_api",
          };
        }
        const result = {};
        for (const sym of symbols) {
          const price =
            coinIds[sym] && data[coinIds[sym]]?.[fiat.toLowerCase()];
          if (price != null)
            result[sym] = {
              price: price.toString(),
              timestamp: now,
              source: "coingecko_api",
            };
        }
        return result;
      } catch (err) {
        if (attempt === MAX_RETRIES) {
          console.warn(
            `⚠️  CoinGecko failed after ${MAX_RETRIES} attempts: ${err.message}`,
          );
          break;
        }
      }
    }

    // All retries exhausted — use dev fallback so the DB is always populated
    console.warn(
      "⚠️  CoinGecko unavailable — using dev fallback prices (local dev only)",
    );
    return this._devFallbackPrices(single ? cryptos : symbols);
  }

  /**
   * Fetch fiat exchange rate from external API
   * @param {string} base - Base currency (USD)
   * @param {string} quote - Quote currency (PKR, EUR, etc.)
   */
  async fetchFiatRate(base = "USD", quote) {
    try {
      const apiKey = process.env.EXCHANGE_RATE_API_KEY;

      // Build URL: use v6 authenticated endpoint when a key is provided,
      // otherwise fall back to the free open.er-api.com endpoint.
      let url;
      if (apiKey) {
        const apiBase =
          process.env.EXCHANGE_RATE_API_URL ||
          "https://v6.exchangerate-api.com/v6";
        url = `${apiBase}/${apiKey}/latest/${base}`;
      } else {
        url = `https://open.er-api.com/v6/latest/${base}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Exchange Rate API error: ${response.statusText}`);
      }

      const data = await response.json();
      // open.er-api.com uses 'rates'; exchangerate-api v6 also uses 'rates'
      const rates = data.rates || data.conversion_rates;
      const rate = rates && rates[quote];

      if (!rate) {
        throw new Error(`Rate not available for ${base}/${quote}`);
      }

      // Store as human-readable decimal (NOT wei) so it fits DB decimal(18,8)
      return {
        price: rate.toString(),
        timestamp: Math.floor(Date.now() / 1000),
        source: "exchangerate_api",
      };
    } catch (error) {
      console.error(`Exchange Rate API error:`, error);
      throw error;
    }
  }

  /**
   * Update database with latest exchange rates
   * @param {string} baseCurrency - Base currency (usually USD)
   * @param {Array<string>} quoteCurrencies - Array of quote currencies
   */
  async updateDatabaseRates(
    baseCurrency = "USD",
    quoteCurrencies = ["PKR", "AED", "EUR", "GBP", "ETH", "USDC", "USDT"],
  ) {
    try {
      const results = [];

      // Pre-fetch ALL crypto prices in ONE CoinGecko call to avoid 429 rate limiting
      const CRYPTO_SYMBOLS = ["ETH", "BTC", "USDC", "USDT", "RWAP"];
      const cryptoSymbols = quoteCurrencies.filter((c) =>
        CRYPTO_SYMBOLS.includes(c),
      );
      let cryptoPrices = {};
      if (cryptoSymbols.length > 0) {
        // fetchCryptoPrice handles retries and dev-fallback internally — never throws
        cryptoPrices = await this.fetchCryptoPrice(cryptoSymbols, baseCurrency);
      }

      for (const quoteCurrency of quoteCurrencies) {
        try {
          let priceData;
          let rateForPair;

          if (CRYPTO_SYMBOLS.includes(quoteCurrency)) {
            // Use the pre-fetched batch result — no per-symbol Chainlink call locally
            if (cryptoPrices[quoteCurrency]) {
              priceData = cryptoPrices[quoteCurrency];
            } else {
              throw new Error(`No price available for ${quoteCurrency}`);
            }

            // fetchCryptoPrice(quote, base) returns base-per-quote (e.g. USD per ETH).
            // Store quote-per-base for consistent conversion math (e.g. ETH per USD).
            const basePerQuoteWad = ethers.parseUnits(
              String(priceData.price),
              18,
            );
            const quotePerBaseWad = (WAD * WAD) / basePerQuoteWad;
            rateForPair = ethers.formatUnits(quotePerBaseWad, 18);
          } else {
            priceData = await this.fetchFiatRate(baseCurrency, quoteCurrency);
            rateForPair = priceData.price;
          }

          // Deactivate old rates
          await db
            .update(currencyExchangeRates)
            .set({ isActive: false })
            .where(
              and(
                eq(currencyExchangeRates.baseCurrency, baseCurrency),
                eq(currencyExchangeRates.quoteCurrency, quoteCurrency),
              ),
            );

          // Insert new rate — price is a plain decimal string, e.g. "1983.25"
          await db
            .insert(currencyExchangeRates)
            .values({
              baseCurrency,
              quoteCurrency,
              rate: rateForPair,
              source: priceData.source,
              oracleChainlinkAddress:
                priceData.source === "chainlink"
                  ? this.priceOracleAddress
                  : null,
              lastUpdate: new Date(priceData.timestamp * 1000),
              isActive: true,
              confidence: priceData.source === "chainlink" ? 100 : 80,
            })
            .returning();

          // Update cache
          this.rateCache.set(`${baseCurrency}_${quoteCurrency}`, {
            rate: rateForPair,
            timestamp: Date.now(),
          });

          results.push({
            pair: `${baseCurrency}/${quoteCurrency}`,
            rate: rateForPair,
            source: priceData.source,
            success: true,
          });

          console.log(
            `✅ Updated ${baseCurrency}/${quoteCurrency}: ${rateForPair} (${priceData.source})`,
          );
        } catch (error) {
          console.error(
            `❌ Failed to update ${baseCurrency}/${quoteCurrency}:`,
            error.message,
          );
          results.push({
            pair: `${baseCurrency}/${quoteCurrency}`,
            error: error.message,
            success: false,
          });
        }
      }

      return results;
    } catch (error) {
      console.error("Error updating database rates:", error);
      throw error;
    }
  }

  /**
   * Get exchange rate from database (with cache)
   * @param {string} fromCurrency - Base currency
   * @param {string} toCurrency - Quote currency
   * @returns {Promise<string>} Rate in 18 decimals
   */
  async getExchangeRate(fromCurrency, toCurrency) {
    try {
      const baseCurrency = String(fromCurrency || "").toUpperCase();
      const quoteCurrency = String(toCurrency || "").toUpperCase();

      // Check if same currency
      if (baseCurrency === quoteCurrency) {
        return ethers.parseUnits("1", 18).toString();
      }

      // Check cache first
      const cacheKey = `${baseCurrency}_${quoteCurrency}`;
      const cached = this.rateCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.rateCacheExpiry) {
        return cached.rate;
      }

      // Query direct pair from database.
      let rate = await this.getActiveRateRecord(baseCurrency, quoteCurrency);

      // If direct pair is unavailable, try reverse pair and invert.
      if (!rate) {
        const reverseRate = await this.getActiveRateRecord(
          quoteCurrency,
          baseCurrency,
        );

        if (reverseRate) {
          const invertedRate = this.invertRate(reverseRate.rate);
          this.rateCache.set(cacheKey, {
            rate: invertedRate,
            timestamp: Date.now(),
          });
          return invertedRate;
        }

        // Final fallback: fetch live and store for future calls.
        const fetchedRate = await this.refreshSingleRate(
          baseCurrency,
          quoteCurrency,
        );
        return fetchedRate;
      }

      // Check if rate is stale (older than 1 hour)
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (new Date(rate.lastUpdate) < hourAgo) {
        console.warn(
          `⚠️ Stale rate detected for ${baseCurrency}/${quoteCurrency}`,
        );
        // Trigger background update
        this.refreshSingleRate(baseCurrency, quoteCurrency).catch(
          console.error,
        );
      }

      // Update cache
      this.rateCache.set(cacheKey, {
        rate: rate.rate,
        timestamp: Date.now(),
      });

      return rate.rate;
    } catch (error) {
      console.error("Error getting exchange rate:", error);
      throw error;
    }
  }

  /**
   * Subscribe to on-chain oracle price update events
   */
  async subscribeToOracleUpdates() {
    try {
      if (!this.priceOracleContract) {
        throw new Error("OracleService not initialized");
      }

      // Listen to ExchangeRateUpdated events
      this.priceOracleContract.on(
        "ExchangeRateUpdated",
        async (baseCurrency, quoteCurrency, rate, source, event) => {
          console.log(
            `🔔 Oracle event: ${baseCurrency}/${quoteCurrency} updated to ${ethers.formatUnits(rate, 18)}`,
          );

          // Update database
          await db
            .update(currencyExchangeRates)
            .set({ isActive: false })
            .where(
              and(
                eq(currencyExchangeRates.baseCurrency, baseCurrency),
                eq(currencyExchangeRates.quoteCurrency, quoteCurrency),
              ),
            );

          await db.insert(currencyExchangeRates).values({
            baseCurrency,
            quoteCurrency,
            rate: rate.toString(),
            source,
            lastUpdate: new Date(),
            isActive: true,
            confidence: 100,
          });

          // Invalidate cache
          this.rateCache.delete(`${baseCurrency}_${quoteCurrency}`);
        },
      );

      console.log("✅ Subscribed to oracle price update events");
    } catch (error) {
      console.error("Error subscribing to oracle updates:", error);
    }
  }

  /**
   * Validate oracle data signature (for external oracle services)
   * @param {Object} data - Oracle data
   * @param {string} signature - Data signature
   * @returns {boolean}
   */
  async validateOracleData(data, signature) {
    try {
      // Create message hash
      const message = JSON.stringify(data);
      const messageHash = ethers.hashMessage(message);

      // Recover signer address
      const signerAddress = ethers.recoverAddress(messageHash, signature);

      // Verify signer has ORACLE_MANAGER_ROLE (implement role check logic here)
      // For now, basic validation
      return signerAddress !== ethers.ZeroAddress;
    } catch (error) {
      console.error("Error validating oracle data:", error);
      return false;
    }
  }

  /**
   * Start cron jobs for automatic rate updates
   */
  startCronJobs() {
    // Update rates every 5 minutes (or configured interval)
    const cronSchedule = `*/${this.updateInterval / 60} * * * *`;

    cron.schedule(cronSchedule, async () => {
      console.log("🔄 Running scheduled oracle rate update...");
      try {
        await this.updateDatabaseRates();
        console.log("✅ Scheduled rate update completed");
      } catch (error) {
        console.error("❌ Scheduled rate update failed:", error);
      }
    });

    console.log(
      `✅ Cron job scheduled: update rates every ${this.updateInterval} seconds`,
    );
  }

  /**
   * Get all supported currencies from oracle contract
   * @returns {Promise<Array<string>>}
   */
  async getSupportedCurrencies() {
    try {
      if (!this.priceOracleContract) {
        throw new Error("OracleService not initialized");
      }

      return await this.priceOracleContract.getSupportedCurrencies();
    } catch (error) {
      console.error("Error getting supported currencies:", error);
      // Fallback to hardcoded list
      return ["ETH/USD", "USDC/USD", "USDT/USD"];
    }
  }
}

// Create singleton instance
const oracleService = new OracleService();

export default oracleService;
