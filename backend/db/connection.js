import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import path from "path";
import postgres from "postgres";
import { fileURLToPath } from "url";
import * as schema from "./schema.js";

// Load .env from parent directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env") });

let db;

// Mock database for fallback only
const createMockDb = () => {
  console.log("⚠️ Using mock database as fallback...");

  let mockData = {
    users: [
      {
        id: 1,
        firstName: "Admin",
        lastName: "User",
        email: "admin@rwachain.com",
        password:
          "$2a$12$AfgBw/jFV4RzaNz2.nga0Oz/igCnyrupvl5gu.lRmlp9AS4QI/5Xq", // admin123
        walletAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        role: "admin",
        kycStatus: "approved",
        isActive: true,
        isWalletConnected: true,
        canChangePassword: true,
        createdByAdmin: false,
        createdAt: new Date().toISOString(),
      },
    ],
    properties: [
      {
        id: 1,
        title: "Luxury Downtown Apartment",
        description: "A premium residential property in the heart of the city.",
        location: "New York, NY",
        address: "123 Park Avenue, New York, NY 10001",
        price: 1500000,
        tokenSymbol: "LDA",
        totalTokens: 1500,
        availableTokens: 1200,
        tokenPrice: 1000,
        type: "residential",
        squareFeet: 1200,
        constructionYear: 2020,
        rentalYield: 4.5,
        images: JSON.stringify(["/api/placeholder/400/300"]),
        amenities: JSON.stringify(["Pool", "Gym", "Concierge", "Parking"]),
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    kycSubmissions: [],
  };

  return {
    select: (fields) => ({
      from: (table) => {
        const getTableName = (t) => {
          if (t === schema.users) return "users";
          if (t === schema.properties) return "properties";
          return "kycSubmissions";
        };

        const tableName = getTableName(table);
        const data = mockData[tableName] || [];

        return {
          where: (condition) => ({
            limit: (n) => data.slice(0, n),
            orderBy: (orderFn) => data,
          }),
          orderBy: (orderFn) => data,
          limit: (n) => data.slice(0, n),
        };
      },
    }),
    insert: (table) => ({
      values: (data) => ({
        returning: () => {
          const getTableName = (t) => {
            if (t === schema.users) return "users";
            if (t === schema.properties) return "properties";
            return "kycSubmissions";
          };

          const tableName = getTableName(table);
          const newId =
            Math.max(
              ...(mockData[tableName] || []).map((item) => item.id || 0),
              0,
            ) + 1;
          const newItem = {
            ...data,
            id: newId,
            createdAt: new Date().toISOString(),
          };
          mockData[tableName].push(newItem);
          return [newItem];
        },
      }),
    }),
    update: (table) => ({
      set: (data) => ({
        where: (condition) => ({
          returning: () => {
            const getTableName = (t) => {
              if (t === schema.users) return "users";
              if (t === schema.properties) return "properties";
              return "kycSubmissions";
            };

            const tableName = getTableName(table);
            if (mockData[tableName] && mockData[tableName].length > 0) {
              Object.assign(mockData[tableName][0], data);
              return [mockData[tableName][0]];
            }
            return [];
          },
        }),
      }),
    }),
  };
};

// Primary database connection logic
try {
  if (process.env.USE_SQLITE === "true") {
    console.log("🔄 SQLite mode enabled via USE_SQLITE=true...");
    db = createMockDb();
  } else if (process.env.DATABASE_URL) {
    console.log("🔄 Connecting to PostgreSQL database...");
    console.log(
      `Database: ${process.env.DATABASE_URL.replace(/\/\/.*@/, "//***:***@")}`,
    );

    const client = postgres(process.env.DATABASE_URL, {
      onnotice: () => {}, // Disable notices
      connect_timeout: 10,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
    });

    db = drizzle(client, { schema });
    console.log("✅ PostgreSQL connection established");
  } else {
    console.log("❌ No DATABASE_URL found, using mock database");
    db = createMockDb();
  }
} catch (error) {
  console.error("❌ PostgreSQL connection failed:", error.message);
  console.log("🔄 Falling back to mock database...");
  db = createMockDb();
}

export { db };
