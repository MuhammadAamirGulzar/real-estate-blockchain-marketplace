import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Configuration ---
const projectRoot = path.resolve(__dirname, "..");
const foundryOutDir = path.join(projectRoot, "blockchain", "out");
const foundryBroadcastDir = path.join(projectRoot, "blockchain", "broadcast");
const serverDir = path.join(projectRoot, "backend");
const abiTargetDir = path.join(serverDir, "services", "web3", "abi");
const addressTargetFile = path.join(
  serverDir,
  "services",
  "web3",
  "addresses.json",
);
const CHAIN_ID = process.env.CHAIN_ID || "31337";

const contracts = [
  { name: "RoleManager", script: "DeployRoleManager.s.sol" },
  { name: "KYCRegistry", script: "DeployKYCRegistry.s.sol" },
  { name: "AssetRegistry", script: "DeployAssetRegistry.s.sol" },
  { name: "RWAToken", script: "DeployRWAToken.s.sol" },
  { name: "PropertyNFT", script: "DeployPropertyNFT.s.sol" },
  { name: "InvestmentManager", script: "DeployInvestmentManager.s.sol" },
  { name: "SecondaryMarket", script: "DeploySecondaryMarket.s.sol" },
  { name: "RevenueDistributor", script: "DeployRevenueDistributor.s.sol" },
  { name: "PriceOracle", script: "DeployPriceOracle.s.sol" },
  { name: "PaymentEscrow", script: "DeployPaymentEscrow.s.sol" },
  { name: "MultiTokenPayment", script: "DeployMultiTokenPayment.s.sol" },
];

function syncAbis() {
  if (!fs.existsSync(abiTargetDir)) {
    fs.mkdirSync(abiTargetDir, { recursive: true });
  }
  for (const contract of contracts) {
    const abiSourcePath = path.join(
      foundryOutDir,
      `${contract.name}.sol`,
      `${contract.name}.json`,
    );
    const abiDestPath = path.join(abiTargetDir, `${contract.name}.json`);
    if (fs.existsSync(abiSourcePath)) {
      fs.copyFileSync(abiSourcePath, abiDestPath);
      console.log(`✅ Copied ABI for ${contract.name}`);
    } else {
      console.warn(`❌ ABI for ${contract.name} not found at ${abiSourcePath}`);
    }
  }
}

function syncAddresses() {
  const addresses = { chainId: CHAIN_ID };
  for (const contract of contracts) {
    const broadcastPath = path.join(
      foundryBroadcastDir,
      contract.script,
      CHAIN_ID,
    );
    if (!fs.existsSync(broadcastPath)) {
      console.warn(
        `❌ Broadcast directory for ${contract.name} not found at ${broadcastPath}`,
      );
      continue;
    }
    // Find the latest run file
    const runFiles = fs
      .readdirSync(broadcastPath)
      .filter((f) => f.startsWith("run-") && f.endsWith(".json"));
    if (runFiles.length === 0) {
      console.warn(`❌ No broadcast run files found for ${contract.name}`);
      continue;
    }
    runFiles.sort((a, b) => {
      const aStat = fs.statSync(path.join(broadcastPath, a));
      const bStat = fs.statSync(path.join(broadcastPath, b));
      return bStat.mtimeMs - aStat.mtimeMs;
    });

    const latestRunFile = path.join(broadcastPath, runFiles[0]);
    const runData = JSON.parse(fs.readFileSync(latestRunFile, "utf-8"));

    const contractTx = runData.transactions.find(
      (tx) =>
        tx.contractName === contract.name && tx.transactionType === "CREATE",
    );
    if (contractTx && contractTx.contractAddress) {
      addresses[contract.name] = contractTx.contractAddress;
      console.log(
        `✅ Found address for ${contract.name}: ${contractTx.contractAddress}`,
      );
    } else {
      console.warn(
        `❌ Could not find deployed address for ${contract.name} in ${runFiles[0]}`,
      );
    }
  }
  fs.writeFileSync(addressTargetFile, JSON.stringify(addresses, null, 2));
  console.log(`✅ Wrote addresses to ${addressTargetFile}`);
}

console.log("--- Syncing Foundry Artifacts to Server ---");
syncAbis();
syncAddresses();
console.log("--- Sync Complete ---");
