import api from "./api";

export const authService = {
  // Email/Password Authentication
  signup: async (email, password, firstName, lastName) => {
    const response = await api.post("/auth/signup", {
      email,
      password,
      firstName,
      lastName,
    });

    if (response.data.token) {
      localStorage.setItem("authToken", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
    }

    return response.data;
  },

  login: async (email, password) => {
    const response = await api.post("/auth/login", {
      email,
      password,
    });

    if (response.data.token) {
      localStorage.setItem("authToken", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
    }

    return response.data;
  },

  // Wallet Connection (for existing authenticated users)
  connectWallet: async (walletAddress, signature, message) => {
    const response = await api.post("/auth/connect-wallet", {
      walletAddress,
      signature,
      message,
    });

    if (response.data.user) {
      localStorage.setItem("user", JSON.stringify(response.data.user));
    }

    return response.data;
  },

  getNonce: async (walletAddress) => {
    const response = await api.post("/auth/nonce", { walletAddress });
    return response.data;
  },

  // Legacy wallet-only auth (for backward compatibility)
  verifyWallet: async (walletAddress, signature, message) => {
    const response = await api.post("/auth/verify-wallet", {
      walletAddress,
      signature,
      message,
    });

    if (response.data.token) {
      localStorage.setItem("authToken", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
    }

    return response.data;
  },

  disconnectWallet: async () => {
    const response = await api.post("/auth/disconnect-wallet");
    if (response.data.success) {
      const user = JSON.parse(localStorage.getItem("user") || '{}');
      user.isWalletConnected = false;
      user.walletAddress = null;
      localStorage.setItem("user", JSON.stringify(user));
    }
    return response.data;
  },

  getWalletAuthStatus: async () => {
    const response = await api.get("/auth/wallet-status");
    return response.data;
  },

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      localStorage.removeItem("walletConnected");
    }
  },

  getCurrentUser: async () => {
    const response = await api.get("/auth/me");
    return response.data.user;
  },
};

export async function getCurrentUser() {
  const response = await api.get("/auth/me");
  return response.data.user;
}
