import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";

dotenv.config();

const RPC_URL = process.env.RPC_URL || "http://localhost:8545";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const ROLE_MANAGER_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // From addresses.json

const VERIFIER_ROLE = ethers.id("VERIFIER_ROLE");

const RoleManagerABI = [
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function grantRoleByAdmin(bytes32 role, address account)",
  "function VERIFIER_ROLE() view returns (bytes32)",
];

async function main() {
  console.log(
    "🔍 Checking and granting VERIFIER_ROLE to all database verifiers...\n",
  );

  // Connect to blockchain
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  const roleManager = new ethers.Contract(
    ROLE_MANAGER_ADDRESS,
    RoleManagerABI,
    signer,
  );

  // Get all verifiers from database
  const verifiers = await db
    .select()
    .from(users)
    .where(eq(users.role, "verifier"));

  console.log(`Found ${verifiers.length} verifiers in database:\n`);

  for (const verifier of verifiers) {
    if (!verifier.walletAddress) {
      console.log(`⚠️  ${verifier.email} - No wallet address`);
      continue;
    }

    const hasRole = await roleManager.hasRole(
      VERIFIER_ROLE,
      verifier.walletAddress,
    );

    if (hasRole) {
      console.log(
        `✅ ${verifier.email} (${verifier.walletAddress}) - Already has VERIFIER_ROLE`,
      );
    } else {
      console.log(
        `❌ ${verifier.email} (${verifier.walletAddress}) - Missing VERIFIER_ROLE`,
      );
      console.log(`   Granting role...`);

      try {
        const tx = await roleManager.grantRoleByAdmin(
          VERIFIER_ROLE,
          verifier.walletAddress,
        );
        const receipt = await tx.wait();
        console.log(`   ✅ Role granted! TX: ${receipt.hash}\n`);

        // Update database
        await db
          .update(users)
          .set({ roleGrantTransactionHash: receipt.hash })
          .where(eq(users.id, verifier.id));
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}\n`);
      }
    }
  }

  console.log("\n✅ Done!");
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
