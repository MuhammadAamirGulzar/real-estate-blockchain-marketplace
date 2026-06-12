import express from "express";
import {
  activatePropertyForInvestment,
  approveKycRequest,
  approveVerifierApplication,
  assignVerifier,
  cleanupOrphanedIPFS,
  createInvestmentPoolHandler,
  createSubadmin,
  createVerifier,
  enableTokenTrading,
  getDashboardStats,
  // Transaction workflow management endpoints
  getFailedWorkflows,
  getKYCRequests,
  getOrphanedIPFSContent,
  getPendingPaymentsHandler,
  getProperties,
  // Tokenization endpoints
  getPropertiesForTokenization,
  getPropertyTokenizationDetails,
  getSubadmins,
  getTokenizationStatus,
  getUsers,
  getVerifierApplications,
  getVerifiers,
  getWorkflowDetails,
  reconcileKYC,
  registerPropertyOnBlockchain,
  rejectKycRequest,
  rejectVerifierApplication,
  retryWorkflow,
  tokenizeProperty,
  verifyPaymentHandler,
} from "../controllers/adminController.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Get dashboard stats
router.get(
  "/dashboard-stats",
  authenticateToken,
  authorizeRoles("admin", "subadmin"),
  getDashboardStats,
);

// Get KYC requests (admin and subadmin)
router.get(
  "/kyc-requests",
  authenticateToken,
  (req, res, next) => {
    if (req.user.role === "admin" || req.user.role === "subadmin") {
      next();
    } else {
      res
        .status(403)
        .json({ success: false, message: "Insufficient permissions" });
    }
  },
  getKYCRequests,
);

// Get verifier applications
router.get(
  "/verifier-applications",
  authenticateToken,
  authorizeRoles("admin"),
  getVerifierApplications,
);

// Get properties
router.get(
  "/properties",
  authenticateToken,
  authorizeRoles("admin", "subadmin"),
  getProperties,
);

// Get all users
router.get("/users", authenticateToken, authorizeRoles("admin"), getUsers);

// Get verifiers
router.get(
  "/verifiers",
  authenticateToken,
  authorizeRoles("admin", "subadmin"),
  getVerifiers,
);

// Get subadmins
router.get(
  "/subadmins",
  authenticateToken,
  authorizeRoles("admin"),
  getSubadmins,
);

// Approve/Reject KYC (admin and subadmin)
router.post(
  "/kyc/:id/approve",
  authenticateToken,
  (req, res, next) => {
    if (req.user.role === "admin" || req.user.role === "subadmin") {
      next();
    } else {
      res
        .status(403)
        .json({ success: false, message: "Insufficient permissions" });
    }
  },
  approveKycRequest,
);

router.post(
  "/kyc/:id/reject",
  authenticateToken,
  (req, res, next) => {
    if (req.user.role === "admin" || req.user.role === "subadmin") {
      next();
    } else {
      res
        .status(403)
        .json({ success: false, message: "Insufficient permissions" });
    }
  },
  rejectKycRequest,
);

// Reconcile KYC status with blockchain
router.post(
  "/kyc/:userId/reconcile",
  authenticateToken,
  authorizeRoles("admin", "subadmin"),
  reconcileKYC,
);

// Approve/Reject Verifier Application
router.post(
  "/verifier-application/:id/approve",
  authenticateToken,
  authorizeRoles("admin"),
  approveVerifierApplication,
);

router.post(
  "/verifier-application/:id/reject",
  authenticateToken,
  authorizeRoles("admin"),
  rejectVerifierApplication,
);

// Create subadmin
router.post(
  "/create-subadmin",
  authenticateToken,
  authorizeRoles("admin"),
  createSubadmin,
);

// Create verifier
router.post(
  "/create-verifier",
  authenticateToken,
  authorizeRoles("admin"),
  createVerifier,
);

// Register property on blockchain
router.post(
  "/property/:propertyId/register",
  authenticateToken,
  authorizeRoles("admin", "subadmin"),
  registerPropertyOnBlockchain,
);

// Assign verifier to property
router.post(
  "/property/:propertyId/assign-verifier",
  authenticateToken,
  authorizeRoles("admin", "subadmin"),
  assignVerifier,
);

// =============================================================================
// PROPERTY TOKENIZATION ROUTES (Admin Only)
// =============================================================================

// Get verified properties eligible for tokenization
router.get(
  "/properties/tokenization",
  authenticateToken,
  authorizeRoles("admin"),
  getPropertiesForTokenization,
);

// Get property tokenization details
router.get(
  "/properties/:propertyId/tokenization-details",
  authenticateToken,
  authorizeRoles("admin"),
  getPropertyTokenizationDetails,
);

// Tokenize a verified property
router.post(
  "/properties/:propertyId/tokenize",
  authenticateToken,
  authorizeRoles("admin"),
  tokenizeProperty,
);

// Get tokenization status
router.get(
  "/properties/:propertyId/tokenization-status",
  authenticateToken,
  authorizeRoles("admin"),
  getTokenizationStatus,
);

// Activate property for investment
router.post(
  "/properties/:nftTokenId/activate",
  authenticateToken,
  authorizeRoles("admin"),
  activatePropertyForInvestment,
);

// Enable trading for fractional tokens
router.post(
  "/tokens/:tokenAddress/enable-trading",
  authenticateToken,
  authorizeRoles("admin"),
  enableTokenTrading,
);

// ============================================================================
// TRANSACTION WORKFLOW MANAGEMENT
// ============================================================================

// Get all failed workflows
router.get(
  "/workflows/failed",
  authenticateToken,
  authorizeRoles("admin"),
  getFailedWorkflows,
);

// Get workflow details with all transactions
router.get(
  "/workflows/:workflowId",
  authenticateToken,
  authorizeRoles("admin"),
  getWorkflowDetails,
);

// Retry a failed workflow
router.post(
  "/workflows/:workflowId/retry",
  authenticateToken,
  authorizeRoles("admin"),
  retryWorkflow,
);

// ============================================================================
// IPFS CLEANUP MANAGEMENT
// ============================================================================

// Get all orphaned IPFS content
router.get(
  "/ipfs/orphaned",
  authenticateToken,
  authorizeRoles("admin"),
  getOrphanedIPFSContent,
);

// Manually trigger cleanup of orphaned IPFS content
router.post(
  "/ipfs/cleanup",
  authenticateToken,
  authorizeRoles("admin"),
  cleanupOrphanedIPFS,
);

// ============================================================================
// INVESTMENT POOL MANAGEMENT
// ============================================================================

// Create investment pool for tokenized property
router.post(
  "/properties/:propertyId/create-pool",
  authenticateToken,
  authorizeRoles("admin"),
  createInvestmentPoolHandler,
);

// ============================================================================
// PAYMENT VERIFICATION
// ============================================================================

// Get pending payment verifications
router.get(
  "/payments/pending",
  authenticateToken,
  authorizeRoles("admin", "subadmin"),
  getPendingPaymentsHandler,
);

// Verify payment proof (approve/reject)
router.post(
  "/payments/:investmentId/verify",
  authenticateToken,
  authorizeRoles("admin", "subadmin"),
  verifyPaymentHandler,
);

export default router;
