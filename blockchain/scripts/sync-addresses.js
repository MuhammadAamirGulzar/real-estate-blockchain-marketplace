#!/usr/bin/env node
/**
 * Sync Contract Addresses to Backend
 *
 * Properly formats and syncs blockchain contract addresses to backend addresses.json
 * Usage: node sync-addresses.js <chainId> <addresses_json>
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const chainId = args[0];
const addressesJson = args[1];

if (!chainId || !addressesJson) {
  console.error("Usage: node sync-addresses.js <chainId> <addresses_json>");
  console.error(
    'Example: node sync-addresses.js 31337 \'{"RoleManager":"0x..."}\'',
  );
  process.exit(1);
}

const backendPath = path.join(
  __dirname,
  "..",
  "..",
  "backend",
  "services",
  "web3",
  "addresses.json",
);

try {
  // Parse the addresses from command line
  const addresses = JSON.parse(addressesJson);

  // Load existing or create new
  let allAddresses = {};
  if (fs.existsSync(backendPath)) {
    try {
      const content = fs.readFileSync(backendPath, "utf8");
      allAddresses = JSON.parse(content);
    } catch (error) {
      console.warn(
        "Warning: Could not parse existing addresses.json, creating new",
      );
      allAddresses = {};
    }
  }

  // Update for this chain
  allAddresses[chainId] = addresses;

  // Write with proper formatting
  fs.writeFileSync(backendPath, JSON.stringify(allAddresses, null, 2), "utf8");
  console.log(`✓ Synced addresses to backend for chain ${chainId}`);
  console.log(`  Contracts: ${Object.keys(addresses).length}`);
  process.exit(0);
} catch (error) {
  console.error(`✗ Failed to sync addresses: ${error.message}`);
  process.exit(1);
}
