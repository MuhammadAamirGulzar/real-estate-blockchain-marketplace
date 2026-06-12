import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";

/**
 * Create test users for testing the platform
 * Run: node backend/scripts/create-test-users.js
 */

const TEST_USERS = [
  {
    email: "admin@rwachain.com",
    password: "Admin123!@#",
    name: "Admin User",
    role: "admin",
    walletAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Anvil account 0
    kycStatus: "approved",
  },
  {
    email: "verifier@rwachain.com",
    password: "Verifier123!@#",
    name: "Verifier User",
    role: "verifier",
    walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Anvil account 1
    kycStatus: "approved",
  },
  {
    email: "user1@rwachain.com",
    password: "User123!@#",
    name: "Test User 1",
    role: "user",
    walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Anvil account 2
    kycStatus: "approved",
  },
  {
    email: "user2@rwachain.com",
    password: "User123!@#",
    name: "Test User 2",
    role: "user",
    walletAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", // Anvil account 3
    kycStatus: "pending",
  },
  {
    email: "user3@rwachain.com",
    password: "User123!@#",
    name: "Test User 3",
    role: "user",
    walletAddress: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", // Anvil account 4
    kycStatus: "not_submitted",
  },
];

async function createTestUsers() {
  console.log("🔧 Creating test users...\n");

  for (const userData of TEST_USERS) {
    try {
      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, userData.email))
        .limit(1);

      if (existingUser) {
        console.log(`⚠️  User ${userData.email} already exists, skipping...`);
        continue;
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          email: userData.email,
          password: hashedPassword,
          name: userData.name,
          role: userData.role,
          walletAddress: userData.walletAddress,
          kycStatus: userData.kycStatus,
        })
        .returning();

      console.log(`✅ Created user: ${userData.email}`);
      console.log(`   Role: ${userData.role}`);
      console.log(`   Wallet: ${userData.walletAddress}`);
      console.log(`   Password: ${userData.password}`);
      console.log("");
    } catch (error) {
      console.error(`❌ Error creating user ${userData.email}:`, error.message);
    }
  }

  console.log("✅ Test users creation complete!\n");
  console.log("📋 Summary:");
  console.log("-------------------");
  TEST_USERS.forEach((user) => {
    console.log(`${user.email} / ${user.password} (${user.role})`);
  });
  console.log("-------------------\n");

  console.log(
    "⚠️  IMPORTANT: Remember to grant blockchain roles for admin and verifier!",
  );
  console.log("\nGrant ADMIN_ROLE:");
  console.log(
    `cast send $ROLE_MANAGER_ADDRESS "grantRoleByAdmin(bytes32,address)" \\`,
  );
  console.log(`  $(cast keccak "ADMIN_ROLE") \\`);
  console.log(`  ${TEST_USERS[0].walletAddress} \\`);
  console.log(`  --private-key $DEPLOYER_PRIVATE_KEY\n`);

  console.log("Grant VERIFIER_ROLE:");
  console.log(
    `cast send $ROLE_MANAGER_ADDRESS "grantRoleByAdmin(bytes32,address)" \\`,
  );
  console.log(`  $(cast keccak "VERIFIER_ROLE") \\`);
  console.log(`  ${TEST_USERS[1].walletAddress} \\`);
  console.log(`  --private-key $DEPLOYER_PRIVATE_KEY\n`);

  process.exit(0);
}

createTestUsers().catch((error) => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});
