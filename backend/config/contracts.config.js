/**
 * Contract Configuration Manager
 *
 * Loads contract addresses and ABIs based on network.
 * Validates all required contracts are deployed before allowing operations.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getNetworkConfig } from "./networks.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Required contracts for the RWAChain platform
 */
const REQUIRED_CONTRACTS = [
  "RoleManager",
  "KYCRegistry",
  "AssetRegistry",
  "PropertyNFT",
  "RWAToken",
  "InvestmentManager",
  "PriceOracle",
  "PaymentEscrow",
  "MultiTokenPayment",
  "SecondaryMarket",
  "RevenueDistributor",
];

/**
 * Load contract addresses for current network
 * @returns {Object} Contract addresses by contract name
 */
export function loadContractAddresses() {
  const network = getNetworkConfig();

  // Path to contract addresses file
  const addressesPath = path.join(
    __dirname,
    "..",
    "services",
    "web3",
    "addresses.json",
  );

  if (!fs.existsSync(addressesPath)) {
    throw new Error(
      `Contract addresses file not found at ${addressesPath}. Run deployment scripts first.`,
    );
  }

  let addressesData;
  try {
    const fileContent = fs.readFileSync(addressesPath, "utf8");
    addressesData = JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Failed to parse addresses.json: ${error.message}`);
  }

  // Get addresses for current chain ID
  const chainIdKey = network.chainId.toString();
  const addresses = addressesData[chainIdKey];

  if (!addresses) {
    throw new Error(
      `No contract addresses found for chainId ${network.chainId}. Available chains: ${Object.keys(addressesData).join(", ")}`,
    );
  }

  return addresses;
}

/**
 * Validate all required contracts are deployed
 * @throws {Error} If any required contract address is missing
 */
export function validateContractAddresses() {
  const addresses = loadContractAddresses();
  const missing = [];

  for (const contractName of REQUIRED_CONTRACTS) {
    if (!addresses[contractName] || addresses[contractName] === "") {
      missing.push(contractName);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing contract addresses for: ${missing.join(", ")}.\n` +
        `Please deploy these contracts and update addresses.json`,
    );
  }

  console.log(
    `✓ All ${REQUIRED_CONTRACTS.length} required contracts deployed and configured`,
  );
  return true;
}

/**
 * Get contract address by name
 * @param {string} contractName - Name of the contract
 * @returns {string} Contract address
 */
export function getContractAddress(contractName) {
  const addresses = loadContractAddresses();
  const address = addresses[contractName];

  if (!address) {
    throw new Error(`Contract "${contractName}" not found in addresses.json`);
  }

  return address;
}

/**
 * Get all contract addresses
 * @returns {Object} All contract addresses
 */
export function getAllContractAddresses() {
  return loadContractAddresses();
}

/**
 * Load contract ABI
 * @param {string} contractName - Name of the contract
 * @returns {Array} Contract ABI
 */
export function loadContractABI(contractName) {
  const abiPath = path.join(
    __dirname,
    "..",
    "services",
    "web3",
    "abi",
    `${contractName}.json`,
  );

  if (!fs.existsSync(abiPath)) {
    throw new Error(
      `ABI file not found for contract "${contractName}" at ${abiPath}. ` +
        `Run "forge build" and sync artifacts.`,
    );
  }

  try {
    const abiData = JSON.parse(fs.readFileSync(abiPath, "utf8"));
    return abiData.abi || abiData; // Handle both {abi: [...]} and [...] formats
  } catch (error) {
    throw new Error(
      `Failed to parse ABI for ${contractName}: ${error.message}`,
    );
  }
}

/**
 * Get contract configuration (address + ABI)
 * @param {string} contractName - Name of the contract
 * @returns {Object} { address, abi }
 */
export function getContractConfig(contractName) {
  return {
    address: getContractAddress(contractName),
    abi: loadContractABI(contractName),
  };
}

/**
 * Get all contract configurations
 * @returns {Object} All contracts with addresses and ABIs
 */
export function getAllContractConfigs() {
  const addresses = loadContractAddresses();
  const configs = {};

  for (const [contractName, address] of Object.entries(addresses)) {
    try {
      configs[contractName] = {
        address,
        abi: loadContractABI(contractName),
      };
    } catch (error) {
      console.warn(
        `⚠️ Could not load ABI for ${contractName}: ${error.message}`,
      );
    }
  }

  return configs;
}

/**
 * Initialize and validate contract configuration
 * Called on server startup
 */
export function initializeContractConfig() {
  try {
    const network = getNetworkConfig();
    console.log(
      `\n🔗 Initializing contract configuration for ${network.name}...`,
    );

    validateContractAddresses();

    const addresses = loadContractAddresses();
    console.log(
      `📜 Loaded ${Object.keys(addresses).length} contract addresses`,
    );

    // Log contract addresses for verification
    for (const [name, address] of Object.entries(addresses)) {
      console.log(`   ${name}: ${address}`);
    }

    return true;
  } catch (error) {
    console.error(`\n❌ Contract configuration initialization failed:`);
    console.error(`   ${error.message}\n`);
    throw error;
  }
}

export default {
  loadContractAddresses,
  validateContractAddresses,
  getContractAddress,
  getAllContractAddresses,
  loadContractABI,
  getContractConfig,
  getAllContractConfigs,
  initializeContractConfig,
  REQUIRED_CONTRACTS,
};
