import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FOUNDRY_OUT_DIR = path.join(__dirname, "../../../blockchain/out");
const BACKEND_ABI_DIR = path.join(__dirname, "abi");
const FRONTEND_ABI_DIR = path.join(__dirname, "../../../src/contracts/abi");

const contracts = [
  "RoleManager.sol/RoleManager.json",
  "KYCRegistry.sol/KYCRegistry.json",
  "AssetRegistry.sol/AssetRegistry.json",
  "RWAToken.sol/RWAToken.json",
  "PropertyNFT.sol/PropertyNFT.json",
  "FractionalPropertyToken.sol/FractionalPropertyToken.json",
  "InvestmentManager.sol/InvestmentManager.json",
  "PriceOracle.sol/PriceOracle.json",
  "PaymentEscrow.sol/PaymentEscrow.json",
  "MultiTokenPayment.sol/MultiTokenPayment.json",
  "SecondaryMarket.sol/SecondaryMarket.json",
  "RevenueDistributor.sol/RevenueDistributor.json",
];

// Helper to ensure directory exists
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}

// Helper to check if file exists
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function syncContracts() {
  console.log("🔄 Syncing contract ABIs...\n");

  try {
    // Ensure ABI directories exist
    await ensureDir(BACKEND_ABI_DIR);
    await ensureDir(FRONTEND_ABI_DIR);

    let syncedCount = 0;
    let failedCount = 0;

    for (const contract of contracts) {
      const sourcePath = path.join(FOUNDRY_OUT_DIR, contract);
      const contractName = path.basename(contract, ".json");
      const backendDest = path.join(BACKEND_ABI_DIR, `${contractName}.json`);
      const frontendDest = path.join(FRONTEND_ABI_DIR, `${contractName}.json`);

      if (await fileExists(sourcePath)) {
        try {
          const contractJsonData = await fs.readFile(sourcePath, "utf-8");
          const contractJson = JSON.parse(contractJsonData);

          // Extract only ABI and bytecode
          const abiData = {
            abi: contractJson.abi || [],
            bytecode:
              contractJson.bytecode?.object || contractJson.bytecode || "",
          };

          // Write to backend
          await fs.writeFile(backendDest, JSON.stringify(abiData, null, 2));

          // Write to frontend
          await fs.writeFile(frontendDest, JSON.stringify(abiData, null, 2));

          console.log(`✅ Synced: ${contractName}`);
          syncedCount++;
        } catch (parseError) {
          console.error(
            `❌ Error parsing ${contractName}:`,
            parseError.message,
          );
          failedCount++;
        }
      } else {
        console.log(`⚠️  Not found: ${contract}`);
        failedCount++;
      }
    }

    console.log(`\n📊 Sync Summary:`);
    console.log(`   ✅ Synced: ${syncedCount}`);
    console.log(`   ⚠️  Failed/Missing: ${failedCount}`);
    console.log(`\n✅ ABIs copied to:`);
    console.log(`   • Backend: ${BACKEND_ABI_DIR}`);
    console.log(`   • Frontend: ${FRONTEND_ABI_DIR}`);
    console.log(`\n🎉 Contract sync complete!`);
  } catch (error) {
    console.error("❌ Sync failed:", error.message);
    process.exit(1);
  }
}

syncContracts();
