/**
 * One-time script: Apply schema fixes directly to the DB
 * - Add updated_at to users
 * - Drop NOT NULL on ipfs_hash / ipfs_url in property_documents, property_images, kyc_documents
 * Run: node scripts/apply-schema-fixes.mjs
 */
import { sql } from "drizzle-orm";
import { db } from "../db/connection.js";

const fixes = [
  {
    label: "users.updated_at column",
    sql: sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
  },
  {
    label: "property_documents.ipfs_hash DROP NOT NULL",
    sql: sql`ALTER TABLE property_documents ALTER COLUMN ipfs_hash DROP NOT NULL`,
  },
  {
    label: "property_documents.ipfs_url DROP NOT NULL",
    sql: sql`ALTER TABLE property_documents ALTER COLUMN ipfs_url DROP NOT NULL`,
  },
  {
    label: "property_images.ipfs_hash DROP NOT NULL",
    sql: sql`ALTER TABLE property_images ALTER COLUMN ipfs_hash DROP NOT NULL`,
  },
  {
    label: "property_images.ipfs_url DROP NOT NULL",
    sql: sql`ALTER TABLE property_images ALTER COLUMN ipfs_url DROP NOT NULL`,
  },
  {
    label: "kyc_documents.ipfs_hash DROP NOT NULL",
    sql: sql`ALTER TABLE kyc_documents ALTER COLUMN ipfs_hash DROP NOT NULL`,
  },
  {
    label: "kyc_documents.ipfs_url DROP NOT NULL",
    sql: sql`ALTER TABLE kyc_documents ALTER COLUMN ipfs_url DROP NOT NULL`,
  },
];

for (const fix of fixes) {
  try {
    await db.execute(fix.sql);
    console.log(`✅ ${fix.label}`);
  } catch (err) {
    // Column already correct / constraint already absent — safe to ignore
    if (
      err.message?.includes("does not exist") ||
      err.message?.includes("already exists")
    ) {
      console.log(`⏭  ${fix.label} — already in desired state`);
    } else {
      console.error(`❌ ${fix.label}: ${err.message}`);
    }
  }
}

console.log("\n✓ Schema fixes complete.");
process.exit(0);
