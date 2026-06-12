import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { blockchainSyncService } from "./services/blockchainSyncService.js";
import oracleService from "./services/oracleService.js";
import propertyPricingService from "./services/propertyPricingService.js";
import { web3Service } from "./services/web3Service.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === "production";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rawBodySaver = (req, res, buf) => {
  if (buf && buf.length) {
    req.rawBody = buf;
  }
};

// ─── Security Middleware ────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow any localhost origin in dev (handles Vite port changes: 5173, 5174, etc.)
      if (
        !origin ||
        /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
        origin === (process.env.FRONTEND_URL || "")
      ) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// General rate limiter (all routes)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});
// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
  },
});

app.use(generalLimiter);
app.use(express.json({ limit: "10mb", verify: rawBodySaver }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── Routes ─────────────────────────────────────────────────────────────────
import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import investmentRoutes from "./routes/investmentRoutes.js";
import kycRoutes from "./routes/kycRoutes.js";
import oracleRoutes from "./routes/oracleRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import portfolioRoutes from "./routes/portfolioRoutes.js";
import propertyRoutes from "./routes/propertiesRoutes.js";
import reconciliationRoutes from "./routes/reconciliation.js";
import revenueRoutes from "./routes/revenueRoutes.js";
import tradingRoutes from "./routes/tradingRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import verifierRoutes from "./routes/verifierRoutes.js";

// Apply strict rate limiter to auth endpoints
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/verifier", verifierRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/trading", tradingRoutes);
app.use("/api/investment", investmentRoutes);
app.use("/api/revenue", revenueRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/oracle", oracleRoutes);
app.use("/api/reconciliation", reconciliationRoutes);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    blockchainSync: blockchainSyncService.isListening,
  });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: isProduction ? "Internal server error" : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🚀 Server running on port ${PORT}\n`);

  // Initialize Web3 Service (for tokenization and blockchain interactions)
  try {
    await web3Service.initialize();
  } catch (error) {
    console.error("⚠️  Web3Service initialization failed:", error.message);
    console.log("   Tokenization features may not work properly.\n");
  }

  // Auto-initialize blockchain sync
  await blockchainSyncService.initialize();

  // Initialize oracle and property pricing services
  try {
    await oracleService.initialize();
    await propertyPricingService.initialize();
    // Seed initial exchange rates on startup (non-blocking)
    oracleService
      .updateDatabaseRates()
      .catch((e) =>
        console.warn("⚠️  Initial oracle rate seed failed:", e.message),
      );
  } catch (error) {
    console.warn("⚠️  Oracle service initialization failed:", error.message);
  }

  console.log("✅ Backend ready\n");
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down gracefully...");
  blockchainSyncService.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down gracefully...");
  blockchainSyncService.stop();
  process.exit(0);
});
