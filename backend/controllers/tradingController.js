import { secondaryMarketService } from "../services/secondaryMarketService.js";

/** Recursively convert BigInt values to strings for JSON serialization */
function serializeBigInt(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, serializeBigInt(v)]),
    );
  }
  return obj;
}

/**
 * GET /api/trading/orders?propertyId=X
 * List all active on-chain orders for a property
 */
export const getOrdersHandler = async (req, res) => {
  try {
    const { propertyId } = req.query;
    if (!propertyId) {
      return res
        .status(400)
        .json({ success: false, message: "propertyId is required" });
    }

    const result = await secondaryMarketService.getPropertyOrders(
      parseInt(propertyId),
    );
    return res.json({ success: true, data: serializeBigInt(result) });
  } catch (error) {
    console.error("getOrdersHandler error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/trading/user-orders
 * Get the logged-in user's orders from blockchain + DB listings
 */
export const getUserOrdersHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    const walletAddress = req.user.walletAddress;

    const [dbListings, chainOrders] = await Promise.allSettled([
      secondaryMarketService.getUserListings(userId),
      walletAddress
        ? secondaryMarketService.getUserOrdersFromBlockchain(walletAddress)
        : Promise.resolve([]),
    ]);

    return res.json({
      success: true,
      data: {
        dbListings: serializeBigInt(
          dbListings.status === "fulfilled" ? dbListings.value : [],
        ),
        chainOrders: serializeBigInt(
          chainOrders.status === "fulfilled" ? chainOrders.value : [],
        ),
      },
    });
  } catch (error) {
    console.error("getUserOrdersHandler error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/trading/orders/record
 * Record a newly created on-chain order in the DB.
 * Called by frontend AFTER the blockchain tx is confirmed.
 */
export const recordOrderHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    const walletAddress = req.user.walletAddress;
    const { propertyId, orderId, orderType, amount, pricePerToken, txHash } =
      req.body;

    if (
      !propertyId ||
      !orderId ||
      !orderType ||
      !amount ||
      !pricePerToken ||
      !txHash
    ) {
      return res.status(400).json({
        success: false,
        message:
          "propertyId, orderId, orderType, amount, pricePerToken and txHash are required",
      });
    }

    const listing = await secondaryMarketService.recordOrderInDB({
      userId,
      walletAddress,
      propertyId: parseInt(propertyId),
      orderId: orderId.toString(),
      orderType,
      amount: amount.toString(),
      pricePerToken: pricePerToken.toString(),
      txHash,
    });

    return res.status(201).json({ success: true, data: listing });
  } catch (error) {
    console.error("recordOrderHandler error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/trading/orders/:orderId/record-trade
 * Record a completed trade in DB after on-chain execution.
 */
export const recordTradeHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    const { listingId, amount, pricePerToken, totalPrice, txHash } = req.body;
    const resolvedListingId = listingId || req.params.orderId;

    if (
      !resolvedListingId ||
      !amount ||
      !pricePerToken ||
      !totalPrice ||
      !txHash
    ) {
      return res.status(400).json({
        success: false,
        message:
          "listingId, amount, pricePerToken, totalPrice and txHash are required",
      });
    }

    const trade = await secondaryMarketService.recordTradeInDB({
      buyerId: userId,
      listingId: parseInt(resolvedListingId),
      amount: amount.toString(),
      pricePerToken: pricePerToken.toString(),
      totalPrice: totalPrice.toString(),
      txHash,
    });

    return res.status(201).json({ success: true, data: trade });
  } catch (error) {
    console.error("recordTradeHandler error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/trading/orders/:listingId/record-cancel
 * Mark a DB listing as cancelled after on-chain cancelOrder().
 */
export const recordCancelHandler = async (req, res) => {
  try {
    const { listingId } = req.params;
    await secondaryMarketService.recordCancelInDB(parseInt(listingId));
    return res.json({ success: true, message: "Listing marked as cancelled" });
  } catch (error) {
    console.error("recordCancelHandler error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/trading/history
 * Logged-in user's trade history (as buyer) from DB
 */
export const getTradingHistoryHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    const history = await secondaryMarketService.getUserTradeHistory(userId);
    return res.json({ success: true, data: history });
  } catch (error) {
    console.error("getTradingHistoryHandler error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/trading/market/:propertyId
 * Market stats (volume, last price, recent trades) for a property
 */
export const getMarketDataHandler = async (req, res) => {
  try {
    const propertyId = parseInt(req.params.propertyId);
    const stats = await secondaryMarketService.getMarketStats(propertyId);
    return res.json({ success: true, data: stats });
  } catch (error) {
    console.error("getMarketDataHandler error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Legacy aliases kept for backward compatibility ──────────────────────────

/** @deprecated use getOrdersHandler */
export const getTradingOffers = getOrdersHandler;

/** @deprecated order creation is on-chain only via frontend */
export const createTradingOffer = async (_req, res) =>
  res.status(410).json({
    success: false,
    message:
      "Deprecated. Create the order on-chain from the frontend, then POST /trading/orders/record.",
  });

/** @deprecated trade execution is on-chain only via frontend */
export const buyTradingOffer = async (_req, res) =>
  res.status(410).json({
    success: false,
    message:
      "Deprecated. Execute the order on-chain from the frontend, then POST /trading/orders/:id/record-trade.",
  });

/** @deprecated use recordCancelHandler */
export const cancelTradingOffer = recordCancelHandler;
