import { ethers } from "ethers";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";
import { web3Service } from "../services/web3Service.js";

/**
 * Verify blockchain setup and synchronization
 * Run: node backend/scripts/verify-setup.js
 */

const REQUIRED_CONTRACTS = [
  "RoleManager",
  "KYCRegistry",
  "AssetRegistry",
  "PropertyNFT",
  "RWAToken",
  "InvestmentManager",
  "SecondaryMarket",
  "RevenueDistributor",
];

async function verifySetup() {
  console.log("🔍 Verifying RWA Platform Setup...\n");

  let errors = 0;
  let warnings = 0;

  // 1. Check Database Connection
  console.log("1️⃣ Checking Database Connection...");
  try {
    const result = await db.select().from(users).limit(1);
    console.log("   ✅ Database connected\n");
  } catch (error) {
    console.error("   ❌ Database connection failed:", error.message);
    errors++;
  }

  // 2. Check Blockchain Connection
  console.log("2️⃣ Checking Blockchain Connection...");
  try {
    await web3Service.ensureInitialized();
    const blockNumber = await web3Service.provider.getBlockNumber();
    const network = await web3Service.provider.getNetwork();
    console.log(
      `   ✅ Connected to network: ${network.name} (chainId: ${network.chainId})`,
    );
    console.log(`   ✅ Current block: ${blockNumber}\n`);
  } catch (error) {
    console.error("   ❌ Blockchain connection failed:", error.message);
    errors++;
  }

  // 3. Check Contract Deployments
  console.log("3️⃣ Checking Contract Deployments...");
  for (const contractName of REQUIRED_CONTRACTS) {
    try {
      const contract = web3Service.getContract(contractName);
      const address = await contract.getAddress();

      // Try to call a basic function to verify it's a valid contract
      if (contractName === "RoleManager") {
        const adminRole = await contract.ADMIN_ROLE();
        console.log(`   ✅ ${contractName}: ${address}`);
      } else if (contractName === "KYCRegistry") {
        const roleManager = await contract.roleManager();
        console.log(`   ✅ ${contractName}: ${address}`);
      } else {
        console.log(`   ✅ ${contractName}: ${address}`);
      }
    } catch (error) {
      console.error(`   ❌ ${contractName}: Not deployed or invalid`);
      errors++;
    }
  }
  console.log("");

  // 4. Check Admin User Exists
  console.log("4️⃣ Checking Admin User...");
  try {
    const [adminUser] = await db
      .select()
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);

    if (adminUser) {
      console.log(`   ✅ Admin user found: ${adminUser.email}`);
      if (adminUser.walletAddress) {
        console.log(`   ✅ Wallet address: ${adminUser.walletAddress}`);

        // Check if admin has ADMIN_ROLE on blockchain
        const ADMIN_ROLE = ethers.id("ADMIN_ROLE");
        const hasAdminRole = await web3Service.hasRole(
          ADMIN_ROLE,
          adminUser.walletAddress,
        );
        if (hasAdminRole) {
          console.log(`   ✅ Admin has ADMIN_ROLE on blockchain`);
        } else {
          console.log(`   ⚠️  Admin does NOT have ADMIN_ROLE on blockchain`);
          console.log(
            `   Run: cast send $ROLE_MANAGER_ADDRESS "grantRoleByAdmin(bytes32,address)" $(cast keccak "ADMIN_ROLE") ${adminUser.walletAddress} --private-key $DEPLOYER_PRIVATE_KEY`,
          );
          warnings++;
        }
      } else {
        console.log(`   ⚠️  Admin user has no wallet address`);
        warnings++;
      }
    } else {
      console.log(`   ⚠️  No admin user found in database`);
      console.log(`   Run: node backend/scripts/create-test-users.js`);
      warnings++;
    }
  } catch (error) {
    console.error("   ❌ Error checking admin user:", error.message);
    errors++;
  }
  console.log("");

  // 5. Check Required Tables
  console.log("5️⃣ Checking Database Tables...");
  const requiredTables = [
    "users",
    "kyc_submissions",
    "properties",
    "verifier_assignments",
    "blockchainTransactions",
    "secondary_market_listings",
  ];

  for (const tableName of requiredTables) {
    try {
      // Try to query each table
      const query = `SELECT COUNT(*) FROM ${tableName}`;
      const result = await db.execute(query);
      console.log(`   ✅ Table exists: ${tableName}`);
    } catch (error) {
      console.error(`   ❌ Table missing: ${tableName}`);
      errors++;
    }
  }
  console.log("");

  // 6. Check Contract Interactions
  console.log("6️⃣ Testing Contract Interactions...");
  try {
    const roleManager = web3Service.getContract("RoleManager");

    // Get role definitions
    const adminRole = await roleManager.ADMIN_ROLE();
    const verifierRole = await roleManager.VERIFIER_ROLE();
    const userRole = await roleManager.USER_ROLE();

    console.log(`   ✅ ADMIN_ROLE: ${adminRole}`);
    console.log(`   ✅ VERIFIER_ROLE: ${verifierRole}`);
    console.log(`   ✅ USER_ROLE: ${userRole}`);

    // Check KYC Registry
    const kycRegistry = web3Service.getContract("KYCRegistry");
    const kycRoleManager = await kycRegistry.roleManager();
    const roleManagerAddress = await roleManager.getAddress();

    if (kycRoleManager.toLowerCase() === roleManagerAddress.toLowerCase()) {
      console.log(`   ✅ KYCRegistry correctly linked to RoleManager`);
    } else {
      console.log(`   ⚠️  KYCRegistry RoleManager mismatch`);
      warnings++;
    }

    // Check Asset Registry
    const assetRegistry = web3Service.getContract("AssetRegistry");
    const assetRoleManager = await assetRegistry.roleManager();

    if (assetRoleManager.toLowerCase() === roleManagerAddress.toLowerCase()) {
      console.log(`   ✅ AssetRegistry correctly linked to RoleManager`);
    } else {
      console.log(`   ⚠️  AssetRegistry RoleManager mismatch`);
      warnings++;
    }
  } catch (error) {
    console.error("   ❌ Contract interaction failed:", error.message);
    errors++;
  }
  console.log("");

  // 7. Summary
  console.log("═".repeat(60));
  console.log("📊 VERIFICATION SUMMARY");
  console.log("═".repeat(60));

  if (errors === 0 && warnings === 0) {
    console.log("✅ All checks passed! System ready for testing.");
  } else {
    if (errors > 0) {
      console.log(`❌ Errors: ${errors} - Must be fixed before testing`);
    }
    if (warnings > 0) {
      console.log(`⚠️  Warnings: ${warnings} - Should be addressed`);
    }
  }

  console.log("═".repeat(60));
  console.log("");

  // 8. Next Steps
  if (errors === 0) {
    console.log("🚀 Next Steps:");
    console.log("1. Start backend: cd backend && npm run dev");
    console.log("2. Start frontend: cd frontend && npm run dev");
    console.log("3. Follow testing plan: docs/TESTING_PLAN.md");
    console.log("");
  }

  process.exit(errors > 0 ? 1 : 0);
}

// Handle imports
import { eq } from "drizzle-orm";

verifySetup().catch((error) => {
  console.error("❌ Verification failed:", error);
  process.exit(1);
});
