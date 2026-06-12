import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./db/connection.js";
import { users } from "./db/schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env") });

/**
 * Ensures admin user exists with correct credentials and role
 * Run this script after contract deployments to maintain admin access
 */
async function ensureAdminUser() {
  const ADMIN_EMAIL = "admin@rwachain.com";
  const ADMIN_PASSWORD = "admin123";
  const ADMIN_WALLET = (process.env.ADMIN_WALLET_ADDRESS || process.env.ADMIN_ADDRESS)?.toLowerCase();

  try {
    console.log("🔍 Checking for admin user...");

    // Check if admin user exists
    const [existingAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.email, ADMIN_EMAIL))
      .limit(1);

    if (existingAdmin) {
      console.log("📋 Admin user found:", {
        id: existingAdmin.id,
        email: existingAdmin.email,
        role: existingAdmin.role,
        kycStatus: existingAdmin.kycStatus,
        walletAddress: existingAdmin.walletAddress,
        isWalletConnected: existingAdmin.isWalletConnected,
      });

      // Check if wallet is needed and available
      let updateWallet = false;
      if (ADMIN_WALLET && !existingAdmin.walletAddress) {
        // Check if wallet is available
        const [walletInUse] = await db
          .select()
          .from(users)
          .where(eq(users.walletAddress, ADMIN_WALLET))
          .limit(1);
        
        if (!walletInUse) {
          updateWallet = true;
        } else {
          console.log(`⚠️ Wallet ${ADMIN_WALLET} is already connected to user ID ${walletInUse.id}`);
        }
      }

      // Ensure admin has correct role, KYC status, and optionally wallet
      const needsUpdate =
        existingAdmin.role !== "admin" ||
        existingAdmin.kycStatus !== "approved" ||
        updateWallet;

      if (needsUpdate) {
        console.log("⚠️ Updating admin user with correct privileges...");
        
        const updateData = {
          role: "admin",
          kycStatus: "approved",
          canChangePassword: true,
        };

        if (updateWallet) {
          updateData.walletAddress = ADMIN_WALLET;
          updateData.isWalletConnected = true;
          updateData.walletLinkedAt = new Date();
        }

        await db
          .update(users)
          .set(updateData)
          .where(eq(users.id, existingAdmin.id));

        const [updatedAdmin] = await db
          .select()
          .from(users)
          .where(eq(users.id, existingAdmin.id))
          .limit(1);

        console.log("✅ Admin user updated:", {
          id: updatedAdmin.id,
          email: updatedAdmin.email,
          role: updatedAdmin.role,
          kycStatus: updatedAdmin.kycStatus,
          walletAddress: updatedAdmin.walletAddress,
          isWalletConnected: updatedAdmin.isWalletConnected,
        });
      } else {
        console.log("✅ Admin user already has correct configuration");
      }
    } else {
      console.log("⚠️ Admin user not found, creating...");

      // Hash password
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

      // Check if wallet is available
      let useWallet = null;
      let walletConnected = false;
      
      if (ADMIN_WALLET) {
        const [walletInUse] = await db
          .select()
          .from(users)
          .where(eq(users.walletAddress, ADMIN_WALLET))
          .limit(1);
        
        if (!walletInUse) {
          useWallet = ADMIN_WALLET;
          walletConnected = true;
          console.log("✅ Will connect admin wallet");
        } else {
          console.log(`⚠️ Wallet ${ADMIN_WALLET} is already in use by user ID ${walletInUse.id}`);
          console.log("   Creating admin without wallet connection");
        }
      }

      // Create admin user with full privileges
      const [newAdmin] = await db
        .insert(users)
        .values({
          email: ADMIN_EMAIL,
          password: hashedPassword,
          firstName: "System",
          lastName: "Admin",
          role: "admin",
          kycStatus: "approved",
          walletAddress: useWallet,
          isWalletConnected: walletConnected,
          walletLinkedAt: walletConnected ? new Date() : null,
          canChangePassword: true,
          createdByAdmin: false,
        })
        .returning();

      console.log("✅ Admin user created:", {
        id: newAdmin.id,
        email: newAdmin.email,
        role: newAdmin.role,
        kycStatus: newAdmin.kycStatus,
        walletAddress: newAdmin.walletAddress,
        isWalletConnected: newAdmin.isWalletConnected,
      });
    }

    console.log("\n✅ Admin user is ready!");
    console.log("\n📋 Admin Credentials:");
    console.log("   📧 Email: admin@rwachain.com");
    console.log("   🔑 Password: admin123");
    if (ADMIN_WALLET) {
      console.log("   👛 Wallet: " + ADMIN_WALLET);
    }
    console.log("\n🔐 Admin Privileges:");
    console.log("   ✅ Role: admin");
    console.log("   ✅ KYC Status: approved");
    console.log("   ✅ Wallet Connected: true");
    console.log("   ✅ Can manage users, properties, and verifications");
    console.log("   ✅ Can access admin dashboard");
    console.log("   ✅ Can approve/reject KYC submissions");
    console.log("\n⚠️ Remember to change the admin password in production!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error ensuring admin user:", error);
    process.exit(1);
  }
}

ensureAdminUser();
