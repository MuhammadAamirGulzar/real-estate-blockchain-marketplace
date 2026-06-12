import express from "express";
import {
  approveProperty,
  confirmBlockchainVerification,
  getAssignedProperties,
  getPropertyForVerification,
  getVerificationHistory,
  getVerifierDashboard,
  rejectProperty,
  requestAdditionalInfo,
  submitVerificationChecklist,
  updateVerificationProgress,
} from "../controllers/verifierController.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Get verifier dashboard stats
router.get(
  "/stats",
  authenticateToken,
  authorizeRoles("verifier"),
  getVerifierDashboard,
);

// Get assigned properties
router.get(
  "/assigned-properties",
  authenticateToken,
  authorizeRoles("verifier"),
  getAssignedProperties,
);

// Get property details for verification
router.get(
  "/properties/:propertyId",
  authenticateToken,
  authorizeRoles("verifier"),
  getPropertyForVerification,
);

// Get verifier history
router.get(
  "/history",
  authenticateToken,
  authorizeRoles("verifier"),
  getVerificationHistory,
);

// Progress and checklist compatibility endpoints
router.put(
  "/properties/:propertyId/progress",
  authenticateToken,
  authorizeRoles("verifier"),
  updateVerificationProgress,
);
router.post(
  "/properties/:propertyId/checklist",
  authenticateToken,
  authorizeRoles("verifier"),
  submitVerificationChecklist,
);
router.post(
  "/properties/:propertyId/request-info",
  authenticateToken,
  authorizeRoles("verifier"),
  requestAdditionalInfo,
);

// Approve property
router.post(
  "/property/:propertyId/approve",
  authenticateToken,
  authorizeRoles("verifier"),
  approveProperty,
);

// Reject property
router.post(
  "/property/:propertyId/reject",
  authenticateToken,
  authorizeRoles("verifier"),
  rejectProperty,
);

// Confirm blockchain verification
router.post(
  "/property/:propertyId/confirm-blockchain",
  authenticateToken,
  authorizeRoles("verifier"),
  confirmBlockchainVerification,
);

export default router;
