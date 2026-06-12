import express from "express";
import adminRoutes from "./adminRoutes.js";
import authRoutes from "./authRoutes.js";
import investmentRoutes from "./investmentRoutes.js";
import kycRoutes from "./kycRoutes.js";
import oracleRoutes from "./oracleRoutes.js";
import paymentRoutes from "./paymentRoutes.js";
import portfolioRoutes from "./portfolioRoutes.js";
import propertiesRoutes from "./propertiesRoutes.js";
import reconciliationRoutes from "./reconciliation.js";
import revenueRoutes from "./revenueRoutes.js";
import tradingRoutes from "./tradingRoutes.js";
import userRoutes from "./userRoutes.js";
import verifierRoutes from "./verifierRoutes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/user", userRoutes); // Only this one; do NOT import userRoutes_new.js
router.use("/properties", propertiesRoutes);
router.use("/investment", investmentRoutes);
router.use("/portfolio", portfolioRoutes);
router.use("/kyc", kycRoutes);
router.use("/trading", tradingRoutes);
router.use("/admin", adminRoutes);
router.use("/verifier", verifierRoutes);
router.use("/reconciliation", reconciliationRoutes);
router.use("/payments", paymentRoutes);
router.use("/oracle", oracleRoutes);
router.use("/revenue", revenueRoutes);

router.get("/health", (_req, res) => res.json({ status: "ok" }));

export default router;
