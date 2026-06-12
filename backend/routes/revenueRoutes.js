import express from "express";
import {
  depositRevenueHandler,
  getAllDistributionsHandler,
  getAssetRevenueInfoHandler,
  getClaimHistoryHandler,
  getClaimableRevenueHandler,
  getPropertyRevenueHistoryAdminHandler,
  getTokenizedPropertiesForRevenueHandler,
  recordClaimHandler,
} from "../controllers/revenueController.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────
// ADMIN ROUTES (require admin role)
// ─────────────────────────────────────────────────────────────────

// List all revenue distributions
router.get(
  "/admin/distributions",
  authenticateToken,
  authorizeRoles("admin", "subadmin"),
  getAllDistributionsHandler,
);

// List tokenized properties with revenue info for admin deposit UI
router.get(
  "/admin/properties",
  authenticateToken,
  authorizeRoles("admin", "subadmin"),
  getTokenizedPropertiesForRevenueHandler,
);

// Deposit revenue for a property
router.post(
  "/admin/deposit",
  authenticateToken,
  authorizeRoles("admin"),
  depositRevenueHandler,
);

// Revenue history for specific property
router.get(
  "/admin/property/:propertyId/history",
  authenticateToken,
  authorizeRoles("admin", "subadmin"),
  getPropertyRevenueHistoryAdminHandler,
);

// Live blockchain revenue info for a property
router.get(
  "/admin/property/:propertyId/blockchain-info",
  authenticateToken,
  authorizeRoles("admin", "subadmin"),
  getAssetRevenueInfoHandler,
);

// ─────────────────────────────────────────────────────────────────
// INVESTOR ROUTES (require authentication)
// ─────────────────────────────────────────────────────────────────

// Get claimable revenue amounts for the logged-in investor
router.get("/claimable", authenticateToken, getClaimableRevenueHandler);

// Record a completed on-chain claim in the database
router.post("/record-claim", authenticateToken, recordClaimHandler);

// Get user's revenue claim history
router.get("/history", authenticateToken, getClaimHistoryHandler);

export default router;
