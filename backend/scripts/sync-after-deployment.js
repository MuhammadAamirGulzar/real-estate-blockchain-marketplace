import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";
import RoleManagerABI from "../services/web3/abi/RoleManager.json" with { type: "json" };
import addressesData from "../services/web3/addresses.json" with { type: "json" };

dotenv.config();

const CHAIN_ID = "31337";
const addresses = addressesData[CHAIN_ID];
const RPC_URL = process.env.RPC_URL || "http://localhost:8545";

async function syncAfterDeployment() {
  console.log("🔄 Syncing After Contract Deployment...\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const roleManager = new ethers.Contract(
    addresses.RoleManager,
    RoleManagerABI.abi,
    provider,
  );

  const ADMIN_ROLE = ethers.id("ADMIN_ROLE");

  // Check if admin has ADMIN_ROLE
  const [admin] = await db.select().from(users).where(eq(users.role, "admin"));

  if (!admin) {
    console.log("❌ No admin found in database");
    process.exit(1);
  }

  console.log(`👤 Admin: ${admin.email}`);
  console.log(`   Wallet: ${admin.walletAddress}\n`);

  const hasAdminRole = await roleManager.hasRole(
    ADMIN_ROLE,
    admin.walletAddress,
  );

  if (hasAdminRole) {
    console.log("✅ Admin has ADMIN_ROLE on blockchain");
  } else {
    console.log("❌ Admin does NOT have ADMIN_ROLE");
    console.log("\n⚠️  Run deployment script again or grant role manually");
  }

  console.log("\n✅ Post-deployment sync complete\n");
  process.exit(0);
}

syncAfterDeployment();
