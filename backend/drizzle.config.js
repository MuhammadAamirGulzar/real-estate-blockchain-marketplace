/**
 * Drizzle ORM Configuration
 *
 * Database schema management and migrations
 * Uses PostgreSQL with environment variables
 *
 * Environment Variables Required:
 * - DATABASE_URL: PostgreSQL connection string
 *
 * @type {import('drizzle-kit').Config}
 */
import "dotenv/config";

export default {
  /**
   * Schema Location
   * Where Drizzle ORM table definitions are located
   */
  schema: "./db/schema.js",

  /**
   * Output Directory
   * Where migrations and metadata are generated
   */
  out: "./drizzle",

  /**
   * Database Dialect
   * PostgreSQL for production-grade reliability
   */
  dialect: "postgresql",

  /**
   * Database Credentials
   * Uses DATABASE_URL from environment variables
   * Format: postgresql://user:password@host:port/database
   */
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },

  /**
   * Verbose Output
   * Logs detailed migration information
   */
  verbose: true,

  /**
   * Strict Mode
   * Enforces strict migration validation
   */
  strict: true,
};
