import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

config();

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

async function testConnection() {
  try {
    console.log("🔄 Testing database connection...");

    // Simple query
    const result = await client`SELECT NOW()`;
    console.log("✅ Database connected successfully!");
    console.log("   Server time:", result[0].now);

    // Count tables
    const tables = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log(`✅ Found ${tables.length} tables in database`);

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    process.exit(1);
  }
}

testConnection();
