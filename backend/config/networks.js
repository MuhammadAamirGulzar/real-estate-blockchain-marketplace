/**
 * Network Configuration for RWAChain
 *
 * Defines network-specific parameters for local, testnet, and mainnet deployments.
 * Used by web3Service, transactionManager, and other blockchain integration services.
 */

export const networks = {
  // Local Development (Anvil/Hardhat)
  local: {
    chainId: 31337,
    name: "localhost",
    rpcUrl: process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545",
    confirmations: 1, // Wait for 1 block confirmation
    gasMultiplier: 1.1, // 10% buffer for gas estimation
    blockTime: 1000, // ~1 second per block
    maxGasPrice: null, // No limit on local
    requireMultiSig: false,
    blockExplorer: "http://localhost:8545",
  },

  // Sepolia Testnet
  sepolia: {
    chainId: 11155111,
    name: "sepolia",
    rpcUrl: process.env.SEPOLIA_RPC_URL,
    confirmations: 3, // Wait for 3 blocks
    gasMultiplier: 1.2, // 20% buffer for testnet congestion
    blockTime: 12000, // ~12 seconds per block
    maxGasPrice: "50", // 50 gwei max
    requireMultiSig: false,
    blockExplorer: "https://sepolia.etherscan.io",
  },

  // Ethereum Mainnet
  mainnet: {
    chainId: 1,
    name: "mainnet",
    rpcUrl: process.env.MAINNET_RPC_URL,
    confirmations: 12, // Wait for 12 blocks (~3 min)
    gasMultiplier: 1.1, // 10% buffer
    blockTime: 12000, // ~12 seconds per block
    maxGasPrice: "100", // 100 gwei max (safety limit)
    requireMultiSig: true, // REQUIRED: All admin operations via multi-sig
    blockExplorer: "https://etherscan.io",
  },
};

/**
 * Get network configuration based on environment
 * @returns {Object} Network configuration
 */
export function getNetworkConfig() {
  const networkName = process.env.NETWORK || "local";
  const config = networks[networkName];

  if (!config) {
    throw new Error(
      `Invalid NETWORK="${networkName}". Must be one of: ${Object.keys(networks).join(", ")}`,
    );
  }

  // Validate RPC URL is set
  if (!config.rpcUrl) {
    throw new Error(
      `RPC URL not configured for network "${networkName}". Set ${networkName.toUpperCase()}_RPC_URL in .env`,
    );
  }

  return config;
}

/**
 * Validate network configuration on startup
 */
export function validateNetworkConfig() {
  const config = getNetworkConfig();
  const errors = [];

  // Check mainnet security requirements
  if (config.name === "mainnet") {
    const privateKey = process.env.MAINNET_PRIVATE_KEY;

    // Check for test private keys on mainnet
    const testKeys = [
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Hardhat #0
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // Hardhat #1
    ];

    if (testKeys.includes(privateKey)) {
      errors.push(
        "⛔ CRITICAL: Test private key detected on MAINNET. This will result in loss of funds!",
      );
    }

    if (!config.requireMultiSig) {
      errors.push(
        "⚠️ WARNING: Multi-sig is recommended for mainnet admin operations",
      );
    }
  }

  // Validate required env vars per network
  const requiredEnvVars = {
    local: ["LOCAL_RPC_URL"],
    sepolia: ["SEPOLIA_RPC_URL", "SEPOLIA_PRIVATE_KEY"],
    mainnet: ["MAINNET_RPC_URL", "MAINNET_PRIVATE_KEY"],
  };

  const required = requiredEnvVars[config.name] || [];
  for (const envVar of required) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Network configuration validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }

  console.log(
    `✓ Network configuration validated: ${config.name} (chainId: ${config.chainId})`,
  );
  return true;
}

export default networks;
