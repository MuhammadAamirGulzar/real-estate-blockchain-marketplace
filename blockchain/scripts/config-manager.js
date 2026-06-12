#!/usr/bin/env node
/**
 * Contract Configuration Manager
 *
 * This script reads Foundry deployment broadcast files and generates
 * a unified configuration file with contract addresses for all networks.
 *
 * Usage: node scripts/config-manager.js [chainId]
 *
 * If chainId is not provided, processes all available deployments.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project paths
const BLOCKCHAIN_DIR = path.join(__dirname, "..");
const BROADCAST_DIR = path.join(BLOCKCHAIN_DIR, "broadcast");
const BACKEND_DIR = path.join(BLOCKCHAIN_DIR, "..", "backend");
const ADDRESSES_OUTPUT = path.join(
  BACKEND_DIR,
  "services",
  "web3",
  "addresses.json",
);

// List of contracts to extract
const CONTRACTS = [
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
  "FractionalPropertyToken", // Factory, not all deployments
];

/**
 * Find the latest deployment broadcast file for a contract
 */
function findLatestBroadcast(contractName) {
  const contractBroadcastDir = path.join(
    BROADCAST_DIR,
    `Deploy${contractName}.s.sol`,
  );

  if (!fs.existsSync(contractBroadcastDir)) {
    return null;
  }

  // Find all chain ID directories
  const chainDirs = fs
    .readdirSync(contractBroadcastDir)
    .filter((dir) => /^\d+$/.test(dir)); // Only numeric directories (chain IDs)

  if (chainDirs.length === 0) {
    return null;
  }

  const broadcasts = {};

  for (const chainId of chainDirs) {
    const runLatestPath = path.join(
      contractBroadcastDir,
      chainId,
      "run-latest.json",
    );

    if (fs.existsSync(runLatestPath)) {
      broadcasts[chainId] = runLatestPath;
    }
  }

  return broadcasts;
}

/**
 * Extract contract address from broadcast file
 */
function extractContractAddress(broadcastPath, contractName) {
  try {
    const data = JSON.parse(fs.readFileSync(broadcastPath, "utf8"));

    // Look through transactions for contract creation
    if (data.transactions) {
      for (const tx of data.transactions) {
        // Check if this is a contract creation for our target contract
        if (
          tx.transactionType === "CREATE" &&
          tx.contractName === contractName
        ) {
          return tx.contractAddress;
        }

        // Also check additionalContracts array (for proxy patterns)
        if (tx.additionalContracts) {
          for (const additional of tx.additionalContracts) {
            if (
              additional.transactionType === "CREATE" &&
              additional.contractName === contractName
            ) {
              return additional.address;
            }
          }
        }
      }
    }

    // Fallback: check returns array
    if (data.returns && data.returns[contractName]) {
      const value = data.returns[contractName].value;
      if (value && value.startsWith("0x")) {
        return value;
      }
    }

    return null;
  } catch (error) {
    console.error(
      `Error parsing broadcast file ${broadcastPath}:`,
      error.message,
    );
    return null;
  }
}

/**
 * Generate addresses configuration for all networks
 */
function generateAddressesConfig() {
  const config = {};

  console.log("🔍 Scanning deployment broadcasts...\n");

  for (const contractName of CONTRACTS) {
    const broadcasts = findLatestBroadcast(contractName);

    if (!broadcasts) {
      console.warn(`⚠️  No broadcasts found for ${contractName}`);
      continue;
    }

    for (const [chainId, broadcastPath] of Object.entries(broadcasts)) {
      const address = extractContractAddress(broadcastPath, contractName);

      if (address) {
        if (!config[chainId]) {
          config[chainId] = {};
        }

        config[chainId][contractName] = address;
        console.log(`✓ ${contractName} on chain ${chainId}: ${address}`);
      } else {
        console.warn(
          `⚠️  Could not extract address for ${contractName} on chain ${chainId}`,
        );
      }
    }
  }

  return config;
}

/**
 * Write addresses configuration to file
 */
function writeAddressesConfig(config) {
  // Ensure output directory exists
  const outputDir = path.dirname(ADDRESSES_OUTPUT);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write with pretty formatting
  fs.writeFileSync(ADDRESSES_OUTPUT, JSON.stringify(config, null, 2));

  console.log(`\n✓ Contract addresses written to: ${ADDRESSES_OUTPUT}`);
}

/**
 * Validate addresses configuration
 */
function validateConfig(config) {
  const errors = [];

  if (Object.keys(config).length === 0) {
    errors.push("No contract addresses found in any deployment");
    return errors;
  }

  for (const [chainId, addresses] of Object.entries(config)) {
    const contractCount = Object.keys(addresses).length;
    const requiredCount = CONTRACTS.filter(
      (c) => c !== "FractionalPropertyToken",
    ).length;

    if (contractCount < requiredCount) {
      const missing = CONTRACTS.filter(
        (c) => c !== "FractionalPropertyToken" && !addresses[c],
      );
      errors.push(
        `Chain ${chainId}: Missing ${missing.length} contracts: ${missing.join(", ")}`,
      );
    }
  }

  return errors;
}

/**
 * Main execution
 */
function main() {
  console.log("📝 RWAChain Contract Configuration Manager\n");
  console.log("="["repeat"](50) + "\n");

  try {
    // Generate configuration
    const config = generateAddressesConfig();

    // Validate
    const errors = validateConfig(config);
    if (errors.length > 0) {
      console.warn("\n⚠️  Configuration Warnings:");
      errors.forEach((err) => console.warn(`   - ${err}`));
    }

    // Write to file
    writeAddressesConfig(config);

    // Summary
    console.log("\n📊 Summary:");
    for (const [chainId, addresses] of Object.entries(config)) {
      const chainName =
        chainId === "1"
          ? "Mainnet"
          : chainId === "11155111"
            ? "Sepolia"
            : chainId === "31337"
              ? "Local"
              : `Chain ${chainId}`;

      console.log(
        `   ${chainName}: ${Object.keys(addresses).length} contracts`,
      );
    }

    console.log("\n✅ Configuration update complete!\n");

    return 0;
  } catch (error) {
    console.error("\n❌ Configuration generation failed:");
    console.error(`   ${error.message}\n`);
    return 1;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}

export { generateAddressesConfig, validateConfig, writeAddressesConfig };
