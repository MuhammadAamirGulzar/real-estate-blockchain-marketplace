import bcrypt from "bcryptjs";
import { and, desc, eq, sql } from "drizzle-orm";
import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/connection.js";
import {
  investments,
  kycDocuments,
  kycSubmissions,
  properties,
  propertyDocuments,
  users,
  verifierApplications,
} from "../db/schema.js";
import ipfsCleanupService from "../services/ipfsCleanup.service.js";
import {
  getIPFSGatewayURL,
  uploadMetadataToIPFS,
  uploadToIPFS,
} from "../services/ipfsService.js";
import * as propertyService from "../services/propertyService.js";
import {
  findUserById,
  updateUserProfile as updateUserProfileService,
} from "../services/userService.js";
import { web3Service } from "../services/web3Service.js";
/**
 * Get current authenticated user's profile
 * GET /api/users/me
 */
export const getMe = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const user = await findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        walletAddress: user.walletAddress,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        kycStatus: user.kycStatus,
        profilePictureUrl: user.profilePictureUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user profile",
      error: error.message,
    });
  }
};

/**
 * Update current user's profile
 * PUT /api/users/me
 */
export const updateMyProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { firstName, lastName, email, profilePictureUrl } = req.body;

    // Validate input
    if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) updateData.email = email;
    if (profilePictureUrl) updateData.profilePictureUrl = profilePictureUrl;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    const updatedUser = await updateUserProfileService(req.user.id, updateData);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: updatedUser.id,
        walletAddress: updatedUser.walletAddress,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        kycStatus: updatedUser.kycStatus,
        profilePictureUrl: updatedUser.profilePictureUrl,
      },
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    });
  }
};

/**
 * Get user by ID (admin only)
 * GET /api/users/:id
 */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID parameter
    const userId = parseInt(id);
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await findUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
      error: error.message,
    });
  }
};

/**
 * Get all users (admin only)
 * GET /api/users
 */
export const getAllUsers = async (req, res) => {
  try {
    const allUsers = await db.query.users.findMany({
      orderBy: (users, { desc }) => [desc(users.createdAt)],
    });

    res.status(200).json({
      success: true,
      count: allUsers.length,
      data: allUsers,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};

/**
 * Get users by role (admin only)
 * GET /api/users?role=verifier
 */
export const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.query;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Role parameter is required",
      });
    }

    // Validate role is one of the allowed values
    const validRoles = ["user", "verifier", "subadmin", "admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be one of: " + validRoles.join(", "),
      });
    }

    const usersByRole = await db.query.users.findMany({
      where: eq(users.role, role),
    });

    res.status(200).json({
      success: true,
      role,
      count: usersByRole.length,
      data: usersByRole,
    });
  } catch (error) {
    console.error("Error fetching users by role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};

// Submit a property for tokenization (user)
export const submitProperty = async (req, res) => {
  const workflowId = uuidv4(); // Generate workflow ID for tracking
  let documentCid = null;
  let metadataCid = null;

  try {
    const {
      title = "",
      description = "",
      location = "",
      value,
      propertyType = "",
      walletAddress = "",
    } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "Property document is required" });
    }

    if (!title || !location || !value) {
      return res.status(400).json({
        success: false,
        message: "Title, location, and value are required",
      });
    }

    const propertyValue = Number(value);
    if (!Number.isFinite(propertyValue) || propertyValue <= 0) {
      return res.status(400).json({
        success: false,
        message: "Property value must be a positive number",
      });
    }

    console.log(`\n📁 Starting property submission workflow: ${workflowId}\n`);

    // Step 1: Upload document to IPFS and track as pending
    console.log("📤 Step 1: Uploading document to IPFS...");
    const fileBuffer = req.file.buffer;
    const originalName = req.file.originalname || "document";
    const ipfsHash = await uploadToIPFS(fileBuffer, originalName, {
      allowedTypes: ["pdf", "png", "jpg", "jpeg"],
      maxSize: 10 * 1024 * 1024,
      requireIPFS: false,
    });
    documentCid = ipfsHash;

    // Track document upload in database
    await ipfsCleanupService.trackIPFSUpload({
      cid: documentCid,
      status: "pending",
      workflowId,
      contentType: "property_document",
      fileName: originalName,
      fileSize: req.file.size,
      uploaderUserId: req.user.id,
      relatedEntityType: "property",
      metadata: { mimeType: req.file.mimetype },
    });
    console.log(`✅ Document uploaded and tracked: ${documentCid}`);

    // Step 2: Upload metadata to IPFS and track as pending
    console.log("📤 Step 2: Uploading metadata to IPFS...");
    const metadata = {
      title,
      description,
      location,
      value: propertyValue,
      propertyType,
      walletAddress,
      document: {
        name: originalName,
        size: req.file.size,
        mimeType: req.file.mimetype,
        ipfsHash,
      },
      submittedAt: new Date().toISOString(),
    };

    const metadataUpload = await uploadMetadataToIPFS(
      metadata,
      `property-${Date.now()}.json`,
    );

    if (!metadataUpload?.ipfsHash) {
      throw new Error("Failed to upload metadata to IPFS");
    }
    metadataCid = metadataUpload.ipfsHash;

    // Track metadata upload in database
    await ipfsCleanupService.trackIPFSUpload({
      cid: metadataCid,
      status: "pending",
      workflowId,
      contentType: "property_metadata",
      fileName: `property-${Date.now()}.json`,
      fileSize: metadataUpload.fileSize,
      uploaderUserId: req.user.id,
      relatedEntityType: "property",
      metadata: { metadataUrl: metadataUpload.ipfsUrl },
    });
    console.log(`✅ Metadata uploaded and tracked: ${metadataCid}`);

    // Step 3: Create property record with awaiting_blockchain status
    console.log("📝 Step 3: Creating property record in database...");

    // Create property record in database (blockchain submission will be handled by frontend)
    const newProperty = await propertyService.createProperty({
      listerId: req.user.id,
      title,
      description,
      location,
      propertyValue: propertyValue.toString(),
      propertyType,
      metadataUrl: metadataUpload.ipfsUrl,
      assetRegistryId: null, // Will be updated after blockchain confirmation
      status: "awaiting_blockchain",
      listingTransactionHash: null, // Will be updated after frontend blockchain submission
      submissionSignature: null,
      submissionMessage: null,
    });

    // Store document reference
    const documentUrl = getIPFSGatewayURL(ipfsHash);

    await db.insert(propertyDocuments).values({
      propertyId: newProperty.id,
      documentType: "supporting_document",
      fileName: originalName,
      fileSize: req.file.size,
      mimeType: req.file.mimetype || "application/octet-stream",
      ipfsHash,
      ipfsUrl: documentUrl,
    });

    console.log(`✅ Property created in database with ID: ${newProperty.id}`);
    console.log(
      "📤 Returning metadata hash to frontend for blockchain submission...",
    );

    return res.status(201).json({
      success: true,
      message:
        "Property data uploaded successfully. Please sign the blockchain transaction.",
      metadataHash: metadataUpload.ipfsHash,
      data: {
        propertyId: newProperty.id,
        metadataUrl: metadataUpload.ipfsUrl,
        status: "awaiting_blockchain",
      },
    });
  } catch (error) {
    console.error("Error submitting property:", error);

    // Cleanup IPFS uploads if blockchain transaction failed
    if (documentCid || metadataCid) {
      console.log("🧹 Cleaning up IPFS uploads due to transaction failure...");

      try {
        // Mark workflow uploads as orphaned and attempt cleanup
        const cleanupResult =
          await ipfsCleanupService.cleanupFailedWorkflow(workflowId);
        console.log(
          `✅ Cleanup complete: ${cleanupResult.success} succeeded, ${cleanupResult.failed} failed`,
        );
      } catch (cleanupError) {
        console.error("❌ IPFS cleanup failed:", cleanupError.message);
        // Don't fail the error response if cleanup fails
      }
    }

    return res.status(500).json({
      success: false,
      message: "Failed to submit property",
      error: error.message,
    });
  }
};

/**
 * Update user role (admin only)
 * PUT /api/users/:id/role
 */
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ["user", "admin", "verifier", "asset_lister"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
      });
    }

    // Get user to check wallet address and current role
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(id)))
      .limit(1);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.walletAddress) {
      return res.status(400).json({
        success: false,
        message: "User must have a connected wallet to grant blockchain role",
      });
    }

    // Map role to blockchain role constant
    const roleMapping = {
      user: ethers.id("USER_ROLE"),
      admin: ethers.id("SUB_ADMIN_ROLE"),
      verifier: ethers.id("VERIFIER_ROLE"),
      asset_lister: ethers.id("USER_ROLE"), // Asset listers are users with special DB privileges
    };

    const blockchainRole = roleMapping[role];
    const oldBlockchainRole = roleMapping[user.role];

    // Grant new role on blockchain and update DB atomically
    const result = await web3Service.executeTransaction({
      contract: "RoleManager",
      function: "grantRoleByAdmin",
      args: [blockchainRole, user.walletAddress],
      dbOperation: async (receipt) => {
        // If role changed, we should also revoke the old role
        // But for simplicity, we'll just grant the new one
        // Multiple roles can coexist in AccessControl

        const [updatedUser] = await db
          .update(users)
          .set({
            role,
            roleGrantTransactionHash: receipt.transactionHash,
          })
          .where(eq(users.id, parseInt(id)))
          .returning();

        console.log(
          `✅ User ${user.email} role updated to ${role} in database`,
        );
        return updatedUser;
      },
      relatedEntity: { type: "user", id: parseInt(id) },
    });

    console.log(
      `✅ Role updated on blockchain. Transaction: ${result.transactionHash}`,
    );

    res.status(200).json({
      success: true,
      message: "User role updated successfully",
      transactionHash: result.transactionHash,
      data: result.dbResult,
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user role",
      error: error.message,
    });
  }
};

/**
 * Delete user (admin only - soft delete)
 * DELETE /api/users/:id
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db
      .update(users)
      .set({ isActive: false })
      .where(eq(users.id, parseInt(id)))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    });
  }
};

export const changePassword = async (req, res) => {
  const userId = req.user.id;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({
      message: "Old password and new password are required",
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      message: "New password must be at least 6 characters long",
    });
  }

  try {
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const isOldPasswordValid = await bcrypt.compare(
      oldPassword,
      currentUser.passwordHash,
    );
    if (!isOldPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    const [updatedUser] = await db
      .update(users)
      .set({ passwordHash: newPasswordHash })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        walletAddress: users.walletAddress,
        role: users.role,
        kycStatus: users.kycStatus,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    res.status(200).json({
      message: "Password changed successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({
      message: "Failed to change password",
      error: error.message,
    });
  }
};

export const updateWalletAddress = async (req, res) => {
  const userId = req.user.id;
  const { walletAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ message: "Wallet address is required" });
  }

  const walletRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!walletRegex.test(walletAddress)) {
    return res.status(400).json({ message: "Invalid wallet address format" });
  }

  try {
    const existingWallet = await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, walletAddress))
      .limit(1);

    if (existingWallet.length > 0 && existingWallet[0].id !== userId) {
      return res.status(409).json({
        message: "This wallet address is already connected to another account",
      });
    }

    let role = "user";
    if (walletAddress === process.env.ADMIN_WALLET_ADDRESS) {
      role = "admin";
    }

    const [updatedUser] = await db
      .update(users)
      .set({ walletAddress, role })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        walletAddress: users.walletAddress,
        role: users.role,
        kycStatus: users.kycStatus,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    res.status(200).json({
      message: "Wallet address updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating wallet address:", error);
    res.status(500).json({
      message: "Failed to update wallet address",
      error: error.message,
    });
  }
};

// GET /api/user/stats
export async function getUserStats(req, res) {
  try {
    const userId = req.user.id;

    // Use db.select() (Core API) — avoids relational-query ambiguity issues
    const [user] = await db
      .select({
        id: users.id,
        kycStatus: users.kycStatus,
        walletAddress: users.walletAddress,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // Count ALL user properties (all statuses — pending, verified, active, etc.)
    const [propCount] = await db
      .select({ count: sql`count(*)::int` })
      .from(properties)
      .where(eq(properties.listerId, userId));

    // Count user investments
    const [invCount] = await db
      .select({ count: sql`count(*)::int` })
      .from(investments)
      .where(eq(investments.userId, userId));

    // Get latest verifier application status
    const [verifierApp] = await db
      .select({ status: verifierApplications.status })
      .from(verifierApplications)
      .where(eq(verifierApplications.userId, userId))
      .orderBy(desc(verifierApplications.createdAt))
      .limit(1);

    const verifierStatus = verifierApp?.status || "none";
    const propertyCount = Number(propCount?.count ?? 0);
    const investmentCount = Number(invCount?.count ?? 0);

    return res.json({
      success: true,
      data: {
        kycStatus: user.kycStatus || "not_submitted",
        walletConnected: Boolean(user.walletAddress),
        verifierStatus,
        properties: propertyCount,
        investments: investmentCount,
        totalProperties: propertyCount,
        activeInvestments: investmentCount,
        totalInvested: 0,
      },
    });
  } catch (err) {
    console.error("getUserStats error:", err.message, err.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user stats",
      error: err.message,
    });
  }
}

// GET /api/user/properties  — all properties submitted by the authenticated user
export async function getUserProperties(req, res) {
  try {
    const userId = req.user.id;

    const rows = await db
      .select({
        id: properties.id,
        title: properties.title,
        location: properties.location,
        city: properties.city,
        status: properties.status,
        propertyType: properties.propertyType,
        propertyValue: properties.propertyValue,
        imageUrls: properties.imageUrls,
        createdAt: properties.createdAt,
      })
      .from(properties)
      .where(eq(properties.listerId, userId))
      .orderBy(desc(properties.createdAt));

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getUserProperties error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user properties",
      error: err.message,
    });
  }
}

// GET /api/user/profile
export async function getUserProfile(req, res) {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user.id),
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        kycStatus: true,
        walletAddress: true,
        role: true,
        isWalletConnected: true,
        createdAt: true,
      },
    });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    return res.json({ success: true, data: user });
  } catch (err) {
    console.error("getUserProfile error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch user profile" });
  }
}

// PUT /api/user/profile - Simplified version for routes
export async function updateUserProfile(req, res) {
  try {
    const { firstName, lastName } = req.body;
    await db
      .update(users)
      .set({ firstName, lastName })
      .where(eq(users.id, req.user.id));
    return res.json({ success: true, message: "Profile updated successfully" });
  } catch (err) {
    console.error("updateUserProfile error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update user profile" });
  }
}

// GET /api/user/kyc-status
export async function getUserKYCStatus(req, res) {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user.id),
    });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    let submission = null;
    try {
      const rows = await db
        .select()
        .from(kycSubmissions)
        .where(eq(kycSubmissions.userId, req.user.id))
        .orderBy(desc(kycSubmissions.id))
        .limit(1);
      submission = rows?.[0] || null;
    } catch {
      submission = null;
    }

    let blockchainVerified = false;
    try {
      if (user.walletAddress) {
        await web3Service.initialize().catch(() => {});
        blockchainVerified = await web3Service.isKycApproved(
          user.walletAddress,
        );
      }
    } catch {
      blockchainVerified = false;
    }

    const submissionStatus = submission?.status || "not_submitted";
    const userStatus = user.kycStatus || "not_submitted";

    // Prefer approved if either on-chain status or users.kyc_status is already approved.
    let effectiveStatus = submissionStatus;
    if (
      blockchainVerified ||
      userStatus === "approved" ||
      submissionStatus === "approved"
    ) {
      effectiveStatus = "approved";
    }

    return res.json({
      success: true,
      data: {
        submitted: Boolean(submission),
        status: effectiveStatus,
        submissionStatus,
        userStatus,
        submittedAt: submission?.submittedAt || submission?.createdAt || null,
        reviewedAt: submission?.reviewedAt || submission?.updatedAt || null,
        blockchainVerified,
      },
    });
  } catch (err) {
    console.error("getUserKYCStatus error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch KYC status" });
  }
}

// POST /api/user/submit-kyc
// Wallet endpoints
export async function requestWalletNonce(req, res) {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid wallet address" });
    }

    const crypto = await import("crypto");
    const nonce = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db
      .update(users)
      .set({ walletNonce: nonce, walletNonceExpiry: expiresAt })
      .where(eq(users.id, req.user.id));

    const message = `Sign this message to connect your wallet to RWAchain:\n\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}`;

    res.json({ success: true, nonce, message, expiresAt });
  } catch (error) {
    console.error("requestWalletNonce error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to generate nonce" });
  }
}

export async function connectWallet(req, res) {
  try {
    const userId = req.user.id;
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const { ethers } = await import("ethers");
    const recoveredAddress = ethers
      .verifyMessage(message, signature)
      .toLowerCase();

    if (recoveredAddress !== walletAddress.toLowerCase()) {
      return res
        .status(400)
        .json({ success: false, message: "Signature mismatch" });
    }

    const existingUser = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.walletAddress, walletAddress.toLowerCase()),
          sql`${users.id} != ${userId}`,
        ),
      )
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Wallet already connected to another account",
      });
    }

    // Get current user to preserve existing role
    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const preservedRole = currentUser[0]?.role || "user";

    // Note: We preserve the database role instead of overwriting with blockchain role
    // Database role is the source of truth for access control
    await db
      .update(users)
      .set({
        walletAddress: walletAddress.toLowerCase(),
        isWalletConnected: true,
        walletLinkedAt: new Date(),
        lastWalletSignature: signature,
        walletNonce: null,
        walletNonceExpiry: null,
      })
      .where(eq(users.id, userId));

    res.json({
      success: true,
      message: "Wallet connected",
      walletAddress: walletAddress.toLowerCase(),
      role: preservedRole,
    });
  } catch (error) {
    console.error("connectWallet error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to connect wallet" });
  }
}

export async function disconnectWallet(req, res) {
  try {
    await db
      .update(users)
      .set({
        isWalletConnected: false,
        lastWalletSignature: null,
        walletNonce: null,
        walletNonceExpiry: null,
      })
      .where(eq(users.id, req.user.id));

    res.json({ success: true, message: "Wallet disconnected" });
  } catch (error) {
    console.error("disconnectWallet error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to disconnect wallet" });
  }
}

export async function getWalletStatus(req, res) {
  try {
    const user = await db
      .select({
        walletAddress: users.walletAddress,
        isWalletConnected: users.isWalletConnected,
        walletLinkedAt: users.walletLinkedAt,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1)
      .then((r) => r[0]);

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.json({
      success: true,
      walletAddress: user.walletAddress,
      isConnected: user.isWalletConnected,
      connectedAt: user.walletLinkedAt,
      role: user.role,
    });
  } catch (error) {
    console.error("getWalletStatus error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch wallet status" });
  }
}

export async function syncRoleFromBlockchain(req, res) {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user.id),
    });
    if (!user?.walletAddress) {
      return res
        .status(400)
        .json({ success: false, message: "No wallet connected" });
    }

    await web3Service.ensureInitialized();
    const { ethers } = await import("ethers");

    const ADMIN_ROLE = ethers.id("ADMIN_ROLE");
    const VERIFIER_ROLE = ethers.id("VERIFIER_ROLE");

    const isAdmin = await web3Service.hasRole(ADMIN_ROLE, user.walletAddress);
    const isVerifier = await web3Service.hasRole(
      VERIFIER_ROLE,
      user.walletAddress,
    );

    let blockchainRole = "user";
    if (isAdmin) blockchainRole = "admin";
    else if (isVerifier) blockchainRole = "verifier";

    if (blockchainRole !== user.role) {
      await db
        .update(users)
        .set({ role: blockchainRole })
        .where(eq(users.id, req.user.id));
    }

    res.json({
      success: true,
      previousRole: user.role,
      currentRole: blockchainRole,
    });
  } catch (error) {
    console.error("syncRoleFromBlockchain error:", error);
    res.status(500).json({ success: false, message: "Failed to sync role" });
  }
}

export const submitKYC = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("✅ User authenticated:", req.user.email);

    // Check if user already has a pending or approved KYC
    const existingKYC = await db
      .select()
      .from(kycSubmissions)
      .where(eq(kycSubmissions.userId, userId))
      .limit(1);

    if (existingKYC.length > 0 && existingKYC[0].status === "approved") {
      return res.status(400).json({
        success: false,
        message: "KYC already approved",
      });
    }

    // Extract form data
    const {
      firstName,
      lastName,
      dateOfBirth,
      nationality,
      address,
      city,
      postalCode,
      country,
    } = req.body;

    // Get wallet address from user record
    const userRecord = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord.length || !userRecord[0].walletAddress) {
      return res.status(400).json({
        success: false,
        message: "Wallet address not found. Please connect your wallet first.",
      });
    }

    const walletAddress = userRecord[0].walletAddress;

    // Validate required fields
    if (
      !firstName ||
      !lastName ||
      !dateOfBirth ||
      !nationality ||
      !address ||
      !city ||
      !postalCode ||
      !country
    ) {
      return res.status(400).json({
        success: false,
        message: "All personal information fields are required",
      });
    }

    // Validate files
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload all required documents",
      });
    }

    const { idDocument, proofOfAddress, selfieImage } = req.files;

    if (!idDocument || !proofOfAddress || !selfieImage) {
      return res.status(400).json({
        success: false,
        message:
          "Please upload ID document, proof of address, and selfie image",
      });
    }

    // Upload documents to IPFS
    console.log("📤 Uploading documents to IPFS...");
    const documentUploads = await Promise.all([
      uploadToIPFS(
        idDocument[0].buffer,
        `kyc/${userId}/id-document-${idDocument[0].originalname}`,
      ),
      uploadToIPFS(
        proofOfAddress[0].buffer,
        `kyc/${userId}/proof-of-address-${proofOfAddress[0].originalname}`,
      ),
      uploadToIPFS(
        selfieImage[0].buffer,
        `kyc/${userId}/selfie-${selfieImage[0].originalname}`,
      ),
    ]);

    const [idDocCid, addressProofCid, selfieCid] = documentUploads;
    console.log("✅ Documents uploaded to IPFS");

    // Save KYC data to database (blockchain submission will be handled by frontend with user's wallet)
    let kycSubmission;

    if (existingKYC.length > 0) {
      // Update existing submission
      [kycSubmission] = await db
        .update(kycSubmissions)
        .set({
          firstName,
          lastName,
          dateOfBirth: new Date(dateOfBirth),
          nationality,
          address,
          city,
          postalCode,
          country,
          documentHash: idDocCid,
          status: "awaiting_blockchain",
          submittedAt: new Date(),
          submissionTransactionHash: null, // Will be updated after frontend blockchain submission
          updatedAt: new Date(),
        })
        .where(eq(kycSubmissions.userId, userId))
        .returning();
    } else {
      // Create new submission
      [kycSubmission] = await db
        .insert(kycSubmissions)
        .values({
          userId,
          walletAddress,
          firstName,
          lastName,
          dateOfBirth: new Date(dateOfBirth),
          nationality,
          address,
          city,
          postalCode,
          country,
          documentHash: idDocCid,
          status: "awaiting_blockchain",
          submittedAt: new Date(),
          submissionTransactionHash: null, // Will be updated after frontend blockchain submission
          updatedAt: new Date(),
        })
        .returning();
    }

    // Delete old documents if updating
    if (existingKYC.length > 0) {
      await db
        .delete(kycDocuments)
        .where(eq(kycDocuments.submissionId, kycSubmission.id));
    }

    // Store document references
    await db.insert(kycDocuments).values([
      {
        userId,
        submissionId: kycSubmission.id,
        documentType: "id_document",
        ipfsHash: idDocCid,
        ipfsUrl: `https://gateway.pinata.cloud/ipfs/${idDocCid}`,
        fileName: idDocument[0].originalname,
        fileSize: idDocument[0].size,
        mimeType: idDocument[0].mimetype,
      },
      {
        userId,
        submissionId: kycSubmission.id,
        documentType: "proof_of_address",
        ipfsHash: addressProofCid,
        ipfsUrl: `https://gateway.pinata.cloud/ipfs/${addressProofCid}`,
        fileName: proofOfAddress[0].originalname,
        fileSize: proofOfAddress[0].size,
        mimeType: proofOfAddress[0].mimetype,
      },
      {
        userId,
        submissionId: kycSubmission.id,
        documentType: "selfie",
        ipfsHash: selfieCid,
        ipfsUrl: `https://gateway.pinata.cloud/ipfs/${selfieCid}`,
        fileName: selfieImage[0].originalname,
        fileSize: selfieImage[0].size,
        mimeType: selfieImage[0].mimetype,
      },
    ]);

    console.log("✅ KYC submission created/updated successfully in DB");

    res.json({
      success: true,
      message:
        "KYC documents uploaded successfully. Please confirm the blockchain transaction in your wallet.",
      documentHash: idDocCid,
      data: {
        submissionId: kycSubmission.id,
        status: kycSubmission.status,
      },
    });
  } catch (error) {
    console.error("submitKYC error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit KYC application",
      error: error.message,
    });
  }
};

export const updateKYCTransaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const { transactionHash, blockNumber } = req.body;

    if (!transactionHash) {
      return res.status(400).json({
        success: false,
        message: "Transaction hash is required",
      });
    }

    // Update the KYC submission with blockchain details
    const [updated] = await db
      .update(kycSubmissions)
      .set({
        submissionTransactionHash: transactionHash,
        updatedAt: new Date(),
      })
      .where(eq(kycSubmissions.userId, userId))
      .returning();

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "KYC submission not found",
      });
    }

    console.log("✅ Transaction hash updated:", transactionHash);

    res.json({
      success: true,
      message: "Transaction hash updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating KYC transaction:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update transaction hash",
    });
  }
};

export const getKYCStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const submission = await db
      .select()
      .from(kycSubmissions)
      .where(eq(kycSubmissions.userId, userId))
      .limit(1);

    if (!submission.length) {
      return res.json({
        success: true,
        data: {
          status: "not_submitted",
        },
      });
    }

    res.json({
      success: true,
      data: {
        status: submission[0].status,
        submittedAt: submission[0].submittedAt,
        rejectionReason: submission[0].rejectionReason,
      },
    });
  } catch (error) {
    console.error("Error fetching KYC status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch KYC status",
    });
  }
};

// POST /api/user/apply-verifier
export const applyVerifier = async (req, res) => {
  try {
    const userId = req.user.id;
    const { experience, qualifications, specialization, walletAddress } =
      req.body;

    console.log("✅ User authenticated:", req.user.email);
    console.log("📋 Verifier application data:", {
      experience,
      qualifications,
      specialization,
      walletAddress,
    });
    console.log(
      "📎 File upload:",
      req.file ? req.file.originalname : "NO FILE",
    );

    // Validate required fields
    if (!experience || !qualifications || !specialization || !walletAddress) {
      console.log("❌ Validation failed: Missing required fields");
      return res.status(400).json({
        success: false,
        message:
          "All fields are required: experience, qualifications, specialization, walletAddress",
      });
    }

    // Validate document upload
    if (!req.file) {
      console.log("❌ Validation failed: No file uploaded");
      return res.status(400).json({
        success: false,
        message: "Please upload supporting documents",
      });
    }

    // Clean up any failed blockchain submissions (awaiting_blockchain status)
    const deletedCount = await db
      .delete(verifierApplications)
      .where(
        and(
          eq(verifierApplications.userId, userId),
          eq(verifierApplications.status, "awaiting_blockchain"),
        ),
      );

    if (deletedCount.length > 0) {
      console.log(
        `🧹 Cleaned up ${deletedCount.length} failed verifier application(s)`,
      );
    }

    // Check if user already has a pending or approved application
    const [existingApp] = await db
      .select()
      .from(verifierApplications)
      .where(eq(verifierApplications.userId, userId))
      .limit(1);

    if (existingApp && existingApp.status === "pending") {
      console.log("❌ Validation failed: Already has pending application");
      return res.status(400).json({
        success: false,
        message: "You already have a pending verifier application",
      });
    }

    if (existingApp && existingApp.status === "approved") {
      console.log("❌ Validation failed: Already approved as verifier");
      return res.status(400).json({
        success: false,
        message: "You are already an approved verifier",
      });
    }

    // Upload document to IPFS
    console.log("📤 Uploading document to IPFS...");
    const documentCid = await uploadToIPFS(
      req.file.buffer,
      `verifier/${userId}/documents-${req.file.originalname}`,
    );
    console.log("✅ Document uploaded to IPFS:", documentCid);

    // Create verifier application (blockchain submission will be handled by frontend with user's wallet)
    const [application] = await db
      .insert(verifierApplications)
      .values({
        userId,
        experience,
        qualifications,
        specialization,
        documentsHash: documentCid,
        walletAddress: walletAddress.toLowerCase(),
        status: "awaiting_blockchain", // Will be updated to "pending" after blockchain confirmation
        approvalTransactionHash: null, // Will be updated after frontend blockchain submission
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log("✅ Verifier application created:", application.id);

    res.json({
      success: true,
      message: "Verifier application submitted successfully",
      data: {
        applicationId: application.id,
        status: application.status,
      },
      documentsHash: documentCid,
    });
  } catch (error) {
    console.error("applyVerifier error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit verifier application",
      error: error.message,
    });
  }
};
