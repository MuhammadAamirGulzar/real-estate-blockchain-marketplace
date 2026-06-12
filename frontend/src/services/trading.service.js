import api from "./api";

/**
 * Trading Service - Secondary Market
 *
 * On-chain mutations (createSellOrder, executeSellOrder/BuyOrder, cancelOrder)
 * are executed directly from the user's MetaMask wallet in useTrading hooks.
 * This service only handles the off-chain backend API calls.
 */
export const tradingService = {
  // ─── Public ──────────────────────────────────────────────────────

  /** List active on-chain orders for a property */
  getOrders: (propertyId) =>
    api.get("/trading/orders", { params: { propertyId } }).then((r) => r.data),

  /** Market statistics for a property (trade volume, last price) */
  getMarketData: (propertyId) =>
    api.get(`/trading/market/${propertyId}`).then((r) => r.data),

  // ─── Authenticated ────────────────────────────────────────────────

  /** User's own orders (DB listings + blockchain) */
  getUserOrders: () => api.get("/trading/user-orders").then((r) => r.data),

  /** User's trade purchase history */
  getTradingHistory: () => api.get("/trading/history").then((r) => r.data),

  /**
   * Record a new on-chain order in the DB after the tx is confirmed.
   * @param {{ propertyId, orderId, orderType, amount, pricePerToken, txHash }} data
   */
  recordOrder: (data) =>
    api.post("/trading/orders/record", data).then((r) => r.data),

  /**
   * Record a completed trade execution in the DB.
   * @param {{ listingId, amount, pricePerToken, totalPrice, txHash }} data
   */
  recordTrade: (data) =>
    api
      .post(
        `/trading/orders/${data.listingId || data.orderId}/record-trade`,
        data,
      )
      .then((r) => r.data),

  /**
   * Mark a listing as cancelled in the DB.
   * @param {number} listingId - DB secondaryMarketListings.id
   */
  recordCancel: (listingId) =>
    api.post(`/trading/orders/${listingId}/record-cancel`).then((r) => r.data),
};
