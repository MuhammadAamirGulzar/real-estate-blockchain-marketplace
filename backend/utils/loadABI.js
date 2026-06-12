import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load contract ABI from compiled artifacts
 * @param {string} contractName - Name of the contract (e.g., 'PriceOracle', 'RWAToken')
 * @param {boolean} throwOnMissing - If true, throw error when ABI not found. Default: false
 * @returns {Object} Contract ABI object with 'abi' property
 */
export function loadABI(contractName, throwOnMissing = false) {
  try {
    const abiPath = join(
      __dirname,
      `../../blockchain/out/${contractName}.sol/${contractName}.json`,
    );

    // Check if file exists before trying to read
    if (!existsSync(abiPath)) {
      if (throwOnMissing) {
        throw new Error(
          `ABI not found for contract '${contractName}' at ${abiPath}. ` +
            `Please compile contracts with: cd blockchain && forge build`,
        );
      }

      console.warn(
        `⚠️  ABI not found for ${contractName}. Contract may not be compiled yet.`,
      );

      // Return empty ABI structure to prevent crashes
      return { abi: [] };
    }

    const abiContent = readFileSync(abiPath, "utf8");
    const parsedABI = JSON.parse(abiContent);

    console.log(`✅ Loaded ABI for ${contractName}`);
    return parsedABI;
  } catch (error) {
    if (throwOnMissing) {
      throw error;
    }

    console.error(`❌ Failed to load ABI for ${contractName}:`, error.message);
    return { abi: [] };
  }
}

/**
 * Load multiple ABIs at once
 * @param {string[]} contractNames - Array of contract names
 * @returns {Object} Object with contract names as keys and ABIs as values
 */
export function loadABIs(contractNames) {
  const abis = {};

  for (const contractName of contractNames) {
    abis[contractName] = loadABI(contractName);
  }

  return abis;
}

/**
 * Preload all main contract ABIs
 * @returns {Object} Object with all contract ABIs
 */
export function loadAllContractABIs() {
  const contracts = [
    "RWAToken",
    "PropertyNFT",
    "InvestmentManager",
    "KYCRegistry",
    "AssetRegistry",
    "RoleManager",
    "RevenueDistributor",
    "SecondaryMarket",
    "FractionalPropertyToken",
    "PriceOracle",
    "PaymentEscrow",
    "MultiTokenPayment",
  ];

  console.log("\n📦 Loading contract ABIs...");
  const abis = loadABIs(contracts);

  const loadedCount = Object.values(abis).filter(
    (abi) => abi.abi.length > 0,
  ).length;
  console.log(`✅ Loaded ${loadedCount}/${contracts.length} contract ABIs\n`);

  return abis;
}

export default loadABI;
