import { api } from "./api";

/**
 * Investment Service
 * Handles investments, purchases, and transactions
 */
export const investmentService = {
  /**
   * Create investment
   */
  createInvestment: async (data) => {
    try {
      const response = await api.post("/investment/create", {
        propertyId: data.propertyId,
        amount: data.amount,
        tokenAmount: data.tokenAmount,
        walletAddress: data.walletAddress,
        paymentMethod: data.paymentMethod,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get user investments
   */
  getUserInvestments: async () => {
    try {
      const response = await api.get("/investment/user");
      return response.data?.data || [];
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get investment details
   */
  getInvestment: async (investmentId) => {
    try {
      const response = await api.get(`/investment/${investmentId}`);
      return response.data?.data || null;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get investment history
   */
  getInvestmentHistory: async (limit = 50, offset = 0) => {
    try {
      const response = await api.get("/investment/history", {
        params: { limit, offset },
      });
      return response.data?.data || { investments: [], pagination: null };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Calculate investment returns
   */
  calculateReturns: async (propertyId, amount) => {
    try {
      const response = await api.post("/investment/calculate-returns", {
        propertyId,
        amount,
      });
      return response.data?.data || null;
    } catch (error) {
      throw error;
    }
  },
};
