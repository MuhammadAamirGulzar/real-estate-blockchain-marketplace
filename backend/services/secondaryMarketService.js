import { desc, eq } from "drizzle-orm";
import { ethers } from "ethers";
import { db } from "../db/connection.js";
import {
  fractionalTokens,
  properties,
  secondaryMarketListings,
  secondaryMarketTrades,
  users,
} from "../db/schema.js";
import { web3Service } from "./web3Service.js";

/**
 * @title SecondaryMarketService
 * @notice Service layer for the SecondaryMarket contract
 *
 * Architecture:
 *  - ALL on-chain writes (createSellOrder, executeSellOrder/BuyOrder, cancelOrder)
 *    are executed directly from the investor's MetaMask wallet in the frontend.
 *  - Backend reads blockchain state for order listings display.
 *  - Backend records post-tx DB entries for history/portfolio tracking.
 *
 * Price/Amount scaling in SecondaryMarket.sol:
 *   totalPrice = (tokenAmount * pricePerToken) / 1e18
 *   so pricePerToken is stored in Wei-per-token (scaled by 1e18)
 */
class SecondaryMarketService {
  // ─── Contract Access ──────────────────────────────────────────────

  getContract() {
    if (!web3Service.initialized) {
      throw new Error("Web3Service not initialized");
    }
    const contract = web3Service.contracts.SecondaryMarket;
    if (!contract) {
      throw new Error("SecondaryMarket contract not available");
    }
    return contract;
  }

  // ─── BigInt serializer ────────────────────────────────────────────

  serializeBigInt(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "bigint") return obj.toString();
    if (Array.isArray(obj)) return obj.map((v) => this.serializeBigInt(v));
    if (typeof obj === "object") {
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, this.serializeBigInt(v)]),
      );
    }
    return obj;
  }

  // ─── Blockchain Reads ──────────────────────────────────────────────

  /**
   * Map a raw contract Order struct to a plain JS object
   */
  _formatOrder(raw) {
    return {
      orderId: raw.orderId.toString(),
      trader: raw.trader,
      assetId: raw.assetId.toString(),
      tokenAmount: raw.tokenAmount.toString(),
      pricePerToken: raw.pricePerToken.toString(),
      // Human-readable ETH price (priced per 1e18 token units)
      pricePerTokenEth: ethers.formatEther(raw.pricePerToken),
      orderType: Number(raw.orderType) === 0 ? "SELL" : "BUY",
      status:
        ["ACTIVE", "CANCELLED", "COMPLETED", "EXPIRED"][Number(raw.status)] ||
        "UNKNOWN",
      createdAt: new Date(Number(raw.createdAt) * 1000).toISOString(),
      expiresAt: new Date(Number(raw.expiresAt) * 1000).toISOString(),
      filledAmount: raw.filledAmount.toString(),
      remainingAmount: (raw.tokenAmount - raw.filledAmount).toString(),
      isActive: raw.isActive && BigInt(Date.now()) / 1000n <= raw.expiresAt,
    };
  }

  /**
   * Fetch all active orders for a given asset ID from the contract
   */
  async getActiveOrdersForAsset(assetId) {
    const contract = this.getContract();
    const orderIds = await contract.getActiveOrders(BigInt(assetId));
    if (!orderIds.length) return [];

    const orders = await Promise.all(
      orderIds.map(async (id) => {
        const raw = await contract.getOrder(id);
        return this._formatOrder(raw);
      }),
    );

    return orders.filter((o) => o.isActive);
  }

  /**
   * Fetch a single order detail
   */
  async getOrder(orderId) {
    const contract = this.getContract();
    const raw = await contract.getOrder(BigInt(orderId));
    return this._formatOrder(raw);
  }

  /**
   * Fetch all order IDs for a user address, then load each order
   */
  async getUserOrdersFromBlockchain(walletAddress) {
    const contract = this.getContract();
    const orderIds = await contract.getUserOrders(walletAddress);
    if (!orderIds.length) return [];

    const orders = await Promise.all(
      orderIds.map(async (id) => {
        const raw = await contract.getOrder(id);
        return this._formatOrder(raw);
      }),
    );

    return orders;
  }

  // ─── DB Writes (record post-transaction results) ──────────────────

  /**
   * Record a newly created sell/buy order listing in DB after on-chain tx.
   *
   * @param {object} params
   * @param {number}  params.userId         - DB user id
   * @param {string}  params.walletAddress  - seller/buyer wallet
   * @param {number}  params.propertyId     - DB property id
   * @param {string}  params.orderId        - on-chain orderId
   * @param {string}  params.orderType      - "SELL" | "BUY"
   * @param {string}  params.amount         - token amount (in units of 1e18)
   * @param {string}  params.pricePerToken  - Wei-per-token
   * @param {string}  params.txHash
   */
  async recordOrderInDB({
    userId,
    walletAddress,
    propertyId,
    orderId,
    orderType,
    amount,
    pricePerToken,
    txHash,
  }) {
    // Resolve fractionalTokenId from property
    const [prop] = await db
      .select({
        id: properties.id,
        assetRegistryId: properties.assetRegistryId,
      })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (!prop) throw new Error(`Property ${propertyId} not found`);

    const [ftRow] = await db
      .select({ id: fractionalTokens.id })
      .from(fractionalTokens)
      .where(eq(fractionalTokens.propertyId, propertyId))
      .limit(1);

    if (!ftRow)
      throw new Error(`No fractional token found for property ${propertyId}`);

    const [listing] = await db
      .insert(secondaryMarketListings)
      .values({
        sellerId: userId,
        fractionalTokenId: ftRow.id,
        amount: amount,
        pricePerToken: pricePerToken,
        status: "active",
        listingMessage: `orderId:${orderId};type:${orderType};txHash:${txHash}`,
      })
      .returning();

    return listing;
  }

  /**
   * Record a completed trade after on-chain executeSellOrder/executeBuyOrder.
   *
   * @param {object} params
   * @param {number}  params.buyerId        - DB user id of buyer
   * @param {number}  params.propertyId     - DB property id
   * @param {number}  params.listingId      - secondaryMarketListings.id (from recordOrderInDB)
   * @param {string}  params.amount         - token amount traded
   * @param {string}  params.pricePerToken  - Wei-per-token
   * @param {string}  params.totalPrice     - total ETH (Wei)
   * @param {string}  params.txHash
   */
  async recordTradeInDB({
    buyerId,
    listingId,
    amount,
    pricePerToken,
    totalPrice,
    txHash,
  }) {
    const [trade] = await db
      .insert(secondaryMarketTrades)
      .values({
        listingId,
        buyerId,
        amount,
        pricePerToken,
        totalPrice,
        transactionHash: txHash,
        tradeMessage: `txHash:${txHash}`,
      })
      .returning();

    // Mark listing as sold when fully traded
    await db
      .update(secondaryMarketListings)
      .set({ status: "sold", soldAt: new Date() })
      .where(eq(secondaryMarketListings.id, listingId));

    return trade;
  }

  /**
   * Mark a listing as cancelled in DB after on-chain cancelOrder.
   */
  async recordCancelInDB(listingId) {
    await db
      .update(secondaryMarketListings)
      .set({ status: "cancelled" })
      .where(eq(secondaryMarketListings.id, listingId));
  }

  // ─── Enriched Data Queries ────────────────────────────────────────

  /**
   * Build order list for a property, enriching on-chain orders with DB user data.
   * Falls back gracefully if contract not reachable.
   */
  async getPropertyOrders(propertyId) {
    const [prop] = await db
      .select({
        assetRegistryId: properties.assetRegistryId,
        title: properties.title,
      })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (!prop) throw new Error(`Property ${propertyId} not found`);
    if (!prop.assetRegistryId) {
      return { orders: [], propertyTitle: prop.title, assetId: null };
    }

    let orders = [];
    try {
      orders = await this.getActiveOrdersForAsset(prop.assetRegistryId);
    } catch (err) {
      console.warn(`⚠️  Could not read SecondaryMarket orders: ${err.message}`);
    }

    // Add property title to each order
    return {
      orders: orders.map((o) => ({ ...o, propertyTitle: prop.title })),
      propertyTitle: prop.title,
      assetId: prop.assetRegistryId?.toString(),
    };
  }

  /**
   * Get all listings for a user (DB + enriched with token/property info)
   */
  async getUserListings(userId) {
    const rows = await db
      .select({
        id: secondaryMarketListings.id,
        sellerId: secondaryMarketListings.sellerId,
        fractionalTokenId: secondaryMarketListings.fractionalTokenId,
        amount: secondaryMarketListings.amount,
        pricePerToken: secondaryMarketListings.pricePerToken,
        status: secondaryMarketListings.status,
        listedAt: secondaryMarketListings.listedAt,
        soldAt: secondaryMarketListings.soldAt,
        listingMessage: secondaryMarketListings.listingMessage,
        propertyId: properties.id,
        propertyTitle: properties.title,
        assetRegistryId: properties.assetRegistryId,
      })
      .from(secondaryMarketListings)
      .leftJoin(
        fractionalTokens,
        eq(secondaryMarketListings.fractionalTokenId, fractionalTokens.id),
      )
      .leftJoin(properties, eq(fractionalTokens.propertyId, properties.id))
      .where(eq(secondaryMarketListings.sellerId, userId))
      .orderBy(desc(secondaryMarketListings.listedAt));

    return rows;
  }

  /**
   * Get trading history for a user (as buyer)
   */
  async getUserTradeHistory(userId) {
    const rows = await db
      .select({
        id: secondaryMarketTrades.id,
        listingId: secondaryMarketTrades.listingId,
        buyerId: secondaryMarketTrades.buyerId,
        amount: secondaryMarketTrades.amount,
        pricePerToken: secondaryMarketTrades.pricePerToken,
        totalPrice: secondaryMarketTrades.totalPrice,
        transactionHash: secondaryMarketTrades.transactionHash,
        tradedAt: secondaryMarketTrades.tradedAt,
        propertyId: properties.id,
        propertyTitle: properties.title,
        sellerWallet: users.walletAddress,
      })
      .from(secondaryMarketTrades)
      .leftJoin(
        secondaryMarketListings,
        eq(secondaryMarketTrades.listingId, secondaryMarketListings.id),
      )
      .leftJoin(
        fractionalTokens,
        eq(secondaryMarketListings.fractionalTokenId, fractionalTokens.id),
      )
      .leftJoin(properties, eq(fractionalTokens.propertyId, properties.id))
      .leftJoin(users, eq(secondaryMarketListings.sellerId, users.id))
      .where(eq(secondaryMarketTrades.buyerId, userId))
      .orderBy(desc(secondaryMarketTrades.tradedAt));

    return rows;
  }

  /**
   * Market stats for a property (from DB trades)
   */
  async getMarketStats(propertyId) {
    const trades = await db
      .select({
        amount: secondaryMarketTrades.amount,
        totalPrice: secondaryMarketTrades.totalPrice,
        pricePerToken: secondaryMarketTrades.pricePerToken,
        tradedAt: secondaryMarketTrades.tradedAt,
      })
      .from(secondaryMarketTrades)
      .leftJoin(
        secondaryMarketListings,
        eq(secondaryMarketTrades.listingId, secondaryMarketListings.id),
      )
      .leftJoin(
        fractionalTokens,
        eq(secondaryMarketListings.fractionalTokenId, fractionalTokens.id),
      )
      .leftJoin(properties, eq(fractionalTokens.propertyId, properties.id))
      .where(eq(properties.id, propertyId))
      .orderBy(desc(secondaryMarketTrades.tradedAt));

    const tradeCount = trades.length;
    const totalVolume = trades.reduce(
      (sum, t) => sum + parseFloat(t.totalPrice || 0),
      0,
    );
    const lastPrice =
      tradeCount > 0 ? parseFloat(trades[0].pricePerToken || 0) : null;

    return {
      tradeCount,
      totalVolumeEth: totalVolume.toFixed(6),
      lastPriceWei: lastPrice ? lastPrice.toString() : null,
      lastPriceEth: lastPrice
        ? ethers.formatEther(BigInt(Math.round(lastPrice)))
        : null,
      recentTrades: trades.slice(0, 10),
    };
  }
}

export const secondaryMarketService = new SecondaryMarketService();
