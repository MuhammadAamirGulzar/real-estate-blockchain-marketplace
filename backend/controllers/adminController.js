import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db/connection.js";
import {
  investments,
  kycDocuments,
  kycSubmissions,
  paymentProofs,
  properties,
  propertyDocuments,
  users,
  verifierApplications,
  verifierAssignments,
} from "../db/schema.js";
import { blockchainSyncService } from "../services/blockchainSyncService.js";
import investmentService from "../services/investmentService.js";
import paymentService from "../services/paymentService.js";
import tokenizationService from "../services/tokenization.service.js";
import { verifyActionSignature } from "../services/walletAuthService.js";
import { web3Service } from "../services/web3Service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KYCRegistryABI = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../services/web3/abi/KYCRegistry.json"),
    "utf-8",
  ),
);
const addressesData = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../services/web3/addresses.json"),
    "utf-8",
  ),
);

/**
 * Recursively serializes BigInt values to strings for JSON serialization
 * @param {*} obj - Object to serialize
 * @returns {*} Serialized object with BigInt values converted to strings
 */
const serializeBigInt = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle BigInt directly
  if (typeof obj === "bigint") {
    return obj.toString();
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }

  // Handle objects
  if (typeof obj === "object") {
    const serialized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        serialized[key] = serializeBigInt(obj[key]);
      }
    }
    return serialized;
  }

  // Return primitive values as-is
  return obj;
};

// --- Dashboard Stats ---
export const getDashboardStats = async (req, res) => {
  try {
    // Total users count
    const userCountResult = await db
      .select({ count: sql`count(*)` })
      .from(users);
    const userCount = userCountResult[0] || { count: 0 };

    // Total properties count
    const propertyCountResult = await db
      .select({ count: sql`count(*)` })
      .from(properties);
    const propertyCount = propertyCountResult[0] || { count: 0 };

    // Pending KYC count
    const pendingKycCountResult = await db
      .select({ count: sql`count(*)` })
      .from(kycSubmissions)
      .where(eq(kycSubmissions.status, "pending"));
    const pendingKycCount = pendingKycCountResult[0] || { count: 0 };

    // Active verifiers count (users with verifier role)
    const verifierCountResult = await db
      .select({ count: sql`count(*)` })
      .from(users)
      .where(eq(users.role, "verifier"));
    const verifierCount = verifierCountResult[0] || { count: 0 };

    // Pending verifier applications count
    const pendingVerifierCountResult = await db
      .select({ count: sql`count(*)` })
      .from(verifierApplications)
      .where(eq(verifierApplications.status, "pending"));
    const pendingVerifierCount = pendingVerifierCountResult[0] || { count: 0 };

    // Recent activity - KYC approvals (simplified without join for ordering)
    const recentKycActivity = await db
      .select()
      .from(kycSubmissions)
      .where(eq(kycSubmissions.status, "approved"))
      .limit(5);

    // Get user details for KYC activities
    const kycWithUsers = await Promise.all(
      (recentKycActivity || []).map(async (kyc) => {
        const userResult = await db
          .select({
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(eq(users.id, kyc.userId))
          .limit(1);
        const user = userResult[0] || null;
        return { ...kyc, user };
      }),
    );

    // Recent activity - Property submissions
    const recentPropertyActivity =
      (await db.select().from(properties).limit(5)) || [];

    // Combine and format recent activity
    const recentActivity = [
      ...(kycWithUsers || []).map((item) => ({
        type: "kyc_approved",
        title: "KYC Approved",
        description:
          `${item.user?.firstName || ""} ${item.user?.lastName || ""}`.trim() ||
          item.user?.email ||
          "Unknown",
        timestamp: item.updatedAt,
      })),
      ...(recentPropertyActivity || []).map((item) => ({
        type: "property_submitted",
        title: "Property Submitted",
        description: item.title,
        timestamp: item.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);

    res.json({
      success: true,
      totalUsers: parseInt(userCount.count) || 0,
      totalProperties: parseInt(propertyCount.count) || 0,
      pendingKYC: parseInt(pendingKycCount.count) || 0,
      activeVerifiers: parseInt(verifierCount.count) || 0,
      pendingVerifiers: parseInt(pendingVerifierCount.count) || 0,
      recentActivity,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    console.error("Error details:", error.message, error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
      error: error.message,
    });
  }
};

// --- KYC Requests ---
export const getKYCRequests = async (req, res) => {
  try {
    // Fetch KYC submissions with user details using a join
    const requests = await db
      .select({
        id: kycSubmissions.id,
        userId: kycSubmissions.userId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        status: kycSubmissions.status,
        walletAddress: users.walletAddress,
        submittedAt: kycSubmissions.submittedAt,
        reviewedAt: kycSubmissions.reviewedAt,
        rejectionReason: kycSubmissions.rejectionReason,
        submissionMessage: kycSubmissions.submissionMessage,
      })
      .from(kycSubmissions)
      .innerJoin(users, eq(kycSubmissions.userId, users.id))
      .where(eq(kycSubmissions.status, "pending"));

    // Fetch documents for each submission
    const requestsWithDocs = await Promise.all(
      requests.map(async (request) => {
        const documents = await db
          .select()
          .from(kycDocuments)
          .where(eq(kycDocuments.submissionId, request.id));
        return { ...request, documents };
      }),
    );

    res.json({ success: true, data: requestsWithDocs });
  } catch (error) {
    console.error("Error fetching KYC requests:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch KYC requests" });
  }
};

export const approveKycRequest = async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(parseInt(id, 10))) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid KYC submission ID" });
  }
  const submissionId = parseInt(id, 10);
  const { signature, walletAddress, message, txHash } = req.body;

  try {
    console.log(`📋 Approving KYC submission ${submissionId}`);
    console.log(`   Admin wallet: ${walletAddress}`);
    console.log(
      `   Transaction hash: ${txHash || "None (backend will execute)"}`,
    );

    // Verify admin/subadmin signature against provided message
    try {
      await verifyActionSignature(
        req.user.id,
        walletAddress,
        "approve_kyc",
        signature,
        message,
        "kyc_submission",
        submissionId,
      );
    } catch (sigError) {
      return res.status(401).json({
        success: false,
        message: sigError.message || "Invalid admin signature",
      });
    }

    // Get the KYC submission to find the userId
    const [kycSubmission] = await db
      .select()
      .from(kycSubmissions)
      .where(eq(kycSubmissions.id, submissionId))
      .limit(1);

    if (!kycSubmission) {
      return res
        .status(404)
        .json({ success: false, message: "KYC submission not found" });
    }

    // Get user's wallet address
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, kycSubmission.userId))
      .limit(1);

    if (!user || !user.walletAddress) {
      return res.status(400).json({
        success: false,
        message: "User must have a connected wallet to approve KYC",
      });
    }

    console.log(`👤 User: ${user.email} (${user.walletAddress})`);

    // If frontend already executed blockchain transaction, just update database
    if (txHash && txHash !== "OFFCHAIN_REJECTION") {
      console.log("✅ Using transaction hash from frontend");

      // Verify blockchain status is now Approved (optional but good practice)
      try {
        const status = await web3Service.getKYCStatus(user.walletAddress);
        console.log(`   Blockchain status: ${status} (2=Approved expected)`);
        // Status should be Approved (2) now since frontend already approved
      } catch (statusError) {
        console.warn(
          "⚠️  Could not verify blockchain status:",
          statusError.message,
        );
      }

      // Update database
      await db
        .update(kycSubmissions)
        .set({
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: req.user.id,
          approvalSignature: signature,
          approvalMessage: message,
          approvalTransactionHash: txHash,
        })
        .where(eq(kycSubmissions.id, submissionId));

      // Update user's KYC status
      await db
        .update(users)
        .set({ kycStatus: "approved" })
        .where(eq(users.id, kycSubmission.userId));

      console.log(`✅ KYC approved in database for user ${user.walletAddress}`);

      return res.json({
        success: true,
        message: "KYC approved successfully",
        transactionHash: txHash,
      });
    }

    // Fallback: Backend executes blockchain transaction (old flow)
    console.log(
      "⚠️  No txHash provided, backend will execute blockchain transaction",
    );

    // Verify user has pending KYC on blockchain
    const status = await web3Service.getKYCStatus(user.walletAddress);
    // KYCRegistry enum: 0=NotSubmitted, 1=Pending, 2=Approved, 3=Rejected
    console.log(`   Blockchain status check: ${status}`);
    if (Number(status) !== 1) {
      console.error(
        `❌ Invalid blockchain status: ${status} (expected 1=Pending)`,
      );
      return res.status(400).json({
        success: false,
        message:
          Number(status) === 2
            ? "KYC is already approved on-chain. Database may be out of sync."
            : "User has not submitted KYC on-chain or KYC status is not pending",
        currentStatus: Number(status),
      });
    }

    // Approve KYC on blockchain AND update database atomically
    const result = await web3Service.executeTransaction({
      contract: "KYCRegistry",
      function: "approveKYC",
      args: [user.walletAddress],
      dbOperation: async (receipt) => {
        // Update KYC submission status
        await db
          .update(kycSubmissions)
          .set({
            status: "approved",
            reviewedAt: new Date(),
            reviewedBy: req.user.id,
            approvalSignature: signature,
            approvalMessage: message,
            approvalTransactionHash: receipt.hash,
          })
          .where(eq(kycSubmissions.id, submissionId));

        // Update user's KYC status
        await db
          .update(users)
          .set({ kycStatus: "approved" })
          .where(eq(users.id, kycSubmission.userId));

        console.log(
          `✅ KYC approved in database for user ${user.walletAddress}`,
        );
        return { userId: user.id, walletAddress: user.walletAddress };
      },
      relatedEntity: { type: "kyc", id: submissionId },
    });

    console.log(
      `✅ KYC approval complete. Transaction: ${result.transactionHash}`,
    );

    res.json({
      success: true,
      message: "KYC approved successfully",
      transactionHash: result.transactionHash,
    });
  } catch (error) {
    console.error("Error approving KYC:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve KYC",
      error: error.message,
    });
  }
};

export const rejectKycRequest = async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(parseInt(id, 10))) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid KYC submission ID" });
  }
  const submissionId = parseInt(id, 10);
  const { signature, walletAddress, message, reason, txHash } = req.body;

  try {
    console.log(`📋 Rejecting KYC submission ${submissionId}`);
    console.log(`   Admin wallet: ${walletAddress}`);
    console.log(`   Rejection reason: ${reason || "No reason provided"}`);
    console.log(
      `   Transaction hash: ${txHash || "None (backend will execute)"}`,
    );

    try {
      await verifyActionSignature(
        req.user.id,
        walletAddress,
        "reject_kyc",
        signature,
        message,
        "kyc_submission",
        submissionId,
      );
    } catch (sigError) {
      return res.status(401).json({
        success: false,
        message: sigError.message || "Invalid admin signature",
      });
    }

    // Get the KYC submission to find the userId
    const [kycSubmission] = await db
      .select()
      .from(kycSubmissions)
      .where(eq(kycSubmissions.id, submissionId))
      .limit(1);

    if (!kycSubmission) {
      return res
        .status(404)
        .json({ success: false, message: "KYC submission not found" });
    }

    // Get user's wallet address
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, kycSubmission.userId))
      .limit(1);

    if (!user || !user.walletAddress) {
      return res.status(400).json({
        success: false,
        message: "User must have a connected wallet to reject KYC",
      });
    }

    console.log(`👤 User: ${user.email} (${user.walletAddress})`);

    const rejectionReason = reason || "No reason provided";

    // If frontend already executed blockchain transaction, just update database
    if (txHash && txHash !== "OFFCHAIN_REJECTION") {
      console.log("✅ Using transaction hash from frontend");

      // Update database
      await db
        .update(kycSubmissions)
        .set({
          status: "rejected",
          reviewedAt: new Date(),
          reviewedBy: req.user.id,
          rejectionReason: rejectionReason,
          rejectionTransactionHash: txHash,
        })
        .where(eq(kycSubmissions.id, submissionId));

      // Update user's KYC status
      await db
        .update(users)
        .set({ kycStatus: "rejected" })
        .where(eq(users.id, kycSubmission.userId));

      console.log(`✅ KYC rejected in database for user ${user.walletAddress}`);

      return res.json({
        success: true,
        message: "KYC rejected successfully",
        transactionHash: txHash,
      });
    }

    // Fallback: Backend executes blockchain transaction (old flow)
    console.log(
      "⚠️  No txHash provided, backend will execute blockchain transaction",
    );

    // Reject KYC on blockchain AND update database atomically
    const result = await web3Service.executeTransaction({
      contract: "KYCRegistry",
      function: "rejectKYC",
      args: [user.walletAddress, rejectionReason],
      dbOperation: async (receipt) => {
        // Update KYC submission status
        await db
          .update(kycSubmissions)
          .set({
            status: "rejected",
            reviewedAt: new Date(),
            reviewedBy: req.user.id,
            rejectionReason: rejectionReason,
            rejectionTransactionHash: receipt.hash,
          })
          .where(eq(kycSubmissions.id, submissionId));

        // Update user's KYC status
        await db
          .update(users)
          .set({ kycStatus: "rejected" })
          .where(eq(users.id, kycSubmission.userId));

        console.log(
          `✅ KYC rejected in database for user ${user.walletAddress}`,
        );
        return { userId: user.id, walletAddress: user.walletAddress };
      },
      relatedEntity: { type: "kyc", id: submissionId },
    });

    console.log(
      `✅ KYC rejection complete. Transaction: ${result.transactionHash}`,
    );

    res.json({
      success: true,
      message: "KYC rejected successfully",
      transactionHash: result.transactionHash,
    });
  } catch (error) {
    console.error("Error rejecting KYC:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject KYC",
      error: error.message,
    });
  }
};

// --- Verifier Applications ---
export const getVerifierApplications = async (req, res) => {
  try {
    const applications = await db
      .select({
        id: verifierApplications.id,
        userId: verifierApplications.userId,
        status: verifierApplications.status,
        experience: verifierApplications.experience,
        qualifications: verifierApplications.qualifications,
        specialization: verifierApplications.specialization,
        documentsHash: verifierApplications.documentsHash,
        walletAddress: verifierApplications.walletAddress,
        createdAt: verifierApplications.createdAt,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(verifierApplications)
      .leftJoin(users, eq(verifierApplications.userId, users.id))
      .where(eq(verifierApplications.status, "pending"));

    res.json({ success: true, data: applications || [] });
  } catch (error) {
    console.error("Error fetching verifier applications:", error);
    console.error("Error details:", error.message, error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to fetch verifier applications",
      error: error.message,
    });
  }
};

export const approveVerifierApplication = async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(parseInt(id, 10))) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid application ID" });
  }
  const { signature, walletAddress, message } = req.body;

  try {
    // Verify admin signature
    try {
      await verifyActionSignature(
        req.user.id,
        walletAddress,
        "approve_verifier",
        signature,
        message,
        "verifier_application",
        parseInt(id, 10),
      );
    } catch (sigError) {
      return res.status(401).json({
        success: false,
        message: sigError.message || "Invalid admin signature",
      });
    }

    // Get application to find userId and wallet address
    const [application] = await db
      .select()
      .from(verifierApplications)
      .where(eq(verifierApplications.id, parseInt(id, 10)));

    if (!application) {
      return res
        .status(404)
        .json({ success: false, message: "Application not found" });
    }

    // Get user details for wallet address
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, application.userId));

    if (!user || !user.walletAddress) {
      return res.status(400).json({
        success: false,
        message: "User wallet address not found",
      });
    }

    console.log(`📋 Approving verifier application:`, {
      applicationId: id,
      userId: user.id,
      walletAddress: user.walletAddress,
    });

    const VERIFIER_ROLE = ethers.id("VERIFIER_ROLE");

    // Grant VERIFIER_ROLE on blockchain and update DB atomically
    const result = await web3Service.executeTransaction({
      contract: "RoleManager",
      function: "grantRoleByAdmin",
      args: [VERIFIER_ROLE, user.walletAddress],
      dbOperation: async (receipt) => {
        // Update application status in database
        console.log(`📝 Updating application status in database...`);
        await db
          .update(verifierApplications)
          .set({
            status: "approved",
            updatedAt: new Date(),
            approvalTransactionHash: receipt.hash,
          })
          .where(eq(verifierApplications.id, parseInt(id, 10)));

        // Update user role to verifier and link wallet
        console.log(`📝 Updating user role to verifier and linking wallet...`);
        await db
          .update(users)
          .set({
            role: "verifier",
            walletAddress: user.walletAddress,
            isWalletConnected: true,
            roleGrantTransactionHash: receipt.hash,
          })
          .where(eq(users.id, application.userId));

        console.log(`✅ Verifier application approved in database`);
        return { userId: user.id, applicationId: parseInt(id, 10) };
      },
      relatedEntity: { type: "verifier_application", id: parseInt(id, 10) },
    });

    console.log(
      `✅ Verifier role granted on blockchain. Transaction: ${result.transactionHash}`,
    );
    res.json({
      success: true,
      message: "Verifier application approved",
      transactionHash: result.transactionHash,
    });
  } catch (error) {
    console.error("Error approving verifier:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve verifier",
      error: error.message,
    });
  }
};

export const rejectVerifierApplication = async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(parseInt(id, 10))) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid application ID" });
  }
  const { signature, walletAddress, message, reason } = req.body;

  try {
    // Verify admin signature
    try {
      await verifyActionSignature(
        req.user.id,
        walletAddress,
        "reject_verifier",
        signature,
        message,
        "verifier_application",
        parseInt(id, 10),
      );
    } catch (sigError) {
      return res.status(401).json({
        success: false,
        message: sigError.message || "Invalid admin signature",
      });
    }

    // Get application
    const [application] = await db
      .select()
      .from(verifierApplications)
      .where(eq(verifierApplications.id, parseInt(id, 10)));

    if (!application) {
      return res
        .status(404)
        .json({ success: false, message: "Application not found" });
    }

    console.log(`📋 Rejecting verifier application:`, {
      applicationId: id,
      userId: application.userId,
      reason: reason || "No reason provided",
    });

    // Update application status in database
    // No blockchain interaction needed for rejection
    await db
      .update(verifierApplications)
      .set({
        status: "rejected",
        rejectionReason: reason || "No reason provided",
        updatedAt: new Date(),
      })
      .where(eq(verifierApplications.id, parseInt(id, 10)));

    console.log(`✅ Verifier application rejected successfully`);
    res.json({
      success: true,
      message: "Verifier application rejected",
    });
  } catch (error) {
    console.error("Error rejecting verifier:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject verifier",
      error: error.message,
    });
  }
};

// --- Properties ---
export const getProperties = async (req, res) => {
  try {
    // Get status filter from query parameter
    const { status: statusFilter } = req.query;

    // Build the base query with all property details and lister info
    let query = db
      .select({
        // Property fields
        id: properties.id,
        title: properties.title,
        location: properties.location,
        description: properties.description,
        propertyValue: properties.propertyValue,
        propertyType: properties.propertyType,
        status: properties.status,
        createdAt: properties.createdAt,
        assignedAt: properties.assignedAt,
        verifiedAt: properties.verifiedAt,
        verifiedBy: properties.verifiedBy,
        assetRegistryId: properties.assetRegistryId,
        listingTransactionHash: properties.listingTransactionHash,
        verificationTransactionHash: properties.verificationTransactionHash,
        metadataUrl: properties.metadataUrl,
        nftTokenId: properties.nftTokenId,
        listerId: properties.listerId,
        assignedVerifierId: properties.assignedVerifierId,
        rejectionReason: properties.rejectionReason,
        // Lister details
        listerEmail: users.email,
        listerFirstName: users.firstName,
        listerLastName: users.lastName,
        listerWalletAddress: users.walletAddress,
      })
      .from(properties)
      .leftJoin(users, eq(properties.listerId, users.id));

    // Apply status filter if provided and not 'all'
    if (statusFilter && statusFilter !== "all") {
      query = query.where(eq(properties.status, statusFilter));
    }

    const propertyList = await query;

    // Fetch assigned verifier details for properties that have an assigned verifier
    const verifierIds = [
      ...new Set(
        propertyList
          .filter((p) => p.assignedVerifierId)
          .map((p) => p.assignedVerifierId),
      ),
    ];

    let verifiersMap = {};
    if (verifierIds.length > 0) {
      const verifiers = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          walletAddress: users.walletAddress,
        })
        .from(users)
        .where(
          sql`${users.id} IN (${sql.join(
            verifierIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );

      verifiersMap = verifiers.reduce((acc, verifier) => {
        acc[verifier.id] = verifier;
        return acc;
      }, {});
    }

    // Fetch documents for all properties
    const propertyIds = propertyList.map((p) => p.id);
    let documentsMap = {};

    if (propertyIds.length > 0) {
      const documents = await db
        .select({
          id: propertyDocuments.id,
          propertyId: propertyDocuments.propertyId,
          documentType: propertyDocuments.documentType,
          fileName: propertyDocuments.fileName,
          fileSize: propertyDocuments.fileSize,
          mimeType: propertyDocuments.mimeType,
          ipfsHash: propertyDocuments.ipfsHash,
          ipfsUrl: propertyDocuments.ipfsUrl,
          uploadedAt: propertyDocuments.uploadedAt,
        })
        .from(propertyDocuments)
        .where(
          sql`${propertyDocuments.propertyId} IN (${sql.join(
            propertyIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );

      documentsMap = documents.reduce((acc, doc) => {
        if (!acc[doc.propertyId]) {
          acc[doc.propertyId] = [];
        }
        acc[doc.propertyId].push(doc);
        return acc;
      }, {});
    }

    // Transform to include lister, assignedVerifier, and documents
    const formattedProperties = propertyList.map((prop) => ({
      ...prop,
      assetRegistryId: prop.assetRegistryId
        ? prop.assetRegistryId.toString()
        : null,
      lister: {
        firstName: prop.listerFirstName,
        lastName: prop.listerLastName,
        email: prop.listerEmail,
        walletAddress: prop.listerWalletAddress,
      },
      assignedVerifier: prop.assignedVerifierId
        ? verifiersMap[prop.assignedVerifierId] || null
        : null,
      documents: documentsMap[prop.id] || [],
    }));

    console.log(
      `📋 [Admin] Fetched ${formattedProperties.length} properties${statusFilter && statusFilter !== "all" ? ` with status: ${statusFilter}` : " (all statuses)"}`,
    );

    res.json({ success: true, properties: formattedProperties });
  } catch (error) {
    console.error("Error fetching properties:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch properties" });
  }
};

// --- Get Users ---
export const getUsers = async (req, res) => {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        kycStatus: users.kycStatus,
        walletAddress: users.walletAddress,
        isWalletConnected: users.isWalletConnected,
        createdAt: users.createdAt,
      })
      .from(users);

    res.json({ success: true, data: allUsers });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
};

export const registerPropertyOnBlockchain = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { signature, walletAddress, message } = req.body;
    const propertyIdInt = parseInt(propertyId, 10);

    if (isNaN(propertyIdInt) || propertyIdInt <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid property ID" });
    }

    await verifyActionSignature(
      req.user.id,
      walletAddress,
      "register_property",
      signature,
      message,
      "property",
      propertyIdInt,
    );

    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, propertyIdInt))
      .limit(1);

    if (!property) {
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    }

    if (property.assetRegistryId) {
      return res.status(400).json({
        success: false,
        message: "Property already registered on blockchain",
        assetRegistryId: property.assetRegistryId,
      });
    }

    const [lister] = await db
      .select()
      .from(users)
      .where(eq(users.id, property.listerId))
      .limit(1);

    if (!lister || !lister.walletAddress) {
      return res.status(400).json({
        success: false,
        message: "Property owner must have a connected wallet",
      });
    }

    console.log(`🏠 Registering property ${property.title} on blockchain...`);

    const result = await web3Service.executeTransaction({
      contract: "AssetRegistry",
      function: "registerProperty",
      args: [
        lister.walletAddress,
        property.metadataUrl || `ipfs://placeholder-${propertyIdInt}`,
        ethers.parseUnits((property.propertyValue || 0).toString(), 18),
      ],
      dbOperation: async (receipt) => {
        const event = receipt.logs.find(
          (log) =>
            log.topics[0] ===
            web3Service.assetRegistry.interface.getEvent("PropertyRegistered")
              .topicHash,
        );
        const assetRegistryId = event ? event.args[0] : null;

        await db
          .update(properties)
          .set({
            assetRegistryId: assetRegistryId?.toString(),
            listingTransactionHash: receipt.hash,
            status: "pending_verification",
          })
          .where(eq(properties.id, propertyIdInt));

        console.log(
          `✅ Property registered on blockchain with ID: ${assetRegistryId}`,
        );
        return { assetRegistryId: assetRegistryId?.toString() };
      },
      relatedEntity: { type: "property", id: propertyIdInt },
    });

    res.json({
      success: true,
      message: "Property registered on blockchain successfully",
      assetRegistryId: result.data.assetRegistryId,
      transactionHash: result.transactionHash,
    });
  } catch (error) {
    console.error("Error registering property on blockchain:", error);
    res.status(500).json({
      success: false,
      message: "Failed to register property on blockchain",
      error: error.message,
    });
  }
};

export const assignVerifier = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { verifierId, signature, walletAddress, message } = req.body;

    // Validate numeric params before any DB query
    const propertyIdInt = parseInt(propertyId, 10);
    const verifierIdInt = parseInt(verifierId, 10);
    if (isNaN(propertyIdInt) || propertyIdInt <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid property ID" });
    }
    if (isNaN(verifierIdInt) || verifierIdInt <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid verifier ID" });
    }

    // Verify admin signature
    try {
      await verifyActionSignature(
        req.user.id,
        walletAddress,
        "assign_verifier",
        signature,
        message,
        "property",
        propertyId,
      );
    } catch (sigError) {
      return res.status(401).json({
        success: false,
        message: sigError.message || "Invalid signature",
      });
    }

    // Get property
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, propertyIdInt))
      .limit(1);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    if (!property.assetRegistryId) {
      console.log(
        `🔍 Property ${propertyIdInt} has no assetRegistryId — resolving before assignment`,
      );

      // --- Resolve lister wallet (required for both paths below) ---
      const [listerUser] = await db
        .select({ walletAddress: users.walletAddress })
        .from(users)
        .where(eq(users.id, property.listerId))
        .limit(1);

      if (!listerUser?.walletAddress) {
        return res.status(400).json({
          success: false,
          message:
            "Property owner has no connected wallet. Ask them to connect a wallet before assigning a verifier.",
        });
      }

      // --- Step 1: Try event-based reconciliation ---
      // The user may have already called listProperty() on-chain but the sync
      // service missed the event (e.g. server restart). Query historical events
      // to backfill assetRegistryId without touching the blockchain again.
      if (blockchainSyncService.assetRegistry) {
        try {
          const filter =
            blockchainSyncService.assetRegistry.filters.PropertyListed(
              null,
              listerUser.walletAddress,
            );
          const events = await blockchainSyncService.assetRegistry.queryFilter(
            filter,
            0,
            "latest",
          );
          const matched = events.find(
            (e) => e.args.metadataHash === property.metadataUrl,
          );
          if (matched) {
            const reconciledId = matched.args.propertyId.toString();
            await db
              .update(properties)
              .set({
                assetRegistryId: reconciledId,
                listingTransactionHash: matched.transactionHash,
                status: "pending_assignment",
              })
              .where(eq(properties.id, propertyIdInt));
            property.assetRegistryId = reconciledId;
            console.log(
              `   ✅ Reconciled assetRegistryId=${reconciledId} from PropertyListed event`,
            );
          }
        } catch (queryErr) {
          // Non-fatal — fall through to registerProperty below
          console.warn(
            `   ⚠️  Event reconciliation failed (non-fatal): ${queryErr.message}`,
          );
        }
      }

      // --- Step 2: Direct on-chain lookup via getOwnerProperties + getProperty ---
      // listProperty() requires onlyKYCApproved from the caller's wallet, so the
      // deployer key cannot call it on behalf of a user. Instead, read the user's
      // existing on-chain property list and match by metadataHash — no new
      // transaction required and no KYC restriction on view calls.
      if (!property.assetRegistryId) {
        console.log(
          `   🔍 Querying on-chain properties for wallet ${listerUser.walletAddress}`,
        );
        try {
          const assetContract = web3Service.getContract("AssetRegistry");
          const onChainIds = await assetContract.getOwnerProperties(
            listerUser.walletAddress,
          );

          for (const id of onChainIds) {
            const onChainProp = await assetContract.getProperty(id);
            if (onChainProp.metadataHash === property.metadataUrl) {
              const reconciledId = id.toString();
              await db
                .update(properties)
                .set({
                  assetRegistryId: reconciledId,
                  status: "pending_assignment",
                })
                .where(eq(properties.id, propertyIdInt));
              property.assetRegistryId = reconciledId;
              console.log(
                `   ✅ Found on-chain match: assetRegistryId=${reconciledId}`,
              );
              break;
            }
          }
        } catch (lookupErr) {
          console.warn(
            `   ⚠️  On-chain lookup failed (non-fatal): ${lookupErr.message}`,
          );
        }

        if (!property.assetRegistryId) {
          return res.status(400).json({
            success: false,
            message:
              "This property has not been registered on the blockchain yet. Please ask the property owner to complete the blockchain registration from their dashboard before assigning a verifier.",
          });
        }
      }
    }

    // Get verifier
    const [verifier] = await db
      .select()
      .from(users)
      .where(eq(users.id, verifierIdInt))
      .limit(1);

    if (!verifier || verifier.role !== "verifier") {
      return res.status(400).json({
        success: false,
        message: "Invalid verifier",
      });
    }

    if (!verifier.walletAddress) {
      return res.status(400).json({
        success: false,
        message: "Verifier wallet not connected",
      });
    }

    // Execute blockchain transaction
    console.log(
      `🔗 Assigning verifier ${verifier.email} to property ${property.title}...`,
    );

    // Ensure the verifier wallet has VERIFIER_ROLE on-chain before calling
    // assignVerifier. The deployer holds ADMIN_ROLE so it can call
    // grantRoleByAdmin without any KYC restriction.
    try {
      const roleManagerContract = web3Service.getContract("RoleManager");
      const verifierRole = await roleManagerContract.VERIFIER_ROLE();
      const alreadyHasRole = await roleManagerContract.hasRole(
        verifierRole,
        verifier.walletAddress,
      );
      if (!alreadyHasRole) {
        console.log(
          `   🔑 Granting VERIFIER_ROLE to ${verifier.walletAddress}...`,
        );
        await web3Service.executeTransaction({
          contract: "RoleManager",
          function: "grantRoleByAdmin",
          args: [verifierRole, verifier.walletAddress],
          relatedEntity: { type: "property", id: property.id },
        });
        console.log(`   ✅ VERIFIER_ROLE granted to ${verifier.walletAddress}`);
      } else {
        console.log(
          `   ✅ ${verifier.walletAddress} already has VERIFIER_ROLE`,
        );
      }
    } catch (roleErr) {
      console.error(`   ❌ Failed to grant VERIFIER_ROLE: ${roleErr.message}`);
      throw new Error(
        `Could not grant verifier role on blockchain: ${roleErr.message}`,
      );
    }

    let txResult = null;
    try {
      txResult = await web3Service.executeTransaction({
        contract: "AssetRegistry",
        function: "assignVerifier",
        args: [property.assetRegistryId, verifier.walletAddress],
        relatedEntity: {
          type: "property",
          id: property.id,
        },
      });
    } catch (txErr) {
      // VerifierAlreadyAssigned (0xfa7e1e11) means the on-chain slot is taken — still update DB
      const isAlreadyAssigned =
        txErr.message?.includes("VerifierAlreadyAssigned") ||
        txErr.data === "0xfa7e1e11";
      if (!isAlreadyAssigned) {
        throw txErr; // re-throw real errors
      }
      console.log(
        `⚠️  Verifier already assigned on-chain for property ${propertyIdInt} — updating DB only`,
      );
    }

    // Always update DB regardless of whether blockchain tx ran or was already assigned
    await db
      .update(properties)
      .set({
        assignedVerifierId: verifierIdInt,
        status: "verification_pending",
        assignedAt: new Date(),
        assignedBy: req.user.id,
        verifierAssignmentTransactionHash: txResult?.transactionHash ?? null,
      })
      .where(eq(properties.id, propertyIdInt));

    const existingAssignment = await db
      .select()
      .from(verifierAssignments)
      .where(eq(verifierAssignments.propertyId, propertyIdInt))
      .limit(1);

    if (existingAssignment.length === 0) {
      await db.insert(verifierAssignments).values({
        verifierId: verifierIdInt,
        propertyId: propertyIdInt,
        assignedBy: req.user.id,
        status: "assigned",
        assignedAt: new Date(),
      });
    } else {
      await db
        .update(verifierAssignments)
        .set({
          verifierId: verifierIdInt,
          status: "assigned",
          assignedAt: new Date(),
        })
        .where(eq(verifierAssignments.propertyId, propertyIdInt));
    }

    return res.status(200).json({
      success: true,
      message: "Verifier assigned successfully",
      data: {
        transactionHash: txResult?.transactionHash ?? null,
        blockNumber: txResult?.receipt?.blockNumber ?? null,
      },
    });
  } catch (error) {
    console.error("Error assigning verifier:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to assign verifier",
    });
  }
};

// --- User Management ---
export const getSubadmins = async (req, res) => {
  try {
    const subadmins = await db
      .select()
      .from(users)
      .where(eq(users.role, "admin"));
    res.json({ success: true, data: subadmins });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch subadmins" });
  }
};

export const getVerifiers = async (req, res) => {
  try {
    const verifierList = await db
      .select()
      .from(users)
      .where(eq(users.role, "verifier"));
    res.json({ success: true, data: verifierList });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch verifiers" });
  }
};

export const createSubadmin = async (req, res) => {
  const {
    email,
    firstName,
    lastName,
    password,
    walletAddress: newAdminWallet,
    signature,
    message,
  } = req.body;

  try {
    await verifyActionSignature(
      req.user.id,
      req.user.walletAddress || newAdminWallet,
      "create_subadmin",
      signature,
      message,
    );

    if (!email || !firstName || !lastName || !newAdminWallet) {
      return res.status(400).json({
        success: false,
        message:
          "Email, first name, last name, and wallet address are required",
      });
    }

    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    const SUB_ADMIN_ROLE = ethers.id("SUB_ADMIN_ROLE");

    if (existingUser) {
      if (!existingUser.walletAddress) {
        return res.status(400).json({
          success: false,
          message:
            "User must have a connected wallet to receive blockchain role",
        });
      }

      // Grant SUB_ADMIN_ROLE on blockchain and update DB atomically
      const result = await web3Service.executeTransaction({
        contract: "RoleManager",
        function: "grantRoleByAdmin",
        args: [SUB_ADMIN_ROLE, existingUser.walletAddress],
        dbOperation: async (receipt) => {
          await db
            .update(users)
            .set({
              role: "subadmin",
              roleGrantTransactionHash: receipt.hash,
            })
            .where(eq(users.id, existingUser.id));

          console.log(
            `✅ User ${existingUser.email} promoted to sub-admin in database`,
          );
          return { userId: existingUser.id, role: "subadmin" };
        },
        relatedEntity: { type: "user", id: existingUser.id },
      });

      console.log(
        `✅ Sub-admin role granted on blockchain. Transaction: ${result.transactionHash}`,
      );
      return res.json({
        success: true,
        message: "User promoted to subadmin",
        transactionHash: result.transactionHash,
      });
    }

    // Create new user and grant role on blockchain
    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : await bcrypt.hash("ChangeMe123!", 10);

    // Ensure wallet address is properly checksummed to avoid ENS resolution
    const checksummedWallet = ethers.getAddress(newAdminWallet);

    // Grant role on blockchain first, then create user in DB
    const result = await web3Service.executeTransaction({
      contract: "RoleManager",
      function: "grantRoleByAdmin",
      args: [SUB_ADMIN_ROLE, checksummedWallet],
      dbOperation: async (receipt) => {
        const [newUser] = await db
          .insert(users)
          .values({
            email,
            password: hashedPassword,
            firstName,
            lastName,
            walletAddress: checksummedWallet.toLowerCase(),
            role: "subadmin",
            createdByAdmin: true,
            kycStatus: "approved",
            isWalletConnected: true,
            roleGrantTransactionHash: receipt.hash,
          })
          .returning();

        console.log(
          `✅ New sub-admin created in database with ID: ${newUser.id}`,
        );
        return newUser;
      },
      relatedEntity: { type: "user", id: null },
    });

    console.log(
      `✅ Subadmin created and role granted on blockchain. Transaction: ${result.transactionHash}`,
    );
    res.json({
      success: true,
      message: "Subadmin created successfully",
      transactionHash: result.transactionHash,
    });
  } catch (error) {
    console.error("Error creating subadmin:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create subadmin",
      error: error.message,
    });
  }
};

export const createVerifier = async (req, res) => {
  const {
    email,
    firstName,
    lastName,
    password,
    walletAddress: newVerifierWallet,
    signature,
    message,
  } = req.body;

  try {
    await verifyActionSignature(
      req.user.id,
      req.user.walletAddress || newVerifierWallet,
      "create_verifier",
      signature,
      message,
    );

    if (!email || !firstName || !lastName || !newVerifierWallet) {
      return res.status(400).json({
        success: false,
        message:
          "Email, first name, last name, and wallet address are required",
      });
    }

    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    const VERIFIER_ROLE = ethers.id("VERIFIER_ROLE");

    if (existingUser) {
      if (!existingUser.walletAddress) {
        return res.status(400).json({
          success: false,
          message:
            "User must have a connected wallet to receive blockchain role",
        });
      }

      // Grant VERIFIER_ROLE on blockchain and update DB atomically
      const result = await web3Service.executeTransaction({
        contract: "RoleManager",
        function: "grantRoleByAdmin",
        args: [VERIFIER_ROLE, existingUser.walletAddress],
        dbOperation: async (receipt) => {
          await db
            .update(users)
            .set({
              role: "verifier",
              roleGrantTransactionHash: receipt.hash,
            })
            .where(eq(users.id, existingUser.id));

          console.log(
            `✅ User ${existingUser.email} promoted to verifier in database`,
          );
          return { userId: existingUser.id, role: "verifier" };
        },
        relatedEntity: { type: "user", id: existingUser.id },
      });

      console.log(
        `✅ Verifier role granted on blockchain. Transaction: ${result.transactionHash}`,
      );
      return res.json({
        success: true,
        message: "User promoted to verifier",
        transactionHash: result.transactionHash,
      });
    }

    // Create new user and grant role on blockchain
    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : await bcrypt.hash("ChangeMe123!", 10);

    // Ensure wallet address is properly checksummed to avoid ENS resolution
    const checksummedWallet = ethers.getAddress(newVerifierWallet);

    // Grant role on blockchain first, then create user in DB
    const result = await web3Service.executeTransaction({
      contract: "RoleManager",
      function: "grantRoleByAdmin",
      args: [VERIFIER_ROLE, checksummedWallet],
      dbOperation: async (receipt) => {
        const [newUser] = await db
          .insert(users)
          .values({
            email,
            password: hashedPassword,
            firstName,
            lastName,
            walletAddress: checksummedWallet.toLowerCase(),
            role: "verifier",
            createdByAdmin: true,
            kycStatus: "approved",
            isWalletConnected: true,
            roleGrantTransactionHash: receipt.hash,
          })
          .returning();

        console.log(
          `✅ New verifier created in database with ID: ${newUser.id}`,
        );
        return newUser;
      },
      relatedEntity: { type: "user" }, // ID will be set after user creation
    });

    console.log(
      `✅ Verifier created and role granted on blockchain. Transaction: ${result.transactionHash}`,
    );
    res.json({
      success: true,
      message: "Verifier created successfully",
      transactionHash: result.transactionHash,
    });
  } catch (error) {
    console.error("Error creating verifier:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create verifier",
      error: error.message,
    });
  }
};

// =============================================================================
// PROPERTY TOKENIZATION (Admin Only)
// =============================================================================

/**
 * Get verified properties eligible for tokenization
 */
export const getPropertiesForTokenization = async (req, res) => {
  try {
    // Fetch all verified properties that haven't been tokenized yet
    const verifiedProperties = await db
      .select({
        id: properties.id,
        title: properties.title,
        description: properties.description,
        location: properties.location,
        propertyValue: properties.propertyValue,
        totalFractionalSupply: properties.totalFractionalSupply,
        assetRegistryId: properties.assetRegistryId,
        status: properties.status,
        nftTokenId: properties.nftTokenId,
        fractionalTokenAddress: properties.fractionalTokenAddress,
        verifiedAt: properties.verifiedAt,
        metadataUrl: properties.metadataUrl,
        listerId: properties.listerId,
      })
      .from(properties)
      .where(
        sql`${properties.status} in ('verified', 'tokenized', 'open_for_investment', 'active')`,
      );

    // Add lister information
    const propertiesWithDetails = await Promise.all(
      verifiedProperties.map(async (property) => {
        const [lister] = await db
          .select({
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            walletAddress: users.walletAddress,
          })
          .from(users)
          .where(eq(users.id, property.listerId))
          .limit(1);

        let investmentPoolCreated = false;
        if (property.nftTokenId) {
          try {
            const pool = await investmentService.getInvestmentPool(
              Number(property.nftTokenId),
            );
            investmentPoolCreated = Boolean(pool?.isOpen);
          } catch (poolError) {
            console.warn(
              `Could not fetch pool state for nftTokenId=${property.nftTokenId}:`,
              poolError.message,
            );
          }
        }

        return {
          ...property,
          assetRegistryId: property.assetRegistryId?.toString(),
          lister,
          investmentPoolCreated,
          canBeTokenized:
            !property.nftTokenId && !property.fractionalTokenAddress,
        };
      }),
    );

    res.json(
      serializeBigInt({
        success: true,
        properties: propertiesWithDetails,
        count: propertiesWithDetails.length,
      }),
    );
  } catch (error) {
    console.error("Error fetching properties for tokenization:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch properties for tokenization",
    });
  }
};

/**
 * Get single property details for tokenization
 */
export const getPropertyTokenizationDetails = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const propertyIdInt = parseInt(propertyId, 10);
    if (isNaN(propertyIdInt) || propertyIdInt <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid property ID" });
    }

    const propertyDetails =
      await tokenizationService.getPropertyForTokenization(propertyIdInt);

    res.json(
      serializeBigInt({
        success: true,
        property: propertyDetails,
      }),
    );
  } catch (error) {
    console.error("Error fetching property tokenization details:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch property details",
    });
  }
};

/**
 * Tokenize a verified property (Admin only)
 * POST /api/admin/properties/:propertyId/tokenize
 * Body: {
 *   fractionalTokenName: string,
 *   fractionalTokenSymbol: string,
 *   totalFractionalSupply: number,
 *   propertyValuation: number,
 *   metadataURI: string,
 *   treasuryAddress?: string,
 *   signature: string,
 *   message: string
 * }
 */
export const tokenizeProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const propertyIdInt = parseInt(propertyId, 10);
    if (isNaN(propertyIdInt) || propertyIdInt <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid property ID" });
    }
    const {
      fractionalTokenName,
      fractionalTokenSymbol,
      totalFractionalSupply,
      propertyValuation,
      metadataURI,
      treasuryAddress,
      signature,
      message,
    } = req.body;

    // Validate required fields
    if (
      !fractionalTokenName ||
      !fractionalTokenSymbol ||
      !totalFractionalSupply ||
      !propertyValuation
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required tokenization parameters",
      });
    }

    // Verify admin signature
    if (signature && message) {
      const isValid = await verifyActionSignature(
        req.user.id,
        req.user.walletAddress,
        "tokenize_property",
        signature,
        message,
      );
      if (!isValid) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid signature" });
      }
    }

    console.log(
      `🎯 Admin ${req.user.email} initiating tokenization for property ${propertyId}`,
    );

    // Call tokenization service
    const result = await tokenizationService.tokenizeProperty({
      propertyId: propertyIdInt,
      adminWalletAddress: req.user.walletAddress,
      fractionalTokenName,
      fractionalTokenSymbol,
      totalFractionalSupply: parseFloat(totalFractionalSupply),
      propertyValuation: parseFloat(propertyValuation),
      metadataURI,
      treasuryAddress,
    });

    // Store tokenization signature in database
    if (signature && message) {
      await db
        .update(properties)
        .set({
          tokenizationSignature: signature,
          tokenizationMessage: message,
        })
        .where(eq(properties.id, propertyIdInt));
    }

    console.log(`✅ Property ${propertyId} successfully tokenized`);

    res.json(
      serializeBigInt({
        success: true,
        message: "Property successfully tokenized",
        data: result,
      }),
    );
  } catch (error) {
    console.error("❌ Tokenization failed:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to tokenize property",
      error: error.toString(),
    });
  }
};

/**
 * Activate property for investment
 * POST /api/admin/properties/:nftTokenId/activate
 */
export const activatePropertyForInvestment = async (req, res) => {
  try {
    const { nftTokenId } = req.params;
    const nftTokenIdInt = parseInt(nftTokenId, 10);
    if (isNaN(nftTokenIdInt) || nftTokenIdInt < 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid NFT token ID" });
    }
    const { signature, message } = req.body;

    // Verify admin signature
    if (signature && message) {
      const isValid = await verifyActionSignature(
        req.user.id,
        req.user.walletAddress,
        "activate_property",
        signature,
        message,
      );
      if (!isValid) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid signature" });
      }
    }

    const result =
      await tokenizationService.activatePropertyForInvestment(nftTokenIdInt);

    res.json(
      serializeBigInt({
        success: true,
        message: "Property activated for investment",
        data: result,
      }),
    );
  } catch (error) {
    console.error("Failed to activate property:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to activate property",
    });
  }
};

/**
 * Enable trading for fractional tokens
 * POST /api/admin/tokens/:tokenAddress/enable-trading
 */
export const enableTokenTrading = async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const { signature, message } = req.body;

    // Verify admin signature
    if (signature && message) {
      const isValid = await verifyActionSignature(
        req.user.id,
        req.user.walletAddress,
        "enable_trading",
        signature,
        message,
      );
      if (!isValid) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid signature" });
      }
    }

    const result = await tokenizationService.enableTokenTrading(tokenAddress);

    res.json(
      serializeBigInt({
        success: true,
        message: "Trading enabled for fractional tokens",
        data: result,
      }),
    );
  } catch (error) {
    console.error("Failed to enable trading:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to enable trading",
    });
  }
};

/**
 * Get tokenization status for a property
 * GET /api/admin/properties/:propertyId/tokenization-status
 */
export const getTokenizationStatus = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const propertyIdInt = parseInt(propertyId, 10);
    if (isNaN(propertyIdInt) || propertyIdInt <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid property ID" });
    }

    const status =
      await tokenizationService.getTokenizationStatus(propertyIdInt);

    res.json(
      serializeBigInt({
        success: true,
        data: status,
      }),
    );
  } catch (error) {
    console.error("Failed to get tokenization status:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get tokenization status",
    });
  }
};

// ============================================================================
// TRANSACTION WORKFLOW MANAGEMENT
// ============================================================================

/**
 * Get all failed workflows with details
 * GET /api/admin/workflows/failed
 */
export const getFailedWorkflows = async (req, res) => {
  try {
    const { workflowType } = req.query;

    const filters = {};
    if (workflowType) {
      filters.workflowType = workflowType;
    }

    const failedWorkflows =
      await web3Service.transactionManager.getFailedWorkflows(filters);

    res.json({
      success: true,
      count: failedWorkflows.length,
      data: failedWorkflows,
    });
  } catch (error) {
    console.error("Failed to get failed workflows:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve failed workflows",
    });
  }
};

/**
 * Get workflow details with all associated transactions
 * GET /api/admin/workflows/:workflowId
 */
export const getWorkflowDetails = async (req, res) => {
  try {
    const { workflowId } = req.params;

    const workflowDetails =
      await web3Service.transactionManager.getWorkflowStatus(workflowId);

    res.json({
      success: true,
      data: workflowDetails,
    });
  } catch (error) {
    console.error("Failed to get workflow details:", error);
    res.status(404).json({
      success: false,
      message: error.message || "Workflow not found",
    });
  }
};

/**
 * Retry a failed workflow
 * POST /api/admin/workflows/:workflowId/retry
 */
export const retryWorkflow = async (req, res) => {
  try {
    const { workflowId } = req.params;

    // Note: Retry requires the original workflow steps to be reconstructed
    // This is a placeholder that returns an informative message
    res.status(501).json({
      success: false,
      message:
        "Workflow retry requires manual intervention. Please reconstruct the failed steps and resubmit the operation.",
      workflowId,
      suggestion:
        "View workflow details to identify which step failed, then manually trigger that specific operation again.",
    });
  } catch (error) {
    console.error("Failed to retry workflow:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retry workflow",
    });
  }
};

// ============================================================================
// IPFS CLEANUP MANAGEMENT
// ============================================================================

/**
 * Get all orphaned IPFS content
 * GET /api/admin/ipfs/orphaned
 */
export const getOrphanedIPFSContent = async (req, res) => {
  try {
    const { olderThanHours = 24 } = req.query;

    const orphanedContent = await ipfsCleanupService.getOrphanedUploads(
      parseInt(olderThanHours),
    );

    // Calculate total size
    const totalSize = orphanedContent.reduce(
      (sum, item) => sum + (item.fileSize || 0),
      0,
    );

    res.json({
      success: true,
      count: orphanedContent.length,
      totalSizeBytes: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      data: orphanedContent,
    });
  } catch (error) {
    console.error("Failed to get orphaned IPFS content:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve orphaned IPFS content",
    });
  }
};

/**
 * Reconcile KYC status between blockchain and database
 * POST /api/admin/kyc/:userId/reconcile
 */
export const reconcileKYC = async (req, res) => {
  try {
    const { userId } = req.params;

    const userIdInt = parseInt(userId, 10);
    if (!userId || isNaN(userIdInt) || userIdInt <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Get user with wallet address
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userIdInt))
      .limit(1);

    if (!user || !user.walletAddress) {
      return res.status(404).json({
        success: false,
        message: "User not found or wallet not connected",
      });
    }

    // Get KYC submission from database
    const [kycSubmission] = await db
      .select()
      .from(kycSubmissions)
      .where(eq(kycSubmissions.userId, user.id))
      .limit(1);

    if (!kycSubmission) {
      return res.status(404).json({
        success: false,
        message: "No KYC submission found for this user",
      });
    }

    // Connect to blockchain and check actual status
    const RPC_URL = process.env.RPC_URL || "http://localhost:8545";
    const CHAIN_ID = process.env.CHAIN_ID || "31337";
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    const addresses = addressesData[CHAIN_ID];
    if (!addresses || !addresses.KYCRegistry) {
      return res.status(500).json({
        success: false,
        message: "KYC Registry contract address not found",
      });
    }

    const kycRegistry = new ethers.Contract(
      addresses.KYCRegistry,
      KYCRegistryABI.abi,
      provider,
    );

    // Query blockchain for actual KYC status
    const isApprovedOnChain = await kycRegistry.isKYCApproved(
      user.walletAddress,
    );

    const blockchainStatus = isApprovedOnChain ? "approved" : "pending";
    const databaseStatus = kycSubmission.status;

    // Check if reconciliation is needed
    if (blockchainStatus === databaseStatus) {
      return res.json({
        success: true,
        message: "KYC status is already in sync",
        data: {
          userId: user.id,
          walletAddress: user.walletAddress,
          status: databaseStatus,
          inSync: true,
        },
      });
    }

    // Reconcile: Update database to match blockchain
    await db
      .update(kycSubmissions)
      .set({
        status: blockchainStatus,
        reviewedAt:
          blockchainStatus === "approved"
            ? new Date()
            : kycSubmission.reviewedAt,
      })
      .where(eq(kycSubmissions.id, kycSubmission.id));

    await db
      .update(users)
      .set({
        kycStatus: blockchainStatus,
      })
      .where(eq(users.id, user.id));

    console.log(
      `🔧 Reconciled KYC for user ${user.email || user.walletAddress}: ${databaseStatus} → ${blockchainStatus}`,
    );

    res.json({
      success: true,
      message: "KYC status reconciled successfully",
      data: {
        userId: user.id,
        walletAddress: user.walletAddress,
        previousStatus: databaseStatus,
        currentStatus: blockchainStatus,
        reconciledAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Failed to reconcile KYC:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to reconcile KYC status",
    });
  }
};

/**
 * Manually trigger cleanup of orphaned IPFS content
 * POST /api/admin/ipfs/cleanup
 */
export const cleanupOrphanedIPFS = async (req, res) => {
  try {
    const { olderThanHours = 24, maxCount = 50 } = req.body;

    console.log(
      `🧹 Admin triggered IPFS cleanup: older than ${olderThanHours}h, max ${maxCount} items`,
    );

    const result = await ipfsCleanupService.bulkCleanupOrphaned(
      parseInt(olderThanHours),
      parseInt(maxCount),
    );

    res.json({
      success: true,
      message: `Cleanup completed: ${result.success} succeeded, ${result.failed} failed`,
      data: result,
    });
  } catch (error) {
    console.error("Failed to cleanup orphaned IPFS content:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to cleanup orphaned IPFS content",
    });
  }
};

// ============================================================================
// INVESTMENT POOL MANAGEMENT
// ============================================================================

const INVESTMENT_POOL_ERROR_MESSAGES = {
  "0x0f06640b": "Investment pool already exists for this property",
  "0x32bcdba7": "Investment pool is closed for this property",
  "0x2518cfaa": "Investment amount is below the configured minimum",
  "0x33ad5f00": "Not enough fractional tokens are available in the treasury",
  "0xbd2f231e": "Token transfer failed while creating the investment pool",
};

const extractRevertSelector = (error) => {
  const candidates = [
    error?.data,
    error?.error?.data,
    error?.info?.error?.data,
    error?.message,
    error?.shortMessage,
  ]
    .filter(Boolean)
    .map((value) => String(value));

  for (const candidate of candidates) {
    const directMatch = candidate.match(/0x[a-fA-F0-9]{8}/);
    if (directMatch?.[0]) {
      return directMatch[0].toLowerCase();
    }

    const dataMatch = candidate.match(/data["'=:\s]+(0x[a-fA-F0-9]{8})/i);
    if (dataMatch?.[1]) {
      return dataMatch[1].toLowerCase();
    }
  }

  return null;
};

/**
 * Create investment pool for a tokenized property
 * POST /api/admin/properties/:propertyId/create-pool
 */
export const createInvestmentPoolHandler = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { pricePerToken, minInvestment } = req.body;

    // Validate required fields
    if (!pricePerToken || !minInvestment) {
      return res.status(400).json({
        success: false,
        message: "Price per token and minimum investment are required",
      });
    }

    // Fetch property and verify it's tokenized
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, parseInt(propertyId)));

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    if (!property.nftTokenId) {
      return res.status(400).json({
        success: false,
        message: "Property must be tokenized before creating investment pool",
      });
    }

    // Create investment pool on blockchain
    console.log(
      `🏊 Admin ${req.user.email} creating investment pool for property ${propertyId}`,
    );

    const receipt = await investmentService.createInvestmentPool({
      nftTokenId: property.nftTokenId,
      pricePerToken: parseFloat(pricePerToken),
      minInvestment: parseFloat(minInvestment),
    });

    // Update property status
    await db
      .update(properties)
      .set({
        status: "tokenized", // Ensure status is correct
        updatedAt: new Date(),
      })
      .where(eq(properties.id, parseInt(propertyId)));

    console.log(
      `✅ Investment pool created successfully for property ${propertyId}`,
    );

    const response = serializeBigInt({
      success: true,
      message: "Investment pool created successfully",
      data: {
        propertyId: property.id,
        nftTokenId: property.nftTokenId,
        pricePerToken,
        minInvestment,
        transactionHash: receipt.hash,
      },
    });

    res.json(response);
  } catch (error) {
    console.error("Failed to create investment pool:", error);

    const selector = extractRevertSelector(error);
    const mappedMessage = selector
      ? INVESTMENT_POOL_ERROR_MESSAGES[selector]
      : null;

    if (selector === "0x0f06640b") {
      const propertyIdInt = Number.parseInt(req.params.propertyId, 10);
      if (!Number.isNaN(propertyIdInt)) {
        await db
          .update(properties)
          .set({
            status: "tokenized",
            updatedAt: new Date(),
          })
          .where(eq(properties.id, propertyIdInt));
      }

      return res.json({
        success: true,
        message: "Investment pool already exists on-chain. Local state synchronized.",
        data: {
          propertyId: propertyIdInt,
          alreadyExists: true,
          revertSelector: selector,
        },
      });
    }

    res.status(mappedMessage ? 400 : 500).json({
      success: false,
      message: mappedMessage || error.message || "Failed to create investment pool",
      ...(selector ? { revertSelector: selector } : {}),
    });
  }
};

// ============================================================================
// PAYMENT VERIFICATION
// ============================================================================

/**
 * Get all pending payment verifications
 * GET /api/admin/payments/pending
 */
export const getPendingPaymentsHandler = async (req, res) => {
  try {
    console.log(
      `📋 Admin ${req.user.email} fetching pending payment verifications`,
    );

    // Fetch investments with pending payment status and their proofs
    const pendingPayments = await db
      .select({
        investmentId: investments.id,
        userId: investments.userId,
        propertyId: investments.propertyId,
        fiatAmount: investments.fiatAmount,
        paymentCurrency: investments.paymentCurrency,
        paymentMethod: investments.paymentMethod,
        paymentStatus: investments.paymentStatus,
        investedAt: investments.investedAt,
        proofId: paymentProofs.id,
        proofType: paymentProofs.proofType,
        documentUrl: paymentProofs.documentUrl,
        documentHash: paymentProofs.documentHash,
        bankReference: paymentProofs.bankReference,
        transactionReference: paymentProofs.transactionReference,
        proofAmount: paymentProofs.amount,
        proofCurrency: paymentProofs.currency,
        uploadedAt: paymentProofs.uploadedAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
        userWallet: users.walletAddress,
        propertyTitle: properties.title,
        propertyLocation: properties.location,
      })
      .from(investments)
      .leftJoin(paymentProofs, eq(investments.paymentProofId, paymentProofs.id))
      .leftJoin(users, eq(investments.userId, users.id))
      .leftJoin(properties, eq(investments.propertyId, properties.id))
      .where(eq(investments.paymentStatus, "pending_verification"))
      .orderBy(investments.investedAt);

    console.log(
      `✅ Found ${pendingPayments.length} pending payment verifications`,
    );

    const response = serializeBigInt({
      success: true,
      data: pendingPayments,
    });

    res.json(response);
  } catch (error) {
    console.error("Failed to fetch pending payments:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch pending payment verifications",
    });
  }
};

/**
 * Verify and approve/reject a payment proof
 * POST /api/admin/payments/:investmentId/verify
 */
export const verifyPaymentHandler = async (req, res) => {
  try {
    const { investmentId } = req.params;
    const { approved, rejectionReason } = req.body;
    const adminId = req.user.id;

    console.log(
      `🔍 Admin ${req.user.email} ${approved ? "approving" : "rejecting"} payment for investment ${investmentId}`,
    );

    // Fetch investment
    const [investment] = await db
      .select()
      .from(investments)
      .where(eq(investments.id, parseInt(investmentId)));

    if (!investment) {
      return res.status(404).json({
        success: false,
        message: "Investment not found",
      });
    }

    if (investment.paymentStatus !== "pending_verification") {
      return res.status(400).json({
        success: false,
        message: `Payment is not pending verification (current status: ${investment.paymentStatus})`,
      });
    }

    if (approved) {
      // Update payment proof with verification details
      if (investment.paymentProofId) {
        await db
          .update(paymentProofs)
          .set({
            verifiedBy: adminId,
            verifiedAt: new Date(),
            status: "verified",
          })
          .where(eq(paymentProofs.id, investment.paymentProofId));
      }

      // Mark payment completed through canonical payment workflow.
      const completionResult = await paymentService.processPaymentCompletion(
        parseInt(investmentId),
      );

      console.log(
        `✅ Payment verified and completed for investment ${investmentId}`,
      );

      res.json({
        success: true,
        message: "Payment verified and investment completed successfully.",
        data: {
          investmentId: completionResult.investment.id,
          paymentStatus: completionResult.investment.paymentStatus,
          completedAt: completionResult.investment.completedAt,
        },
      });
    } else {
      // Reject payment
      if (!rejectionReason) {
        return res.status(400).json({
          success: false,
          message: "Rejection reason is required",
        });
      }

      // Update payment proof
      if (investment.paymentProofId) {
        await db
          .update(paymentProofs)
          .set({
            verifiedBy: adminId,
            verifiedAt: new Date(),
            status: "rejected",
            rejectionReason,
          })
          .where(eq(paymentProofs.id, investment.paymentProofId));
      }

      // Update investment status
      await db
        .update(investments)
        .set({
          paymentStatus: "failed",
        })
        .where(eq(investments.id, parseInt(investmentId)));

      console.log(`❌ Payment rejected for investment ${investmentId}`);

      res.json({
        success: true,
        message: "Payment rejected",
        data: {
          investmentId: investment.id,
          paymentStatus: "failed",
          rejectionReason,
        },
      });
    }
  } catch (error) {
    console.error("Failed to verify payment:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to verify payment",
    });
  }
};
