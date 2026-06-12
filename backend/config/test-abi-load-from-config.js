import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Current file:", __filename);
console.log("Current dir:", __dirname);
console.log("");

const testContracts = ["PriceOracle", "PaymentEscrow", "MultiTokenPayment"];

for (const contractName of testContracts) {
  // Test path construction exactly as contracts.config.js does it
  const abiPath = path.join(
    __dirname,
    "..",
    "services",
    "web3",
    "abi",
    `${contractName}.json`,
  );

  console.log(`Testing ${contractName}:`);
  console.log(`  Path: ${abiPath}`);
  console.log(`  Exists: ${fs.existsSync(abiPath)}`);

  if (fs.existsSync(abiPath)) {
    try {
      const content = JSON.parse(fs.readFileSync(abiPath, "utf8"));
      console.log(`  Has ABI: ${Array.isArray(content.abi || content)}`);
      console.log(`  ABI length: ${(content.abi || content).length}`);
    } catch (err) {
      console.log(`  Error reading: ${err.message}`);
    }
  }
  console.log("");
}
