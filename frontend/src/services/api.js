import { config, validateConfig } from "@/config/environment";
import axios from "axios";
import { toast } from "sonner";

// Validate config on load
validateConfig();

/**
 * API Service
 * Centralized axios instance with interceptors for auth, error handling, and logging
 */
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

console.log(`🔗 API Base URL: ${config.api.baseUrl}`);
console.log(`🌐 Environment: ${config.environment}`);

// Routes that intentionally require no auth token (public endpoints)
const PUBLIC_ROUTES = [
  /^\/properties(\?.*)?$/, // GET /properties (with optional query params)
  /^\/properties\/[^/]+(\?.*)?$/, // GET /properties/:id
  /^\/auth\/login$/,
  /^\/auth\/register$/,
  /^\/auth\/refresh$/,
];

/**
 * Request Interceptor
 * Adds auth token and handles request preparation
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
    const walletAddress = localStorage.getItem("walletConnected");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      if (import.meta.env.DEV) {
        console.log(`🔑 Token attached: ${token.substring(0, 20)}...`);
      }
    } else {
      const isPublic = PUBLIC_ROUTES.some((r) => r.test(config.url));
      if (import.meta.env.DEV && !isPublic) {
        console.warn(`⚠️ No token found for ${config.url}`);
      }
    }

    if (walletAddress) {
      config.headers["X-Wallet-Address"] = walletAddress;
    }

    if (import.meta.env.DEV) {
      console.log(`📤 ${config.method.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => {
    console.error("❌ Request Error:", error);
    return Promise.reject(error);
  },
);

/**
 * Response Interceptor
 * Handles errors globally and logs responses
 */
api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log(`✅ ${response.status} ${response.statusText}`);
    }
    return response;
  },
  (error) => {
    if (error.response) {
      // Handle specific error status codes
      switch (error.response.status) {
        case 401:
          // Unauthorized
          // Do NOT force redirect for wallet endpoints; surface error instead
          {
            const reqUrl = error.config?.url || "";
            const isWalletFlow =
              reqUrl.includes("/user/wallet/") || reqUrl.includes("/auth/me");
            if (isWalletFlow) {
              console.warn("401 on wallet/auth flow; keeping session for UX");
            } else {
              // Show toast notification before redirect
              toast.error("Session expired", {
                description: "Please log in again to continue",
              });

              localStorage.removeItem("authToken");
              localStorage.removeItem("user");

              // Small delay to ensure toast is visible
              setTimeout(() => {
                if (window.location.pathname !== "/login") {
                  window.location.href = "/login";
                }
              }, 500);
            }
          }
          break;
        case 403:
          // Forbidden - insufficient permissions
          console.error("Insufficient permissions");
          toast.error("Access Denied", {
            description: "You don't have permission to perform this action",
          });
          break;
        case 404:
          // Not found
          console.error("Resource not found");
          break;
        case 500:
          // Server error
          console.error("Server error");
          toast.error("Server Error", {
            description:
              "Something went wrong on our end. Please try again later",
          });
          break;
        default:
          console.error("API error:", error.response.status);
      }
    } else if (error.request) {
      // Request was made but no response received
      console.error("No response from server");
      toast.error("Connection Error", {
        description: "Unable to reach the server. Please check your connection",
      });
    } else {
      // Something else happened
      console.error("Error:", error.message);
    }
    return Promise.reject(error);
  },
);

/**
 * Format error message for user display
 */
function formatErrorMessage(error) {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.code === "ECONNREFUSED") {
    return `Cannot connect to server at ${config.api.baseUrl}. Please ensure backend is running.`;
  }

  if (error.code === "ENOTFOUND") {
    return `Server not found. Check your API URL: ${config.api.baseUrl}`;
  }

  if (error.code === "ETIMEDOUT") {
    return "Request timeout. The server is taking too long to respond.";
  }

  if (!error.response) {
    return "Network error. Check your internet connection and server status.";
  }

  switch (error.response.status) {
    case 400:
      return "Invalid request. Please check your input.";
    case 401:
      return "Unauthorized. Please log in again.";
    case 403:
      return "Forbidden. You don't have permission to access this resource.";
    case 404:
      return "Resource not found.";
    case 500:
      return "Server error. Please try again later.";
    default:
      return error.message || "An error occurred. Please try again.";
  }
}

// Portfolio API functions
export const getPortfolioStats = async () => {
  const response = await api.get("/portfolio/stats");
  return response.data;
};

// KYC API functions
export const getKycSubmissions = async () => {
  try {
    const response = await api.get("/kyc/submissions");
    return response.data;
  } catch (error) {
    console.warn("KYC submissions not available");
    return { data: {} };
  }
};

// Properties API functions
export const getProperties = async (status = null) => {
  const params = status ? `?status=${status}` : "";
  const response = await api.get(`/properties${params}`);
  return response.data;
};

export const getProperty = async (id) => {
  const response = await api.get(`/properties/${id}`);
  return response.data;
};

// Investment API functions
export const createInvestment = async (investmentData) => {
  const response = await api.post("/investment/create", investmentData);
  return response.data;
};

export const getUserInvestments = async () => {
  const response = await api.get("/investments/user");
  return response.data;
};

// Property listing (submit new property with documents)
export const listProperty = async (formData) => {
  const response = await api.post("/properties", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

// Verifier API functions
export const getVerifierProperties = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const response = await api.get(
    `/verifier/assigned-properties${params ? `?${params}` : ""}`,
  );
  return response.data;
};

export const verifyProperty = async (propertyId, verificationData) => {
  const response = await api.post(
    `/verifier/property/${propertyId}/approve`,
    verificationData,
  );
  return response.data;
};

export const rejectPropertyVerification = async (propertyId, reason) => {
  const response = await api.post(`/verifier/property/${propertyId}/reject`, {
    reason,
  });
  return response.data;
};

// Default export for direct import
export default api;

// Named export for compatibility
export { api };

