import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { properties } from "../db/schema.js";
import revenueDistributionService from "../services/revenueDistributionService.js";

const serializeBigInt = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return obj.toString();
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === "object") {
    const out = {};
    for (const key in obj) {
      if (Object.hasOwn(obj, key)) out[key] = serializeBigInt(obj[key]);
    }
    return out;
  }
  return obj;
};

// ─────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/revenue/admin/distributions
 * List all revenue distributions (admin view)
 */
export const getAllDistributionsHandler = async (req, res) => {
  try {
    const distributions =
      await revenueDistributionService.getAllRevenueDistributions();
    res.json({ success: true, data: serializeBigInt(distributions) });
  } catch (error) {
    console.error("Get distributions error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/revenue/admin/properties
 * List tokenized properties with their blockchain revenue stats for admin deposit UI
 */
export const getTokenizedPropertiesForRevenueHandler = async (req, res) => {
  try {
    const tokenizedProps = await db
      .select({
        id: properties.id,
        title: properties.title,
        location: properties.location,
        assetRegistryId: properties.assetRegistryId,
        nftTokenId: properties.nftTokenId,
        fractionalTokenAddress: properties.fractionalTokenAddress,
        status: properties.status,
      })
      .from(properties)
      .where(eq(properties.status, "tokenized"));

    // Enrich with blockchain revenue info
    const enriched = await Promise.all(
      tokenizedProps.map(async (prop) => {
        let revenueInfo = null;
        if (prop.assetRegistryId) {
          try {
            revenueInfo = await revenueDistributionService.getAssetRevenueInfo(
              prop.assetRegistryId,
            );
          } catch {
            /* contract may not have data for this asset yet */
          }
        }
        return { ...prop, revenueInfo };
      }),
    );

    res.json({ success: true, data: serializeBigInt(enriched) });
  } catch (error) {
    console.error("Get tokenized properties for revenue error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/revenue/admin/deposit
 * Admin deposits ETH revenue for a property
 */
export const depositRevenueHandler = async (req, res) => {
  try {
    const { propertyId, amountEth, notes } = req.body;
    const adminUserId = req.user.id;

    if (!propertyId || !amountEth) {
      return res.status(400).json({
        success: false,
        message: "propertyId and amountEth are required",
      });
    }

    if (parseFloat(amountEth) <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Amount must be greater than 0" });
    }

    console.log(
      `💰 Admin ${req.user.email} depositing ${amountEth} ETH for property ${propertyId}`,
    );

    const result = await revenueDistributionService.depositRevenue({
      propertyId: parseInt(propertyId),
      amountEth,
      adminUserId,
      description: notes,
    });

    res.json({
      success: true,
      message: `Revenue of ${amountEth} ETH deposited successfully`,
      data: serializeBigInt(result),
    });
  } catch (error) {
    console.error("Deposit revenue error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/revenue/admin/property/:propertyId/history
 * Revenue distribution history for a specific property (admin)
 */
export const getPropertyRevenueHistoryAdminHandler = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const history = await revenueDistributionService.getPropertyRevenueHistory(
      parseInt(propertyId),
    );
    res.json({ success: true, data: serializeBigInt(history) });
  } catch (error) {
    console.error("Get property revenue history error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/revenue/admin/property/:propertyId/blockchain-info
 * Live blockchain revenue info for a property
 */
export const getAssetRevenueInfoHandler = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, parseInt(propertyId)));

    if (!property || !property.assetRegistryId) {
      return res.status(404).json({
        success: false,
        message: "Property not found or not registered on blockchain",
      });
    }

    const info = await revenueDistributionService.getAssetRevenueInfo(
      property.assetRegistryId,
    );
    res.json({ success: true, data: serializeBigInt(info) });
  } catch (error) {
    console.error("Get asset revenue info error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// INVESTOR ENDPOINTS
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/revenue/claimable
 * Get claimable revenue amounts for the authenticated investor
 */
export const getClaimableRevenueHandler = async (req, res) => {
  try {
    const walletAddress = req.user.walletAddress;
    const userId = req.user.id;

    if (!walletAddress) {
      return res.json({
        success: true,
        data: { properties: [], totalClaimable: "0" },
      });
    }

    const result = await revenueDistributionService.getUserClaimableRevenue(
      userId,
      walletAddress,
    );

    res.json({ success: true, data: serializeBigInt(result) });
  } catch (error) {
    console.error("Get claimable revenue error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/revenue/record-claim
 * Record a completed on-chain claim in the database
 * Called by frontend after a successful blockchain transaction
 */
export const recordClaimHandler = async (req, res) => {
  try {
    const { propertyId, assetId, amountEth, txHash } = req.body;
    const userId = req.user.id;

    if (!propertyId || !txHash) {
      return res.status(400).json({
        success: false,
        message: "propertyId and txHash are required",
      });
    }

    const result = await revenueDistributionService.recordClaim({
      userId,
      propertyId: parseInt(propertyId),
      assetId,
      amountEth: amountEth || "0",
      txHash,
    });

    res.json({ success: true, message: "Claim recorded", data: result });
  } catch (error) {
    console.error("Record claim error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/revenue/history
 * Get user's revenue claim history
 */
export const getClaimHistoryHandler = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user's revenue shares joined with distributions and properties
    const history = await db.execute(
      `SELECT rs.id, rs."share_amount", rs."tokens_held", rs."created_at",
              rd."distribution_date", rd."transaction_hash", rd."status",
              p."title" as "property_title", p."location" as "property_location"
       FROM revenue_shares rs
       JOIN revenue_distributions rd ON rs."distribution_id" = rd.id
       JOIN properties p ON rd."property_id" = p.id
       WHERE rs."investor_id" = ${userId}
       ORDER BY rs."created_at" DESC`,
    );

    res.json({ success: true, data: serializeBigInt(history.rows || []) });
  } catch (error) {
    console.error("Get claim history error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
