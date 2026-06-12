import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../.env") });

const ADMIN_WALLET = (process.env.ADMIN_WALLET_ADDRESS || process.env.ADMIN_ADDRESS || "").toLowerCase();
const ADMIN_EMAIL = "admin@rwachain.com";
const ORIGINAL_USER_EMAIL = "abc@gmail.com";

async function run() {
  if (!ADMIN_WALLET) {
    console.error("❌ ADMIN_WALLET_ADDRESS/ADMIN_ADDRESS not set in .env");
    process.exit(1);
  }
  try {
    console.log("🔄 Assigning wallet to admin:", ADMIN_WALLET);

    // Clear wallet from the original user if present
    const [{ count: clearedCount }] = await db
      .update(users)
      .set({ walletAddress: null, isWalletConnected: false })
      .where(eq(users.walletAddress, ADMIN_WALLET))
      .returning({ count: users.id });

    if (clearedCount !== undefined) {
      console.log(`✅ Cleared wallet from ${clearedCount ? 1 : 0} user(s)`);
    }

    // Ensure admin user exists
    const [admin] = await db
      .select()
      .from(users)
      .where(eq(users.email, ADMIN_EMAIL))
      .limit(1);

    if (!admin) {
      console.error("❌ Admin user not found. Run ensure-admin.js first.");
      process.exit(1);
    }

    // Assign wallet to admin
    const [updated] = await db
      .update(users)
      .set({
        walletAddress: ADMIN_WALLET,
        isWalletConnected: true,
        walletLinkedAt: new Date(),
        role: "admin",
        kycStatus: "approved",
      })
      .where(eq(users.id, admin.id))
      .returning({ id: users.id, email: users.email, walletAddress: users.walletAddress, role: users.role, kycStatus: users.kycStatus, isWalletConnected: users.isWalletConnected });

    console.log("✅ Admin updated:", updated);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error assigning wallet:", err);
    process.exit(1);
  }
}

run();
