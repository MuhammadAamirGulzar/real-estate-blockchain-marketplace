import bcrypt from "bcryptjs";
import { ethers } from "ethers";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

const ADMIN_WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const ADMIN_EMAIL = "admin@rwachain.com";
const ADMIN_PASSWORD = "admin123";

async function createAdmin() {
  try {
    console.log("🔧 Creating admin user...");

    // Check if admin exists
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, ADMIN_EMAIL))
      .limit(1);

    if (existing) {
      console.log("⚠️  Admin already exists, updating...");
      await db
        .update(users)
        .set({
          role: "admin",
          walletAddress: ADMIN_WALLET.toLowerCase(),
          isWalletConnected: true,
          kycStatus: "approved",
        })
        .where(eq(users.id, existing.id));
      console.log("✅ Admin updated in database");
      return;
    }

    // Create new admin
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const [admin] = await db
      .insert(users)
      .values({
        email: ADMIN_EMAIL,
        password: hashedPassword,
        firstName: "Super",
        lastName: "Admin",
        role: "admin",
        walletAddress: ADMIN_WALLET.toLowerCase(),
        isWalletConnected: true,
        kycStatus: "approved",
        createdByAdmin: true,
      })
      .returning();

    console.log("✅ Admin created in database");
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   Wallet: ${ADMIN_WALLET}`);
    console.log(`   ID: ${admin.id}`);
  } catch (error) {
    console.error("❌ Error creating admin:", error);
    throw error;
  }
}

createAdmin()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
