/**
 * Unified Environment Configuration
 * Works for both frontend and backend
 */

// Import deployed contract addresses
import addressesData from "./addresses.json";

const ENV = import.meta.env;

// Load contract addresses for current chain
const chainId = parseInt(ENV.VITE_CHAIN_ID) || 31337;
const deployedAddresses = addressesData[chainId.toString()] || {};

export const config = {
  // API Configuration
  api: {
    baseUrl: ENV.VITE_API_URL || "http://localhost:3001/api",
    timeout: 15000,
  },

  // Blockchain Configuration
  blockchain: {
    rpcUrl: ENV.VITE_RPC_URL || "http://127.0.0.1:8545",
    chainId: chainId,
  },

  // Smart Contract Addresses (from deployed contracts or env vars)
  contracts: {
    roleManager:
      ENV.VITE_ROLE_MANAGER_ADDRESS || deployedAddresses.RoleManager || "",
    kycRegistry:
      ENV.VITE_KYC_REGISTRY_ADDRESS || deployedAddresses.KYCRegistry || "",
    assetRegistry:
      ENV.VITE_ASSET_REGISTRY_ADDRESS || deployedAddresses.AssetRegistry || "",
    rwaToken: ENV.VITE_RWA_TOKEN_ADDRESS || deployedAddresses.RWAToken || "",
    propertyNft:
      ENV.VITE_PROPERTY_NFT_ADDRESS || deployedAddresses.PropertyNFT || "",
    investmentManager:
      ENV.VITE_INVESTMENT_MANAGER_ADDRESS ||
      deployedAddresses.InvestmentManager ||
      "",
    secondaryMarket:
      ENV.VITE_SECONDARY_MARKET_ADDRESS ||
      deployedAddresses.SecondaryMarket ||
      "",
    revenueDistributor:
      ENV.VITE_REVENUE_DISTRIBUTOR_ADDRESS ||
      deployedAddresses.RevenueDistributor ||
      "",
    priceOracle:
      ENV.VITE_PRICE_ORACLE_ADDRESS || deployedAddresses.PriceOracle || "",
    paymentEscrow:
      ENV.VITE_PAYMENT_ESCROW_ADDRESS || deployedAddresses.PaymentEscrow || "",
    multiTokenPayment:
      ENV.VITE_MULTI_TOKEN_PAYMENT_ADDRESS ||
      deployedAddresses.MultiTokenPayment ||
      "",
  },

  // Wallet Configuration
  wallet: {
    required: ENV.VITE_WALLET_REQUIRED === "true",
    walletConnectProjectId: ENV.VITE_WALLETCONNECT_PROJECT_ID || "",
  },

  // IPFS Configuration
  ipfs: {
    host: ENV.VITE_IPFS_HOST || "ipfs.pinata.cloud",
    port: ENV.VITE_IPFS_PORT || 5001,
    protocol: ENV.VITE_IPFS_PROTOCOL || "https",
  },

  // Feature Flags
  features: {
    mockData: ENV.VITE_ENABLE_MOCK_DATA === "true",
    devTools: ENV.DEV,
  },

  // Environment
  environment: ENV.MODE || "development",
  isDev: ENV.DEV,
  isProd: ENV.PROD,
};

/**
 * Validate configuration on load
 */
export function validateConfig() {
  const errors = [];
  const warnings = [];

  if (!config.api.baseUrl) {
    errors.push("API Base URL is not configured");
  }

  if (!config.blockchain.rpcUrl) {
    errors.push("Blockchain RPC URL is not configured");
  }

  // Check contract addresses - critical in production
  const requiredContracts = [
    "roleManager",
    "kycRegistry",
    "assetRegistry",
    "rwaToken",
    "propertyNft",
  ];

  requiredContracts.forEach((contract) => {
    if (!config.contracts[contract] || config.contracts[contract] === "") {
      const message = `Contract address for ${contract} is not configured`;
      if (config.isProd) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    }
  });

  // Warn about optional contracts
  if (!config.contracts.investmentManager) {
    warnings.push("InvestmentManager contract address not configured");
  }

  if (!config.contracts.secondaryMarket) {
    warnings.push("SecondaryMarket contract address not configured");
  }

  // Warn about WalletConnect project ID
  if (!config.wallet.walletConnectProjectId) {
    warnings.push(
      "WalletConnect Project ID not configured - WalletConnect won't work",
    );
  }

  // Log warnings in development (only show once)
  if (warnings.length > 0 && config.isDev) {
    const warningKey = "config_warnings_shown";
    if (!sessionStorage.getItem(warningKey)) {
      console.warn("⚠️ Configuration Warnings (shown once per session):");
      warnings.forEach((warning) => console.warn(`  - ${warning}`));
      sessionStorage.setItem(warningKey, "true");
    }
  }

  // Handle errors
  if (errors.length > 0) {
    console.error("❌ Configuration Errors:");
    errors.forEach((error) => console.error(`  - ${error}`));

    if (config.isProd) {
      throw new Error(
        "Configuration validation failed. Please check environment variables.",
      );
    }
    return false;
  }

  // Only log success if there were issues to report
  if (config.isDev && (errors.length > 0 || warnings.length > 0)) {
    console.log("✅ Configuration validation complete");
  }
  return true;
}

/**
 * Log configuration (safe - no sensitive data)
 */
export function logConfig() {
  console.log("🔧 RWA Platform Configuration:");
  console.log(`  Environment: ${config.environment}`);
  console.log(`  API: ${config.api.baseUrl}`);
  console.log(`  RPC: ${config.blockchain.rpcUrl}`);
  console.log(`  Contracts loaded: ${Object.keys(config.contracts).length}`);
}
