import bcrypt from "bcryptjs";
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./connection.js";
import { users } from "./schema.js";

async function seed() {
  try {
    console.log("🌱 Database seeding...");

    // Hash passwords
    const adminPassword = await bcrypt.hash("admin123", 12);
    const subadminPassword = await bcrypt.hash("subadmin123", 12);
    const userPassword = await bcrypt.hash("password123", 12);
    const verifierPassword = await bcrypt.hash("verifier123", 12);

    // Check if admin already exists
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, "admin@rwachain.com"))
      .limit(1);

    if (existingAdmin.length === 0) {
      // Create admin user
      await db.insert(users).values({
        firstName: "Admin",
        lastName: "User",
        email: "admin@rwachain.com",
        password: adminPassword,
        walletAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        role: "admin",
        kycStatus: "approved",
        isWalletConnected: true,
        canChangePassword: true,
        createdByAdmin: false,
      });
      console.log("✅ Admin user created");
    } else {
      console.log("ℹ️ Admin user already exists");
    }

    // Check if subadmin already exists
    const existingSubadmin = await db
      .select()
      .from(users)
      .where(eq(users.email, "subadmin@rwachain.com"))
      .limit(1);

    if (existingSubadmin.length === 0) {
      // Create subadmin user
      await db.insert(users).values({
        firstName: "SubAdmin",
        lastName: "User",
        email: "subadmin@rwachain.com",
        password: subadminPassword,
        walletAddress: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        role: "subadmin",
        kycStatus: "approved",
        isWalletConnected: true,
        canChangePassword: true,
        createdByAdmin: true,
      });
      console.log("✅ SubAdmin user created");
    } else {
      console.log("ℹ️ SubAdmin user already exists");
    }

    // Check if test user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, "user@example.com"))
      .limit(1);

    if (existingUser.length === 0) {
      // Create test user
      await db.insert(users).values({
        firstName: "Test",
        lastName: "User",
        email: "user@example.com",
        password: userPassword,
        walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        role: "user",
        kycStatus: "not_submitted",
        isWalletConnected: true,
        canChangePassword: true,
        createdByAdmin: false,
      });
      console.log("✅ Test user created");
    } else {
      console.log("ℹ️ Test user already exists");
    }

    // Check if verifier already exists
    const existingVerifier = await db
      .select()
      .from(users)
      .where(eq(users.email, "verifier@rwachain.com"))
      .limit(1);

    if (existingVerifier.length === 0) {
      // Create verifier user
      await db.insert(users).values({
        firstName: "Verifier",
        lastName: "User",
        email: "verifier@rwachain.com",
        password: verifierPassword,
        walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        role: "verifier",
        kycStatus: "approved",
        isWalletConnected: true,
        canChangePassword: true,
        createdByAdmin: true,
      });
      console.log("✅ Verifier user created");
    } else {
      console.log("ℹ️ Verifier user already exists");
    }

    console.log("\n🎉 Seeding process completed!");
    console.log("\n📝 Sample credentials:");
    console.log("Admin:    admin@rwachain.com / admin123");
    console.log("SubAdmin: subadmin@rwachain.com / subadmin123");
    console.log("User:     user@example.com / password123");
    console.log("Verifier: verifier@rwachain.com / verifier123");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();
