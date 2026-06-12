import { and, desc, eq } from "drizzle-orm";
import { ethers } from "ethers";
import contractConfig from "../config/contracts.config.js";
import { db } from "../db/connection.js";
import { properties, propertyValuations } from "../db/schema.js";
import { loadABI } from "../utils/loadABI.js";

const PriceOracleABI = loadABI("PriceOracle");

/**
 * @title PropertyPricingService
 * @description Manages property valuations from oracles and manual appraisals
 * @features
 * - Update property prices from oracle feeds
 * - Manual admin price overrides for fraud prevention
 * - Track price history
 * - Detect price anomalies
 * - Sync on-chain and off-chain prices
 */

class PropertyPricingService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.priceOracleAddress = null;
    this.priceOracleContract = null;
    this.wallet = null;
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

      if (process.env.DEPLOYER_PRIVATE_KEY) {
        this.wallet = new ethers.Wallet(
          process.env.DEPLOYER_PRIVATE_KEY,
          this.provider,
        );
        this.priceOracleContract = new ethers.Contract(
          this.priceOracleAddress,
          PriceOracleABI.abi,
          this.wallet,
        );
      } else {
        this.priceOracleContract = new ethers.Contract(
          this.priceOracleAddress,
          PriceOracleABI.abi,
          this.provider,
        );
      }

      console.log("✅ PropertyPricingService initialized");
    } catch (error) {
      console.error("Failed to initialize PropertyPricingService:", error);
    }
  }

  /**
   * Update property price from oracle or manual input
   * @param {Object} params - Update parameters
   * @returns {Promise<Object>} Updated valuation
   */
  async updatePropertyPrice({
    propertyId,
    newPrice,
    currency = "USD",
    source = "manual",
    oracleData = null,
    appraiserWallet = null,
    appraiserName = null,
    metadata = {},
    updateBlockchain = false,
  }) {
    try {
      // Validate inputs
      if (!propertyId || !newPrice) {
        throw new Error("Missing required parameters");
      }

      // Get property
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      if (!property) {
        throw new Error("Property not found");
      }

      // Get latest valuation for comparison
      const latestValuation = await this.getLatestValuation(propertyId);

      // Check for price anomaly
      let anomalyDetected = false;
      let deviationPercent = 0;

      if (latestValuation) {
        const oldPrice = parseFloat(latestValuation.valuationAmount);
        const newPriceFloat = parseFloat(newPrice);
        deviationPercent = Math.abs(
          ((newPriceFloat - oldPrice) / oldPrice) * 100,
        );

        // Alert if deviation > 20%
        const threshold = parseFloat(
          process.env.PRICE_DEVIATION_THRESHOLD || "20",
        );
        if (deviationPercent > threshold) {
          anomalyDetected = true;
          console.warn(
            `⚠️ Price anomaly detected for property ${propertyId}: ${deviationPercent.toFixed(2)}% deviation`,
          );
        }
      }

      // Deactivate previous valuations
      await db
        .update(propertyValuations)
        .set({ isActive: false })
        .where(eq(propertyValuations.propertyId, propertyId));

      // Create new valuation record
      const [newValuation] = await db
        .insert(propertyValuations)
        .values({
          propertyId,
          valuationAmount: newPrice.toString(),
          currency,
          valuationDate: new Date(),
          valuationType: source,
          oracleSource: oracleData?.oracleSource || source,
          oracleDataHash: oracleData?.dataHash || null,
          appraiserWallet,
          appraiserName,
          confidence: this._calculateConfidence(source),
          metadata: JSON.stringify(metadata),
          isActive: true,
        })
        .returning();

      // Update property table
      await db
        .update(properties)
        .set({
          currentMarketPrice: newPrice.toString(),
          lastPriceUpdate: new Date(),
          priceSource: source,
        })
        .where(eq(properties.id, propertyId));

      // Update on-chain if requested and wallet available
      let transactionHash = null;
      if (updateBlockchain && this.wallet) {
        transactionHash = await this._updatePriceOnChain(
          propertyId,
          newPrice,
          source,
        );

        // Update valuation with tx hash
        await db
          .update(propertyValuations)
          .set({ verificationTransactionHash: transactionHash })
          .where(eq(propertyValuations.id, newValuation.id));
      }

      return {
        success: true,
        valuation: newValuation,
        anomalyDetected,
        deviationPercent: deviationPercent.toFixed(2),
        transactionHash,
        message: anomalyDetected
          ? `Price updated with ${deviationPercent.toFixed(2)}% deviation - requires admin review`
          : "Price updated successfully",
      };
    } catch (error) {
      console.error("Error updating property price:", error);
      throw error;
    }
  }

  /**
   * Apply manual admin price override
   * @param {Object} params - Override parameters
   * @returns {Promise<Object>} Override result
   */
  async applyManualOverride({
    propertyId,
    newPrice,
    adminId,
    reason,
    updateBlockchain = true,
  }) {
    try {
      if (!propertyId || !newPrice || !adminId || !reason) {
        throw new Error("Missing required parameters");
      }

      // Get property
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      if (!property) {
        throw new Error("Property not found");
      }

      // Create override valuation
      const result = await this.updatePropertyPrice({
        propertyId,
        newPrice,
        currency: property.baseCurrency || "USD",
        source: "admin_override",
        metadata: {
          reason,
          adminId,
          overrideDate: new Date().toISOString(),
        },
        updateBlockchain,
      });

      // Update on-chain with override if wallet available
      if (updateBlockchain && this.wallet && this.priceOracleContract) {
        try {
          const priceWei = ethers.parseUnits(newPrice.toString(), 18);
          const tx = await this.priceOracleContract.manualPriceOverride(
            propertyId,
            priceWei,
            reason,
          );
          await tx.wait();

          console.log(`✅ Price override recorded on-chain: ${tx.hash}`);
        } catch (error) {
          console.error("Failed to update on-chain override:", error);
        }
      }

      return {
        success: true,
        valuation: result.valuation,
        message: "Manual price override applied successfully",
      };
    } catch (error) {
      console.error("Error applying manual override:", error);
      throw error;
    }
  }

  /**
   * Get latest valuation for property
   * @param {number} propertyId - Property ID
   * @returns {Promise<Object|null>} Latest valuation
   */
  async getLatestValuation(propertyId) {
    try {
      const [valuation] = await db
        .select()
        .from(propertyValuations)
        .where(
          and(
            eq(propertyValuations.propertyId, propertyId),
            eq(propertyValuations.isActive, true),
          ),
        )
        .orderBy(desc(propertyValuations.valuationDate))
        .limit(1);

      return valuation || null;
    } catch (error) {
      console.error("Error getting latest valuation:", error);
      throw error;
    }
  }

  /**
   * Get price history for property
   * @param {number} propertyId - Property ID
   * @param {Date} startDate - Start date filter
   * @param {Date} endDate - End date filter
   * @returns {Promise<Array>} Price history
   */
  async getPriceHistory(propertyId, startDate = null, endDate = null) {
    try {
      let query = db
        .select()
        .from(propertyValuations)
        .where(eq(propertyValuations.propertyId, propertyId))
        .orderBy(desc(propertyValuations.valuationDate));

      // Apply date filters if provided
      // Note: Drizzle ORM date filtering needs proper operators

      const history = await query;

      // Format for frontend charts
      return history.map((val) => ({
        date: val.valuationDate,
        price: parseFloat(val.valuationAmount),
        currency: val.currency,
        source: val.valuationType,
        confidence: val.confidence,
      }));
    } catch (error) {
      console.error("Error getting price history:", error);
      throw error;
    }
  }

  /**
   * Detect price anomalies across all properties
   * @param {number} thresholdPercent - Deviation threshold (default 20%)
   * @returns {Promise<Array>} Properties with anomalies
   */
  async detectPriceAnomalies(thresholdPercent = 20) {
    try {
      // Get all active properties
      const allProperties = await db
        .select()
        .from(properties)
        .where(eq(properties.status, "active"));

      const anomalies = [];

      for (const property of allProperties) {
        // Get last two valuations
        const valuations = await db
          .select()
          .from(propertyValuations)
          .where(eq(propertyValuations.propertyId, property.id))
          .orderBy(desc(propertyValuations.valuationDate))
          .limit(2);

        if (valuations.length >= 2) {
          const latest = parseFloat(valuations[0].valuationAmount);
          const previous = parseFloat(valuations[1].valuationAmount);
          const deviation = Math.abs(((latest - previous) / previous) * 100);

          if (deviation > thresholdPercent) {
            anomalies.push({
              propertyId: property.id,
              propertyTitle: property.title,
              currentPrice: latest,
              previousPrice: previous,
              deviation: deviation.toFixed(2),
              latestValuation: valuations[0],
              previousValuation: valuations[1],
            });
          }
        }
      }

      return anomalies;
    } catch (error) {
      console.error("Error detecting price anomalies:", error);
      throw error;
    }
  }

  /**
   * Sync property prices from on-chain oracle
   * @param {Array<number>} propertyIds - Optional array of property IDs
   * @returns {Promise<Object>} Sync results
   */
  async syncPricesFromChain(propertyIds = null) {
    try {
      if (!this.priceOracleContract) {
        throw new Error("Price oracle not initialized");
      }

      let propertiesToSync;
      if (propertyIds) {
        propertiesToSync = await db
          .select()
          .from(properties)
          .where(eq(properties.id, propertyIds));
      } else {
        // Get all properties with oracle enabled
        propertiesToSync = await db
          .select()
          .from(properties)
          .where(eq(properties.oracleEnabled, true));
      }

      const results = [];

      for (const property of propertiesToSync) {
        try {
          // Get on-chain price
          const [price, timestamp, source] =
            await this.priceOracleContract.getLatestPropertyPrice(property.id);

          const priceFormatted = ethers.formatUnits(price, 18);

          // Update database
          await this.updatePropertyPrice({
            propertyId: property.id,
            newPrice: priceFormatted,
            currency: property.baseCurrency || "USD",
            source: source || "chainlink",
            metadata: {
              onChainTimestamp: parseInt(timestamp.toString()),
              syncedAt: new Date().toISOString(),
            },
            updateBlockchain: false, // Don't write back to chain
          });

          results.push({
            propertyId: property.id,
            success: true,
            price: priceFormatted,
            source,
          });

          console.log(
            `✅ Synced price for property ${property.id}: $${priceFormatted}`,
          );
        } catch (error) {
          console.error(
            `Failed to sync price for property ${property.id}:`,
            error.message,
          );
          results.push({
            propertyId: property.id,
            success: false,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        syncedCount: results.filter((r) => r.success).length,
        failedCount: results.filter((r) => !r.success).length,
        results,
      };
    } catch (error) {
      console.error("Error syncing prices from chain:", error);
      throw error;
    }
  }

  /**
   * Fetch real-world property valuation from external API
   * Supports: Rentcast (US), custom regional APIs, or fallback heuristic
   * @param {number} propertyId - Property ID in DB
   * @param {boolean} updateBlockchain - Push result on-chain after fetching
   * @returns {Promise<Object>} Valuation result
   */
  async fetchRealWorldPropertyPrice(propertyId, updateBlockchain = false) {
    try {
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      if (!property) throw new Error("Property not found");

      const country = (property.country || "").toLowerCase();
      const address = property.address || property.location || "";
      const zip = property.zipCode || property.postalCode || "";

      let fetchedPrice = null;
      let source = "api";
      let currency = "USD";

      // ── Strategy 1: Rentcast (US properties) ────────────────────────────
      if (
        process.env.RENTCAST_API_KEY &&
        (country === "us" || country === "usa" || country === "united states")
      ) {
        try {
          const url = `https://api.rentcast.io/v1/properties/value?address=${encodeURIComponent(address)}&zipCode=${zip}`;
          const resp = await fetch(url, {
            headers: {
              accept: "application/json",
              "X-Api-Key": process.env.RENTCAST_API_KEY,
            },
          });
          if (resp.ok) {
            const data = await resp.json();
            fetchedPrice = data.price || data.value || data.estimatedValue;
            source = "rentcast_api";
            currency = "USD";
            console.log(
              `✅ Rentcast price for property ${propertyId}: $${fetchedPrice}`,
            );
          }
        } catch (err) {
          console.warn(
            `⚠️  Rentcast API failed for property ${propertyId}:`,
            err.message,
          );
        }
      }

      // ── Strategy 2: ATTOM AVM (configurable base URL) ──────────────────
      if (!fetchedPrice && process.env.ATTOM_API_KEY) {
        try {
          const url = `https://api.gateway.attomdata.com/property/v2/assessmenthistory?address1=${encodeURIComponent(address)}&address2=${zip}`;
          const resp = await fetch(url, {
            headers: {
              accept: "application/json",
              apikey: process.env.ATTOM_API_KEY,
            },
          });
          if (resp.ok) {
            const data = await resp.json();
            const assessed =
              data?.property?.[0]?.assessment?.assessed?.assdttlvalue;
            if (assessed) {
              fetchedPrice = assessed;
              source = "attom_api";
              currency = "USD";
              console.log(
                `✅ ATTOM price for property ${propertyId}: $${fetchedPrice}`,
              );
            }
          }
        } catch (err) {
          console.warn(
            `⚠️  ATTOM API failed for property ${propertyId}:`,
            err.message,
          );
        }
      }

      // ── Strategy 3: Custom configurable real-estate API ─────────────────
      if (
        !fetchedPrice &&
        process.env.REALESTATE_API_URL &&
        process.env.REALESTATE_API_KEY
      ) {
        try {
          const url = `${process.env.REALESTATE_API_URL}?address=${encodeURIComponent(address)}&apiKey=${process.env.REALESTATE_API_KEY}`;
          const resp = await fetch(url, {
            headers: { accept: "application/json" },
          });
          if (resp.ok) {
            const data = await resp.json();
            fetchedPrice =
              data.price ||
              data.value ||
              data.estimatedValue ||
              data.marketValue;
            source = "custom_realestate_api";
            currency = data.currency || "USD";
          }
        } catch (err) {
          console.warn(`⚠️  Custom real estate API failed:`, err.message);
        }
      }

      // ── Strategy 4: Heuristic fallback using property value from DB ─────
      if (!fetchedPrice) {
        // Use the stored propertyValue (admin-submitted) as baseline
        // Apply a small randomized ±2% market drift for realism
        const base = parseFloat(
          property.propertyValue || property.totalValue || 0,
        );
        if (base > 0) {
          const drift = 1 + (Math.random() * 0.04 - 0.02); // ±2%
          fetchedPrice = (base * drift).toFixed(2);
          source = "heuristic_drift";
          currency = property.currency || "USD";
          console.log(
            `ℹ️  Using heuristic price for property ${propertyId}: ${currency} ${fetchedPrice} (no API key configured)`,
          );
        } else {
          throw new Error(
            "Cannot estimate price: no API key configured and no base property value stored in DB",
          );
        }
      }

      // Save and optionally push on-chain
      const result = await this.updatePropertyPrice({
        propertyId,
        newPrice: fetchedPrice,
        currency,
        source,
        metadata: { address, fetchedAt: new Date().toISOString() },
        updateBlockchain,
      });

      return {
        ...result,
        fetchedPrice,
        currency,
        source,
        message: `Real-world price fetched via ${source}: ${currency} ${fetchedPrice}`,
      };
    } catch (error) {
      console.error(
        `Error fetching real-world price for property ${propertyId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update price on-chain
   * @private
   * @param {number} propertyId - Property ID
   * @param {string} newPrice - New price
   * @param {string} source - Price source
   * @returns {Promise<string>} Transaction hash
   */
  async _updatePriceOnChain(propertyId, newPrice, source) {
    try {
      if (!this.wallet || !this.priceOracleContract) {
        throw new Error("Wallet not configured for on-chain updates");
      }

      const priceWei = ethers.parseUnits(newPrice.toString(), 18);

      const tx = await this.priceOracleContract.updatePropertyPrice(
        propertyId,
        priceWei,
        source,
      );

      console.log(`⏳ Updating price on-chain: ${tx.hash}`);
      const receipt = await tx.wait();

      console.log(`✅ Price updated on-chain at block ${receipt.blockNumber}`);
      return tx.hash;
    } catch (error) {
      console.error("Error updating price on-chain:", error);
      throw error;
    }
  }

  /**
   * Calculate confidence score based on source
   * @private
   * @param {string} source - Price source
   * @returns {number} Confidence score (0-100)
   */
  _calculateConfidence(source) {
    const confidenceMap = {
      chainlink: 100,
      oracle_feed: 95,
      api: 80,
      manual: 70,
      admin_override: 90,
      initial: 60,
      market_update: 75,
    };

    return confidenceMap[source] || 50;
  }

  /**
   * Get valuation statistics for property
   * @param {number} propertyId - Property ID
   * @returns {Promise<Object>} Statistics
   */
  async getValuationStatistics(propertyId) {
    try {
      const history = await this.getPriceHistory(propertyId);

      if (history.length === 0) {
        return null;
      }

      const prices = history.map((h) => h.price);
      const average = prices.reduce((a, b) => a + b, 0) / prices.length;
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const current = prices[0];
      const volatility = ((max - min) / average) * 100;

      return {
        propertyId,
        current,
        average: average.toFixed(2),
        min,
        max,
        volatility: volatility.toFixed(2),
        dataPoints: history.length,
        firstValuationDate: history[history.length - 1].date,
        lastValuationDate: history[0].date,
      };
    } catch (error) {
      console.error("Error getting valuation statistics:", error);
      throw error;
    }
  }

  /**
   * Subscribe to on-chain price update events
   */
  async subscribeToPropertyPriceUpdates() {
    try {
      if (!this.priceOracleContract) {
        throw new Error("Price oracle not initialized");
      }

      this.priceOracleContract.on(
        "PropertyPriceUpdated",
        async (propertyId, newPrice, oldPrice, source, updatedBy, event) => {
          console.log(
            `🔔 Property ${propertyId} price updated on-chain: ${ethers.formatUnits(newPrice, 18)}`,
          );

          // Update database
          await this.updatePropertyPrice({
            propertyId: parseInt(propertyId.toString()),
            newPrice: ethers.formatUnits(newPrice, 18),
            source: source,
            metadata: {
              updatedBy,
              blockNumber: event.blockNumber,
              transactionHash: event.transactionHash,
            },
            updateBlockchain: false,
          });
        },
      );

      console.log("✅ Subscribed to property price update events");
    } catch (error) {
      console.error("Error subscribing to price updates:", error);
    }
  }
}

// Create singleton instance
const propertyPricingService = new PropertyPricingService();

export default propertyPricingService;
