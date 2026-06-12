import express from "express";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";
import { stateReconciliationService } from "../services/stateReconciliation.js";

const router = express.Router();

/**
 * GET /api/reconciliation/status
 * Get last reconciliation status and results
 */
router.get(
  "/status",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const status = stateReconciliationService.getLastResults();
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error("Error getting reconciliation status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get reconciliation status",
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/reconciliation/run
 * Trigger manual reconciliation
 */
router.post(
  "/run",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { autoFix = false } = req.body;

      // Check if reconciliation is already running
      if (stateReconciliationService.isReconciling) {
        return res.status(409).json({
          success: false,
          message: "Reconciliation already in progress",
        });
      }

      // Run reconciliation (async, don't block response)
      stateReconciliationService
        .reconcileAll(autoFix)
        .then((results) => {
          console.log("✅ Manual reconciliation completed:", results);
        })
        .catch((error) => {
          console.error("❌ Manual reconciliation failed:", error);
        });

      res.json({
        success: true,
        message: "Reconciliation started",
        autoFix,
      });
    } catch (error) {
      console.error("Error starting reconciliation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to start reconciliation",
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/reconciliation/report
 * Generate detailed reconciliation report
 */
router.post(
  "/report",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { autoFix = false } = req.body;

      // Generate report
      const report = await stateReconciliationService.generateReport(autoFix);

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      console.error("Error generating reconciliation report:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate reconciliation report",
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/reconciliation/kyc
 * Reconcile KYC statuses only
 */
router.post(
  "/kyc",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { autoFix = false } = req.body;

      await stateReconciliationService.reconcileKYCStatuses(autoFix);

      res.json({
        success: true,
        message: "KYC reconciliation completed",
        mismatches:
          stateReconciliationService.reconciliationResults.kycMismatches,
        fixed: autoFix
          ? stateReconciliationService.reconciliationResults.fixed
          : 0,
      });
    } catch (error) {
      console.error("Error reconciling KYC:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reconcile KYC statuses",
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/reconciliation/properties
 * Reconcile property statuses only
 */
router.post(
  "/properties",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { autoFix = false } = req.body;

      await stateReconciliationService.reconcilePropertyStatuses(autoFix);

      res.json({
        success: true,
        message: "Property reconciliation completed",
        mismatches:
          stateReconciliationService.reconciliationResults.propertyMismatches,
        fixed: autoFix
          ? stateReconciliationService.reconciliationResults.fixed
          : 0,
      });
    } catch (error) {
      console.error("Error reconciling properties:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reconcile property statuses",
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/reconciliation/roles
 * Reconcile user roles only
 */
router.post(
  "/roles",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { autoFix = false } = req.body;

      await stateReconciliationService.reconcileUserRoles(autoFix);

      res.json({
        success: true,
        message: "Role reconciliation completed",
        mismatches:
          stateReconciliationService.reconciliationResults.roleMismatches,
        fixed: autoFix
          ? stateReconciliationService.reconciliationResults.fixed
          : 0,
      });
    } catch (error) {
      console.error("Error reconciling roles:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reconcile user roles",
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/reconciliation/start-auto
 * Start automatic reconciliation on schedule
 */
router.post(
  "/start-auto",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { intervalMinutes = 60 } = req.body;

      stateReconciliationService.startAutoReconciliation(intervalMinutes);

      res.json({
        success: true,
        message: `Automatic reconciliation started (every ${intervalMinutes} minutes)`,
      });
    } catch (error) {
      console.error("Error starting auto-reconciliation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to start automatic reconciliation",
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/reconciliation/stop-auto
 * Stop automatic reconciliation
 */
router.post(
  "/stop-auto",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      stateReconciliationService.stopAutoReconciliation();

      res.json({
        success: true,
        message: "Automatic reconciliation stopped",
      });
    } catch (error) {
      console.error("Error stopping auto-reconciliation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to stop automatic reconciliation",
        error: error.message,
      });
    }
  },
);

export default router;
