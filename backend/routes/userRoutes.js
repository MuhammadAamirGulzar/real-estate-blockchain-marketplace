import express from "express";
import multer from "multer";
import path from "path";

import {
  applyVerifier,
  getUserKYCStatus,
  getUserProfile,
  getUserProperties,
  getUserStats,
  submitKYC,
  submitProperty,
  updateUserProfile,
} from "../controllers/userController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

import { and, eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  assetRegistry,
  kycSubmissions,
  properties,
  users,
  verifierApplications,
} from "../db/schema.js";
import {
  generateWalletNonce,
  disconnectWallet as svcDisconnectWallet,
  verifyWalletSignature,
} from "../services/walletAuthService.js";
import { web3Service } from "../services/web3Service.js";

// ---------- File upload setup for KYC ----------
// Use memory storage so we can upload directly to IPFS
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf/;
    const ok =
      allowed.test(file.mimetype) &&
      allowed.test(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error("Only .png, .jpg, .jpeg, .pdf allowed"), ok);
  },
});

const router = express.Router();

// ---------- User stats/profile ----------
router.get("/stats", authenticateToken, getUserStats);
router.get("/properties", authenticateToken, getUserProperties);
router.get("/profile", authenticateToken, getUserProfile);
router.put("/profile", authenticateToken, updateUserProfile);

// ---------- KYC ----------
router.get("/kyc-status", authenticateToken, getUserKYCStatus);
router.post(
  "/submit-kyc",
  authenticateToken,
  upload.fields([
    { name: "idDocument", maxCount: 1 },
    { name: "proofOfAddress", maxCount: 1 },
    { name: "selfieImage", maxCount: 1 },
  ]),
  submitKYC,
);
router.post("/update-kyc-tx", authenticateToken, async (req, res) => {
  try {
    const { transactionHash, blockNumber } = req.body;
    if (!transactionHash) {
      return res
        .status(400)
        .json({ success: false, message: "Transaction hash required" });
    }
    await db
      .update(kycSubmissions)
      .set({
        submissionTransactionHash: transactionHash,
        status: "pending", // Mark as pending now that blockchain confirmed
      })
      .where(eq(kycSubmissions.userId, req.user.id));
    res.json({ success: true, message: "Transaction hash updated" });
  } catch (err) {
    console.error("update-kyc-tx error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to update tx hash" });
  }
});

router.post("/kyc-tx-failed", authenticateToken, async (req, res) => {
  try {
    const { reason } = req.body;

    // Delete the awaiting_blockchain submission
    await db
      .delete(kycSubmissions)
      .where(
        and(
          eq(kycSubmissions.userId, req.user.id),
          eq(kycSubmissions.status, "awaiting_blockchain"),
        ),
      );

    console.log(
      `KYC blockchain submission failed for user ${req.user.id}: ${reason}`,
    );

    res.json({
      success: true,
      message: "KYC submission cleaned up successfully",
    });
  } catch (err) {
    console.error("kyc-tx-failed error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to cleanup failed submission",
    });
  }
});

// ---------- Verifier Application ----------
router.post(
  "/apply-verifier",
  authenticateToken,
  upload.single("documents"),
  applyVerifier,
);

router.post("/update-verifier-tx", authenticateToken, async (req, res) => {
  try {
    const { applicationId, transactionHash, blockNumber } = req.body;
    if (!transactionHash || !applicationId) {
      return res.status(400).json({
        success: false,
        message: "Application ID and transaction hash required",
      });
    }

    await db
      .update(verifierApplications)
      .set({
        approvalTransactionHash: transactionHash,
        status: "pending", // Mark as pending now that blockchain confirmed
      })
      .where(
        and(
          eq(verifierApplications.id, applicationId),
          eq(verifierApplications.userId, req.user.id),
        ),
      );

    console.log(
      `✅ Verifier application ${applicationId} updated with tx hash: ${transactionHash}`,
    );
    res.json({ success: true, message: "Transaction hash updated" });
  } catch (err) {
    console.error("update-verifier-tx error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to update tx hash" });
  }
});

router.post("/verifier-tx-failed", authenticateToken, async (req, res) => {
  try {
    const { reason } = req.body;

    // Delete the most recent awaiting_blockchain submission
    await db
      .delete(verifierApplications)
      .where(
        and(
          eq(verifierApplications.userId, req.user.id),
          eq(verifierApplications.status, "awaiting_blockchain"),
        ),
      );

    console.log(
      `🧹 Verifier application blockchain submission failed for user ${req.user.id}: ${reason}`,
    );

    res.json({
      success: true,
      message: "Verifier application cleaned up successfully",
    });
  } catch (err) {
    console.error("verifier-tx-failed error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to cleanup failed submission",
    });
  }
});

// ---------- Property Submission ----------
router.post(
  "/submit-property",
  authenticateToken,
  upload.single("documents"),
  submitProperty,
);

router.post("/update-property-tx", authenticateToken, async (req, res) => {
  try {
    const { propertyId, transactionHash, blockNumber, assetRegistryId } =
      req.body;
    if (!transactionHash || !propertyId) {
      return res.status(400).json({
        success: false,
        message: "Property ID and transaction hash required",
      });
    }

    console.log(
      `📝 Processing property ${propertyId} with asset registry ID: ${assetRegistryId}`,
    );

    // Step 1: Fetch property to get metadata and verify ownership
    const [property] = await db
      .select()
      .from(properties)
      .where(
        and(
          eq(properties.id, propertyId),
          eq(properties.listerId, req.user.id),
        ),
      );

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or unauthorized",
      });
    }

    console.log(`✅ Property found: ${property.title}`);

    // Step 2: Fetch user wallet address
    const [user] = await db
      .select({ walletAddress: users.walletAddress })
      .from(users)
      .where(eq(users.id, req.user.id));

    if (!user || !user.walletAddress) {
      return res.status(400).json({
        success: false,
        message:
          "Property owner wallet address not found. Please connect wallet.",
      });
    }

    console.log(`✅ Owner wallet: ${user.walletAddress}`);

    // Step 3: Create asset_registry record if assetRegistryId provided
    if (assetRegistryId) {
      console.log(
        `🔍 Checking if asset_registry record exists for asset ID: ${assetRegistryId}`,
      );

      // Check if record already exists
      const [existingAsset] = await db
        .select()
        .from(assetRegistry)
        .where(eq(assetRegistry.assetId, BigInt(assetRegistryId)));

      if (!existingAsset) {
        console.log(
          `📝 Creating new asset_registry record for asset ID: ${assetRegistryId}`,
        );

        // Create the asset_registry record
        await db.insert(assetRegistry).values({
          assetId: BigInt(assetRegistryId),
          ownerAddress: user.walletAddress.toLowerCase(),
          assetType: "real_estate_property",
          metadataUri: property.metadataUrl || "",
          isActive: true,
          createdAtChain: blockNumber ? BigInt(blockNumber) : null,
          syncedAt: new Date(),
          registrationTransactionHash: transactionHash,
        });

        console.log(
          `✅ Created asset_registry record for asset ID: ${assetRegistryId}`,
        );
      } else {
        console.log(
          `✅ Asset_registry record already exists for asset ID: ${assetRegistryId}`,
        );
      }
    }

    // Step 4: Update properties table
    await db
      .update(properties)
      .set({
        listingTransactionHash: transactionHash,
        assetRegistryId: assetRegistryId ? BigInt(assetRegistryId) : null,
        status: "pending_assignment", // Awaiting admin to assign verifier
      })
      .where(
        and(
          eq(properties.id, propertyId),
          eq(properties.listerId, req.user.id),
        ),
      );

    console.log(
      `✅ Property ${propertyId} updated with tx hash: ${transactionHash}`,
    );
    res.json({
      success: true,
      message: "Transaction hash updated",
      assetRegistryId: assetRegistryId,
    });
  } catch (err) {
    console.error("update-property-tx error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update tx hash",
      error: err.message,
    });
  }
});

router.post("/property-tx-failed", authenticateToken, async (req, res) => {
  try {
    const { reason } = req.body;

    // Delete the most recent awaiting_blockchain submission
    await db
      .delete(properties)
      .where(
        and(
          eq(properties.listerId, req.user.id),
          eq(properties.status, "awaiting_blockchain"),
        ),
      );

    console.log(
      `🧹 Property blockchain submission failed for user ${req.user.id}: ${reason}`,
    );

    res.json({
      success: true,
      message: "Property submission cleaned up successfully",
    });
  } catch (err) {
    console.error("property-tx-failed error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to cleanup failed submission",
    });
  }
});

// ---------- Wallet auth (nonce/sign/connect/status/sync) ----------

// Request a nonce for signature
router.post("/wallet/request-nonce", authenticateToken, async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res
        .status(400)
        .json({ success: false, message: "walletAddress is required" });
    }
    const result = await generateWalletNonce(walletAddress);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("wallet/request-nonce error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to generate nonce" });
  }
});

// Complete wallet connection
router.post("/wallet/connect", authenticateToken, async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;
    if (!walletAddress || !signature || !message) {
      return res.status(400).json({
        success: false,
        message: "walletAddress, signature and message are required",
      });
    }

    // Verify signature against last nonce
    let verify;
    try {
      console.log(
        `🔐 Verifying signature for user ${req.user.id} and wallet ${walletAddress}`,
      );
      verify = await verifyWalletSignature(
        walletAddress,
        signature,
        message,
        req.user.id,
      );
      console.log("✅ Signature verified for user:", req.user.id);
    } catch (verifyErr) {
      console.error("❌ Signature verification error:", verifyErr.message);
      return res.status(400).json({
        success: false,
        message: verifyErr.message || "Signature verification failed",
      });
    }

    if (!verify?.verified) {
      console.error("❌ Signature verification returned false");
      return res
        .status(400)
        .json({ success: false, message: "Signature verification failed" });
    }

    const lower = walletAddress.toLowerCase();

    // Enforce one wallet per user and uniqueness
    // Prevent two users sharing same wallet
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.walletAddress, lower))
      .limit(1)
      .then((r) => r[0]);
    if (existing && existing.id !== req.user.id) {
      return res.status(409).json({
        success: false,
        message: "This wallet is already linked to another account",
      });
    }

    // Store permanently in DB (persist wallet mapping)
    // Note: We preserve the existing user role from the database
    // Database role is the source of truth, not the blockchain
    await db
      .update(users)
      .set({
        walletAddress: lower,
        isWalletConnected: true,
        walletLinkedAt: new Date(),
        lastWalletSignature: signature,
      })
      .where(eq(users.id, req.user.id));

    // Return updated user object
    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, req.user.id),
    });

    return res.json({
      success: true,
      message: "Wallet connected successfully",
      walletAddress: lower,
      role: updatedUser.role,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        walletAddress: updatedUser.walletAddress,
        isWalletConnected: updatedUser.isWalletConnected,
      },
    });
  } catch (err) {
    console.error("wallet/connect error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to connect wallet" });
  }
});

// Disconnect wallet session (keep address persisted)
router.post("/wallet/disconnect", authenticateToken, async (req, res) => {
  try {
    await svcDisconnectWallet(req.user.id).catch(() => {});
    await db
      .update(users)
      .set({ isWalletConnected: false })
      .where(eq(users.id, req.user.id));
    return res.json({ success: true, message: "Wallet disconnected" });
  } catch (err) {
    console.error("wallet/disconnect error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to disconnect wallet" });
  }
});

// Wallet connection status
router.get("/wallet/status", authenticateToken, async (req, res) => {
  try {
    console.log(`🔍 Checking wallet status for user ${req.user.id}`);
    const user = await db
      .select({
        id: users.id,
        walletAddress: users.walletAddress,
        isWalletConnected: users.isWalletConnected,
        walletLinkedAt: users.walletLinkedAt,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1)
      .then((r) => r[0]);

    if (!user) {
      console.warn(`⚠️ User ${req.user.id} not found in DB`);
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    console.log(
      `✅ Wallet status for user ${req.user.id}: Connected=${user.isWalletConnected}, Addr=${user.walletAddress}`,
    );

    res.json({
      success: true,
      isConnected: Boolean(user.isWalletConnected && user.walletAddress),
      walletAddress: user.walletAddress || null,
      role: user.role || "user",
      connectedAt: user.walletLinkedAt || null,
    });
  } catch (err) {
    console.error("❌ wallet/status error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get wallet status",
      error: err.message,
    });
  }
});

// Sync role from blockchain to DB
router.post("/wallet/sync-role", authenticateToken, async (req, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user.id),
    });
    if (!user?.walletAddress) {
      return res
        .status(400)
        .json({ success: false, message: "No wallet linked to account" });
    }

    await web3Service.initialize().catch(() => {});
    let newRole = "user";
    try {
      const lower = user.walletAddress.toLowerCase();
      const hasAdmin = await web3Service.hasRole(
        await web3Service.contracts?.RoleManager?.DEFAULT_ADMIN_ROLE?.(),
        lower,
      );
      const isVerifier = await web3Service.hasRole(
        await web3Service.contracts?.RoleManager?.VERIFIER_ROLE?.(),
        lower,
      );
      if (hasAdmin) newRole = "admin";
      else if (isVerifier) newRole = "verifier";
    } catch {
      // keep default
    }

    const previousRole = user.role || "user";
    if (previousRole !== newRole) {
      await db
        .update(users)
        .set({ role: newRole })
        .where(eq(users.id, user.id));
    }

    return res.json({
      success: true,
      previousRole,
      currentRole: newRole,
    });
  } catch (err) {
    console.error("wallet/sync-role error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to sync role" });
  }
});

export default router;
