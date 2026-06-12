import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { db } from "../db/connection.js";
import { properties, users, verifierAssignments } from "../db/schema.js";

dotenv.config();

const RPC_URL = process.env.RPC_URL || "http://localhost:8545";
const ASSET_REGISTRY_ADDRESS = "0x0165878A594ca255338adfa4d48449f69242Eb8F";

const AssetRegistryABI = [
  "function properties(uint256) view returns (uint256 id, address owner, string metadataHash, uint8 status, address assignedVerifier, uint256 listedAt, uint256 verifiedAt, string rejectionReason)",
];

async function main() {
  const propertyDbId = process.argv[2] || 5;

  console.log(`\n🔄 Syncing property ${propertyDbId} from blockchain...\n`);

  // Get property from database
  const [dbProperty] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, parseInt(propertyDbId)));

  if (!dbProperty) {
    console.log("❌ Property not found in database");
    process.exit(1);
  }

  if (!dbProperty.assetRegistryId) {
    console.log("❌ Property not registered on blockchain");
    process.exit(1);
  }

  console.log(`📊 Database: ${dbProperty.title}`);
  console.log(`   Status: ${dbProperty.status}`);
  console.log(
    `   Assigned Verifier ID: ${dbProperty.assignedVerifierId || "None"}\n`,
  );

  // Get from blockchain
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const assetRegistry = new ethers.Contract(
    ASSET_REGISTRY_ADDRESS,
    AssetRegistryABI,
    provider,
  );

  const blockchainProperty = await assetRegistry.properties(
    dbProperty.assetRegistryId,
  );

  const assignedVerifierAddress = blockchainProperty[4];
  console.log(`⛓️  Blockchain Assigned Verifier: ${assignedVerifierAddress}\n`);

  if (assignedVerifierAddress !== ethers.ZeroAddress) {
    // Find verifier in database by wallet address
    const [verifier] = await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, assignedVerifierAddress.toLowerCase()));

    if (!verifier) {
      console.log(
        `❌ Verifier with wallet ${assignedVerifierAddress} not found in database`,
      );
      process.exit(1);
    }

    console.log(`✅ Found verifier: ${verifier.email} (ID: ${verifier.id})`);
    console.log(`   Updating database...\n`);

    // Update property
    await db
      .update(properties)
      .set({
        assignedVerifierId: verifier.id,
        assignedBy: 1, // Admin
        assignedAt: new Date(),
        status: "verification_pending",
      })
      .where(eq(properties.id, parseInt(propertyDbId)));

    // Create verifierAssignments record
    const existingAssignment = await db
      .select()
      .from(verifierAssignments)
      .where(eq(verifierAssignments.propertyId, parseInt(propertyDbId)));

    if (existingAssignment.length === 0) {
      await db.insert(verifierAssignments).values({
        verifierId: verifier.id,
        propertyId: parseInt(propertyDbId),
        assignedBy: 1, // Admin
        status: "assigned",
        assignedAt: new Date(),
      });
      console.log("✅ Created verifierAssignments record");
    } else {
      console.log("ℹ️  verifierAssignments record already exists");
    }

    console.log("✅ Database synced with blockchain!\n");
  } else {
    console.log("ℹ️  No verifier assigned on blockchain, no update needed\n");
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
