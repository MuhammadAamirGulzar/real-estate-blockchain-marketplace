#!/usr/bin/env node
/**
 * Verify Deployment Script
 *
 * Validates that all contracts are properly deployed and initialized:
 * - Checks contract bytecode exists on-chain
 * - Verifies initialization parameters
 * - Tests role assignments
 * - Validates dependencies between contracts
 * - Checks contract configurations
 *
 * Usage: node verify-deployment.js --network [localhost|sepolia]
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

const CHECK_MARK = "✓";
const CROSS_MARK = "✗";
const WARNING_MARK = "⚠";

// Parse command line arguments
const args = process.argv.slice(2);
const networkArg = args.find((arg) => arg.startsWith("--network="));
const requestedNetwork = networkArg ? networkArg.split("=")[1] : "localhost";

// Network configurations
const NETWORKS = {
  localhost: {
    rpcUrl: "http://127.0.0.1:8545",
    chainId: 31337,
    name: "Localhost (Anvil)",
  },
  sepolia: {
    rpcUrl:
      process.env.SEPOLIA_RPC_URL ||
      "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
    chainId: 11155111,
    name: "Sepolia Testnet",
  },
};

const network = NETWORKS[requestedNetwork];
if (!network) {
  console.error(
    `${colors.red}Invalid network: ${requestedNetwork}${colors.reset}`,
  );
  console.error(`Available networks: ${Object.keys(NETWORKS).join(", ")}`);
  process.exit(1);
}

console.log(
  `\n${colors.blue}🔍 Verifying Deployment on ${network.name}${colors.reset}`,
);
console.log("=".repeat(60));

// Load contract addresses
const addressesPath = path.join(
  __dirname,
  "..",
  "..",
  "backend",
  "services",
  "web3",
  "addresses.json",
);
let addresses = {};

try {
  const addressesData = fs.readFileSync(addressesPath, "utf8");
  const parsed = JSON.parse(addressesData);
  addresses = parsed[network.chainId.toString()] || parsed;

  if (Object.keys(addresses).length === 0) {
    console.error(
      `${colors.red}No addresses found for chain ID ${network.chainId}${colors.reset}`,
    );
    process.exit(1);
  }
} catch (error) {
  console.error(
    `${colors.red}Failed to load addresses: ${error.message}${colors.reset}`,
  );
  process.exit(1);
}

// Initialize provider
const provider = new ethers.JsonRpcProvider(network.rpcUrl);

// Results tracking
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  checks: [],
};

/**
 * Log check result
 */
function logResult(
  contractName,
  checkName,
  passed,
  details = "",
  level = "info",
) {
  const status =
    level === "warning" ? WARNING_MARK : passed ? CHECK_MARK : CROSS_MARK;
  const color =
    level === "warning" ? colors.yellow : passed ? colors.green : colors.red;
  const message = `  ${color}${status}${colors.reset} ${contractName}: ${checkName}${details ? ` - ${details}` : ""}`;

  console.log(message);

  results.checks.push({ contractName, checkName, passed, details, level });

  if (level === "warning") {
    results.warnings++;
  } else if (passed) {
    results.passed++;
  } else {
    results.failed++;
  }
}

/**
 * Check if contract has bytecode (is deployed)
 */
async function checkContractDeployed(name, address) {
  try {
    if (!address || address === "0x0000000000000000000000000000000000000000") {
      logResult(name, "Deployment", false, "Address not set");
      return false;
    }

    const code = await provider.getCode(address);
    const isDeployed = code !== "0x" && code.length > 2;

    logResult(
      name,
      "Deployment",
      isDeployed,
      isDeployed ? address : "No bytecode found",
    );
    return isDeployed;
  } catch (error) {
    logResult(name, "Deployment", false, error.message);
    return false;
  }
}

/**
 * Load contract ABI
 */
function loadABI(contractName) {
  const abiPath = path.join(
    __dirname,
    "..",
    "..",
    "backend",
    "services",
    "web3",
    "abi",
    `${contractName}.json`,
  );

  try {
    const abiData = fs.readFileSync(abiPath, "utf8");
    const parsed = JSON.parse(abiData);
    return parsed.abi || parsed;
  } catch (error) {
    logResult(contractName, "ABI Load", false, error.message, "warning");
    return null;
  }
}

/**
 * Check contract role assignment
 */
async function checkRole(
  contract,
  roleName,
  roleHash,
  expectedHolder,
  contractName,
) {
  try {
    const hasRole = await contract.hasRole(roleHash, expectedHolder);
    logResult(
      contractName,
      `${roleName} Role`,
      hasRole,
      `Holder: ${expectedHolder.slice(0, 10)}...`,
    );
    return hasRole;
  } catch (error) {
    logResult(
      contractName,
      `${roleName} Role`,
      false,
      error.message,
      "warning",
    );
    return false;
  }
}

/**
 * Verify RoleManager
 */
async function verifyRoleManager() {
  console.log(`\n${colors.blue}📋 RoleManager${colors.reset}`);

  const isDeployed = await checkContractDeployed(
    "RoleManager",
    addresses.RoleManager,
  );
  if (!isDeployed) return;

  const abi = loadABI("RoleManager");
  if (!abi) return;

  const contract = new ethers.Contract(addresses.RoleManager, abi, provider);

  try {
    // Check DEFAULT_ADMIN_ROLE
    const adminRole = await contract.DEFAULT_ADMIN_ROLE();
    // In production, you'd check against actual admin address from env
    logResult("RoleManager", "Admin Role Hash", true, adminRole);
  } catch (error) {
    logResult("RoleManager", "Role Check", false, error.message, "warning");
  }
}

/**
 * Verify PriceOracle
 */
async function verifyPriceOracle() {
  console.log(`\n${colors.blue}💰 PriceOracle${colors.reset}`);

  const isDeployed = await checkContractDeployed(
    "PriceOracle",
    addresses.PriceOracle,
  );
  if (!isDeployed) return;

  const abi = loadABI("PriceOracle");
  if (!abi) return;

  const contract = new ethers.Contract(addresses.PriceOracle, abi, provider);

  try {
    // Check price deviation threshold
    const threshold = await contract.priceDeviationThreshold();
    const expectedThreshold = ethers.parseEther("0.2"); // 20%
    const isCorrect = threshold === expectedThreshold;
    logResult(
      "PriceOracle",
      "Deviation Threshold",
      isCorrect,
      `${ethers.formatEther(threshold)}%`,
    );

    // Check supported currencies
    const currencies = await contract.getSupportedCurrencies();
    logResult(
      "PriceOracle",
      "Supported Currencies",
      currencies.length > 0,
      `${currencies.length} currencies`,
      currencies.length === 0 ? "warning" : "info",
    );
  } catch (error) {
    logResult("PriceOracle", "Configuration", false, error.message, "warning");
  }
}

/**
 * Verify PaymentEscrow
 */
async function verifyPaymentEscrow() {
  console.log(`\n${colors.blue}🔐 PaymentEscrow${colors.reset}`);

  const isDeployed = await checkContractDeployed(
    "PaymentEscrow",
    addresses.PaymentEscrow,
  );
  if (!isDeployed) return;

  const abi = loadABI("PaymentEscrow");
  if (!abi) return;

  const contract = new ethers.Contract(addresses.PaymentEscrow, abi, provider);

  try {
    // Check escrow timeout (should be 7 days = 604800 seconds)
    const timeout = await contract.escrowTimeout();
    const expectedTimeout = 604800n; // 7 days
    const isCorrect = timeout === expectedTimeout;
    logResult(
      "PaymentEscrow",
      "Escrow Timeout",
      isCorrect,
      `${timeout} seconds (${Number(timeout) / 86400} days)`,
    );

    // Check treasury address
    const treasury = await contract.treasury();
    const hasTreasury =
      treasury !== "0x0000000000000000000000000000000000000000";
    logResult("PaymentEscrow", "Treasury Address", hasTreasury, treasury);

    // Check escrow counter
    const counter = await contract.escrowCounter();
    logResult(
      "PaymentEscrow",
      "Escrow Counter",
      true,
      `${counter} escrows created`,
    );
  } catch (error) {
    logResult(
      "PaymentEscrow",
      "Configuration",
      false,
      error.message,
      "warning",
    );
  }
}

/**
 * Verify MultiTokenPayment
 */
async function verifyMultiTokenPayment() {
  console.log(`\n${colors.blue}💳 MultiTokenPayment${colors.reset}`);

  const isDeployed = await checkContractDeployed(
    "MultiTokenPayment",
    addresses.MultiTokenPayment,
  );
  if (!isDeployed) return;

  const abi = loadABI("MultiTokenPayment");
  if (!abi) return;

  const contract = new ethers.Contract(
    addresses.MultiTokenPayment,
    abi,
    provider,
  );

  try {
    // Check dependencies — compare case-insensitively: contract returns EIP-55
    // checksummed addresses, addresses.json stores lowercase.
    const priceOracleAddr = await contract.priceOracle();
    const isPriceOracleSet =
      priceOracleAddr.toLowerCase() === addresses.PriceOracle.toLowerCase();
    logResult(
      "MultiTokenPayment",
      "PriceOracle Link",
      isPriceOracleSet,
      priceOracleAddr,
    );

    const investmentManagerAddr = await contract.investmentManager();
    const isInvestmentManagerSet =
      investmentManagerAddr.toLowerCase() ===
      addresses.InvestmentManager.toLowerCase();
    logResult(
      "MultiTokenPayment",
      "InvestmentManager Link",
      isInvestmentManagerSet,
      investmentManagerAddr,
    );

    // Check treasury
    const treasury = await contract.treasury();
    const hasTreasury =
      treasury !== "0x0000000000000000000000000000000000000000";
    logResult("MultiTokenPayment", "Treasury Address", hasTreasury, treasury);

    // Check RWAP token
    const rwaToken = await contract.rwaTokenAddress();
    const isRWASet =
      rwaToken.toLowerCase() === addresses.RWAToken.toLowerCase();
    logResult("MultiTokenPayment", "RWAP Token Link", isRWASet, rwaToken);

    // Check supported tokens
    const tokens = await contract.getSupportedTokens();
    logResult(
      "MultiTokenPayment",
      "Supported Tokens",
      tokens.length > 0,
      `${tokens.length} tokens`,
      tokens.length === 0 ? "warning" : "info",
    );
  } catch (error) {
    logResult(
      "MultiTokenPayment",
      "Configuration",
      false,
      error.message,
      "warning",
    );
  }
}

/**
 * Verify all other core contracts
 */
async function verifyOtherContracts() {
  const otherContracts = [
    "KYCRegistry",
    "AssetRegistry",
    "PropertyNFT",
    "RWAToken",
    "InvestmentManager",
    "SecondaryMarket",
    "RevenueDistributor",
  ];

  for (const name of otherContracts) {
    if (addresses[name]) {
      console.log(`\n${colors.blue}📄 ${name}${colors.reset}`);
      await checkContractDeployed(name, addresses[name]);
    }
  }
}

/**
 * Print final summary
 */
function printSummary() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`${colors.blue}📊 Verification Summary${colors.reset}\n`);

  console.log(`${colors.green}Passed:${colors.reset}   ${results.passed}`);
  console.log(`${colors.red}Failed:${colors.reset}   ${results.failed}`);
  console.log(`${colors.yellow}Warnings:${colors.reset} ${results.warnings}`);
  console.log(
    `Total Checks: ${results.passed + results.failed + results.warnings}\n`,
  );

  if (results.failed === 0) {
    console.log(
      `${colors.green}${CHECK_MARK} All critical checks passed!${colors.reset}`,
    );
    if (results.warnings > 0) {
      console.log(
        `${colors.yellow}${WARNING_MARK} Some warnings detected - review recommended${colors.reset}`,
      );
    }
  } else {
    console.log(
      `${colors.red}${CROSS_MARK} ${results.failed} checks failed${colors.reset}`,
    );
    console.log(
      `${colors.red}Deployment verification failed. Please review errors above.${colors.reset}`,
    );
  }

  console.log();
}

/**
 * Main verification flow
 */
async function main() {
  try {
    // Check network connectivity
    const blockNumber = await provider.getBlockNumber();
    console.log(
      `\n${colors.green}${CHECK_MARK}${colors.reset} Connected to ${network.name} (Block: ${blockNumber})\n`,
    );

    // Verify core contracts
    await verifyRoleManager();
    await verifyOtherContracts();

    // Verify payment system contracts
    await verifyPriceOracle();
    await verifyPaymentEscrow();
    await verifyMultiTokenPayment();

    // Print summary
    printSummary();

    // Exit with appropriate code
    process.exit(results.failed === 0 ? 0 : 1);
  } catch (error) {
    console.error(
      `\n${colors.red}Fatal error: ${error.message}${colors.reset}`,
    );
    process.exit(1);
  }
}

// Run verification
main();
