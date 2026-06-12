import api from "@/services/api";

/**
 * Revenue Distribution API Service
 * Handles backend API calls for revenue distribution
 * Note: actual on-chain claim() must be executed from the frontend
 *       via WalletContext signer (ETH goes to msg.sender)
 */
export const revenueService = {
  // ─── Admin ──────────────────────────────────────────────────────

  /** Get all revenue distributions (admin) */
  getAllDistributions: () =>
    api.get("/revenue/admin/distributions").then((r) => r.data),

  /** Get tokenized properties with blockchain revenue stats for admin */
  getTokenizedPropertiesForRevenue: () =>
    api.get("/revenue/admin/properties").then((r) => r.data),

  /** Deposit revenue for a property (admin) */
  depositRevenue: ({ propertyId, amountEth, notes }) =>
    api
      .post("/revenue/admin/deposit", { propertyId, amountEth, notes })
      .then((r) => r.data),

  /** Get revenue history for specific property (admin) */
  getPropertyRevenueHistory: (propertyId) =>
    api
      .get(`/revenue/admin/property/${propertyId}/history`)
      .then((r) => r.data),

  /** Get live blockchain revenue info for a property */
  getAssetRevenueInfo: (propertyId) =>
    api
      .get(`/revenue/admin/property/${propertyId}/blockchain-info`)
      .then((r) => r.data),

  // ─── Investor ───────────────────────────────────────────────────

  /** Get claimable revenue for logged-in investor */
  getClaimableRevenue: () => api.get("/revenue/claimable").then((r) => r.data),

  /** Record a completed on-chain claim in the database */
  recordClaim: ({ propertyId, assetId, amountEth, txHash }) =>
    api
      .post("/revenue/record-claim", { propertyId, assetId, amountEth, txHash })
      .then((r) => r.data),

  /** Get user's revenue claim history */
  getClaimHistory: () => api.get("/revenue/history").then((r) => r.data),
};
