import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  properties,
  propertyDocuments,
  users,
  verifierAssignments,
} from "../db/schema.js";
import walletAuthService from "../services/walletAuthService.js";
import { web3Service } from "../services/web3Service.js";

// Helper to recursively convert ALL BigInt values to strings for JSON serialization
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

// Compatibility alias for existing code
const serializeProperty = serializeBigInt;

/**
 * Get verifier dashboard stats
 */
export const getVerifierDashboard = async (req, res) => {
  try {
    const verifierId = req.user.id;

    console.log("Fetching stats for verifier:", verifierId);

    // Get assigned properties via verifierAssignments
    let assignments = [];
    try {
      assignments = await db.query.verifierAssignments.findMany({
        where: eq(verifierAssignments.verifierId, verifierId),
        with: {
          property: {
            with: {
              lister: {
                columns: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          assignedByUser: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: [desc(verifierAssignments.assignedAt)],
      });
    } catch (err) {
      console.warn("Failed to fetch verifierAssignments:", err.message);
      assignments = [];
    }

    // Also get properties assigned directly via properties.assignedVerifierId (fallback)
    let directAssignments = [];
    try {
      directAssignments = await db.query.properties.findMany({
        where: eq(properties.assignedVerifierId, verifierId),
        with: {
          lister: true,
        },
      });
    } catch (err) {
      console.warn("Failed to fetch direct assignments:", err.message);
      directAssignments = [];
    }

    console.log("Assignments found:", {
      viaAssignmentsTable: assignments.length,
      viaPropertiesTable: directAssignments.length,
      assignments: assignments.map((a) => ({
        id: a.id,
        propertyId: a.propertyId,
        status: a.status,
        propertyStatus: a.property?.status,
      })),
      directAssignments: directAssignments.map((p) => ({
        id: p.id,
        status: p.status,
        assignedVerifierId: p.assignedVerifierId,
      })),
    });

    // Combine both sources for stats
    const allAssignments = [...(assignments || [])];

    // Add direct assignments that aren't in verifierAssignments
    (directAssignments || []).forEach((prop) => {
      const existsInAssignments = (assignments || []).some(
        (a) => a.propertyId === prop.id,
      );
      if (!existsInAssignments) {
        allAssignments.push({
          id: null,
          propertyId: prop.id,
          status:
            prop.status === "verified" || prop.status === "rejected"
              ? "completed"
              : "assigned",
          property: prop,
        });
      }
    });

    const stats = {
      totalAssignments: allAssignments.length || 0,
      pendingAssignments:
        allAssignments.filter((a) => a.status === "assigned").length || 0,
      inProgressAssignments:
        allAssignments.filter((a) => a.status === "in_progress").length || 0,
      completedAssignments:
        allAssignments.filter((a) => a.status === "completed").length || 0,
      approvedCount:
        allAssignments.filter((a) => a.property?.status === "verified")
          .length || 0,
      rejectedCount:
        allAssignments.filter((a) => a.property?.status === "rejected")
          .length || 0,
    };

    console.log("Calculated stats:", stats);

    res.json(
      serializeBigInt({
        success: true,
        stats: {
          totalAssigned: stats.totalAssignments,
          pendingReview: stats.pendingAssignments,
          approved: stats.approvedCount,
          rejected: stats.rejectedCount,
        },
      }),
    );
  } catch (error) {
    console.error("Error fetching verifier dashboard:", error);
    console.error("Error details:", error.message, error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to fetch verifier dashboard",
      error: error.message,
    });
  }
};

/**
 * Get assigned properties for verification
 */
export const getAssignedProperties = async (req, res) => {
  try {
    const verifierId = req.user.id;
    const { status } = req.query;

    console.log("Fetching assigned properties for verifier:", verifierId);

    // Fetch assignments with joins
    const assignments = await db
      .select({
        id: verifierAssignments.id,
        status: verifierAssignments.status,
        assignedAt: verifierAssignments.assignedAt,
        completedAt: verifierAssignments.completedAt,
        notes: verifierAssignments.notes,
        propertyId: verifierAssignments.propertyId,
        property: properties,
      })
      .from(verifierAssignments)
      .innerJoin(properties, eq(verifierAssignments.propertyId, properties.id))
      .where(eq(verifierAssignments.verifierId, verifierId));

    console.log("Found assignments:", assignments.length);

    // Fetch lister and documents for each property
    const enrichedAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        const [lister] = await db
          .select()
          .from(users)
          .where(eq(users.id, assignment.property.listerId))
          .limit(1);

        const documents = await db
          .select()
          .from(propertyDocuments)
          .where(eq(propertyDocuments.propertyId, assignment.property.id));

        return {
          id: assignment.id,
          status: assignment.status,
          assignedAt: assignment.assignedAt,
          completedAt: assignment.completedAt,
          notes: assignment.notes,
          property: {
            ...serializeProperty(assignment.property),
            lister,
            documentsCount: documents.length,
            documents: documents.map((doc) => ({
              id: doc.id,
              documentType: doc.documentType,
              fileName: doc.fileName,
              fileSize: doc.fileSize,
              mimeType: doc.mimeType,
              filePath: doc.filePath,
              ipfsHash: doc.ipfsHash,
              ipfsUrl: doc.ipfsUrl,
              verificationStatus: doc.verificationStatus,
              uploadedAt: doc.uploadedAt,
              // Frontend compatibility key for document view actions
              fileUrl: doc.ipfsUrl || doc.filePath || null,
            })),
          },
        };
      }),
    );

    console.log("Enriched assignments:", enrichedAssignments.length);

    res.json({
      success: true,
      data: serializeBigInt(enrichedAssignments),
    });
  } catch (error) {
    console.error("Error fetching assigned properties:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to fetch assigned properties",
      error: error.message,
    });
  }
};

/**
 * Get property details for verification
 */
export const getPropertyForVerification = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const verifierId = req.user.id;

    // Check if verifier is assigned to this property
    const assignment = await db.query.verifierAssignments.findFirst({
      where: and(
        eq(verifierAssignments.verifierId, verifierId),
        eq(verifierAssignments.propertyId, parseInt(propertyId)),
      ),
    });

    if (!assignment) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to verify this property",
      });
    }

    // Get property with all related data
    const property = await db.query.properties.findFirst({
      where: eq(properties.id, parseInt(propertyId)),
      with: {
        lister: true,
        propertyDocuments: true,
        propertyImages: true,
        assignedVerifier: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedByUser: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    res.json(
      serializeBigInt({
        success: true,
        property: {
          id: property.id,
          title: property.title,
          description: property.description,
          location: property.location,
          propertyValue: property.propertyValue,
          status: property.status,
          lister: property.lister,
          assignedVerifier: property.assignedVerifier,
          assignedBy: property.assignedByUser,
          assignedAt: property.assignedAt,
          createdAt: property.createdAt,
          hasSubmissionSignature: !!property.submissionSignature,
          documents: property.propertyDocuments.map((doc) => ({
            id: doc.id,
            documentType: doc.documentType,
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            mimeType: doc.mimeType,
            ipfsHash: doc.ipfsHash,
            ipfsUrl: doc.ipfsUrl,
            verificationStatus: doc.verificationStatus,
            uploadedAt: doc.uploadedAt,
            hasUploadSignature: !!doc.uploadSignature,
          })),
          images: property.propertyImages.map((img) => ({
            id: img.id,
            fileName: img.fileName,
            fileSize: img.fileSize,
            mimeType: img.mimeType,
            ipfsHash: img.ipfsHash,
            ipfsUrl: img.ipfsUrl,
            isPrimary: img.isPrimary,
            uploadedAt: img.uploadedAt,
            hasUploadSignature: !!img.uploadSignature,
          })),
        },
        assignment: {
          id: assignment.id,
          status: assignment.status,
          assignedAt: assignment.assignedAt,
          notes: assignment.notes,
        },
      }),
    );
  } catch (error) {
    console.error("Error fetching property for verification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch property details",
      error: error.message,
    });
  }
};

/**
 * Start property verification (mark as in progress)
 */
export const startVerification = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { signature, message } = req.body;
    const verifierId = req.user.id;

    // Verify verifier wallet session and signature
    await walletAuthService.verifyActionSignature(
      verifierId,
      req.user.walletAddress,
      "start_verification",
      signature,
      message,
      "property",
      parseInt(propertyId),
    );

    // Check if verifier is assigned to this property
    const assignment = await db.query.verifierAssignments.findFirst({
      where: and(
        eq(verifierAssignments.verifierId, verifierId),
        eq(verifierAssignments.propertyId, parseInt(propertyId)),
      ),
    });

    if (!assignment) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to verify this property",
      });
    }

    if (assignment.status !== "assigned") {
      return res.status(400).json({
        success: false,
        message: "Property verification is not in assigned status",
      });
    }

    // Update assignment status to in_progress
    await db
      .update(verifierAssignments)
      .set({
        status: "in_progress",
      })
      .where(eq(verifierAssignments.id, assignment.id));

    res.json({
      success: true,
      message: "Property verification started",
    });
  } catch (error) {
    console.error("Error starting verification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start verification",
      error: error.message,
    });
  }
};

/**
 * Verify property documents
 */
export const verifyPropertyDocuments = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { documentId, verificationStatus, notes, signature, message } =
      req.body;
    const verifierId = req.user.id;

    // Verify verifier wallet session and signature
    await walletAuthService.verifyActionSignature(
      verifierId,
      req.user.walletAddress,
      "verify_document",
      signature,
      message,
      "document",
      parseInt(documentId),
    );

    // Check if verifier is assigned to this property
    const assignment = await db.query.verifierAssignments.findFirst({
      where: and(
        eq(verifierAssignments.verifierId, verifierId),
        eq(verifierAssignments.propertyId, parseInt(propertyId)),
      ),
    });

    if (!assignment) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to verify this property",
      });
    }

    // Validate verification status
    if (
      !["approved", "rejected", "requires_resubmission"].includes(
        verificationStatus,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification status",
      });
    }

    // Update document verification status
    await db
      .update(propertyDocuments)
      .set({
        verificationStatus,
        verifiedAt: new Date(),
        verifiedBy: verifierId,
      })
      .where(eq(propertyDocuments.id, parseInt(documentId)));

    res.json({
      success: true,
      message: "Document verification updated",
    });
  } catch (error) {
    console.error("Error verifying document:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify document",
      error: error.message,
    });
  }
};

/**
 * Complete property verification
 */
export const completeVerification = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { verificationResult, notes, signature, message } = req.body;
    const verifierId = req.user.id;

    // Verify verifier wallet session and signature
    await walletAuthService.verifyActionSignature(
      verifierId,
      req.user.walletAddress,
      "complete_verification",
      signature,
      message,
      "property",
      parseInt(propertyId),
    );

    // Check if verifier is assigned to this property
    const assignment = await db.query.verifierAssignments.findFirst({
      where: and(
        eq(verifierAssignments.verifierId, verifierId),
        eq(verifierAssignments.propertyId, parseInt(propertyId)),
      ),
    });

    if (!assignment) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to verify this property",
      });
    }

    if (assignment.status !== "in_progress") {
      return res.status(400).json({
        success: false,
        message: "Property verification is not in progress",
      });
    }

    // Validate verification result
    if (!["verified", "rejected"].includes(verificationResult)) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification result",
      });
    }

    // Update property status
    const newPropertyStatus =
      verificationResult === "verified" ? "verified" : "rejected";

    await db
      .update(properties)
      .set({
        status: newPropertyStatus,
        verifiedBy: verifierId,
        verifiedAt: new Date(),
        verificationSignature: signature,
        verificationMessage: message,
      })
      .where(eq(properties.id, parseInt(propertyId)));

    // Update assignment status to completed
    await db
      .update(verifierAssignments)
      .set({
        status: "completed",
        completedAt: new Date(),
        notes,
      })
      .where(eq(verifierAssignments.id, assignment.id));

    res.json({
      success: true,
      message: `Property verification completed: ${verificationResult}`,
      verificationResult,
    });
  } catch (error) {
    console.error("Error completing verification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete verification",
      error: error.message,
    });
  }
};

/**
 * Approve property verification (simplified endpoint)
 */
export const approveProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { signature, message, notes } = req.body;
    const verifierId = req.user.id;

    console.log("Approve property request:", {
      propertyId,
      verifierId,
      hasSignature: !!signature,
    });

    // Check if verifier is assigned to this property via verifierAssignments
    const assignment = await db.query.verifierAssignments.findFirst({
      where: and(
        eq(verifierAssignments.verifierId, verifierId),
        eq(verifierAssignments.propertyId, parseInt(propertyId)),
      ),
    });

    // Also check if verifier is assigned via properties.assignedVerifierId (fallback)
    const property = await db.query.properties.findFirst({
      where: eq(properties.id, parseInt(propertyId)),
    });

    console.log("Assignment check:", {
      assignment,
      propertyAssignedVerifier: property?.assignedVerifierId,
    });

    if (!assignment && property?.assignedVerifierId !== verifierId) {
      console.log("Access denied: Verifier not assigned to property");
      return res.status(403).json({
        success: false,
        message: "You are not assigned to verify this property",
      });
    }

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    if (!property.assetRegistryId) {
      return res.status(400).json({
        success: false,
        message:
          "Property not registered on blockchain yet. Admin must register it first.",
      });
    }

    // Get verifier's wallet address
    const [verifier] = await db
      .select()
      .from(users)
      .where(eq(users.id, verifierId))
      .limit(1);

    if (!verifier || !verifier.walletAddress) {
      return res.status(400).json({
        success: false,
        message: "Verifier wallet address not found",
      });
    }

    // For now, update database directly and emit event
    // The verifier should call the blockchain function directly from frontend
    await db
      .update(properties)
      .set({
        status: "verified",
        verifiedBy: verifierId,
        verifiedAt: new Date(),
        verificationSignature: signature,
        verificationMessage: message,
      })
      .where(eq(properties.id, parseInt(propertyId)));

    // Update assignment status to completed (only if assignment exists)
    if (assignment) {
      await db
        .update(verifierAssignments)
        .set({
          status: "completed",
          completedAt: new Date(),
          notes: notes || "Property approved",
        })
        .where(eq(verifierAssignments.id, assignment.id));
    }

    console.log(`✅ Property ${propertyId} verified successfully`);

    res.json(
      serializeBigInt({
        success: true,
        message:
          "Property approved successfully. Please confirm the blockchain transaction from your wallet.",
        requiresBlockchainConfirmation: true,
        contractAddress: web3Service.getContractAddress("AssetRegistry"),
        functionName: "verifyProperty",
        args: [property.assetRegistryId],
      }),
    );
  } catch (error) {
    console.error("Error approving property:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve property",
      error: error.message,
    });
  }
};

/**
 * Reject property verification (simplified endpoint)
 */
export const rejectProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { walletAddress, transactionHash, reason, notes } = req.body;
    const verifierId = req.user.id;

    console.log("Reject property request:", {
      propertyId,
      verifierId,
      walletAddress,
      reason,
    });

    // Check if verifier is assigned to this property via verifierAssignments
    const assignment = await db.query.verifierAssignments.findFirst({
      where: and(
        eq(verifierAssignments.verifierId, verifierId),
        eq(verifierAssignments.propertyId, parseInt(propertyId)),
      ),
    });

    // Also check if verifier is assigned via properties.assignedVerifierId (fallback)
    const property = await db.query.properties.findFirst({
      where: eq(properties.id, parseInt(propertyId)),
    });

    console.log("Assignment check:", {
      assignment,
      propertyAssignedVerifier: property?.assignedVerifierId,
    });

    if (!assignment && property?.assignedVerifierId !== verifierId) {
      console.log("Access denied: Verifier not assigned to property");
      return res.status(403).json({
        success: false,
        message: "You are not assigned to verify this property",
      });
    }

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    // Update property status to rejected
    await db
      .update(properties)
      .set({
        status: "rejected",
        verifiedBy: verifierId,
        verifiedAt: new Date(),
        rejectionReason: reason || "Property rejected by verifier",
      })
      .where(eq(properties.id, parseInt(propertyId)));

    // Update assignment status to completed (only if assignment exists)
    if (assignment) {
      await db
        .update(verifierAssignments)
        .set({
          status: "completed",
          completedAt: new Date(),
          notes: notes || reason || "Property rejected",
        })
        .where(eq(verifierAssignments.id, assignment.id));
    }

    console.log(`✅ Property ${propertyId} rejected successfully`);
    res.json({
      success: true,
      message: "Property rejected successfully",
    });
  } catch (error) {
    console.error("Error rejecting property:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject property",
      error: error.message,
    });
  }
};

/**
 * Update verification progress for an assigned property
 */
export const updateVerificationProgress = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { status, notes } = req.body;
    const verifierId = req.user.id;

    const assignment = await db.query.verifierAssignments.findFirst({
      where: and(
        eq(verifierAssignments.verifierId, verifierId),
        eq(verifierAssignments.propertyId, parseInt(propertyId)),
      ),
    });

    if (!assignment) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to verify this property",
      });
    }

    const allowedStatuses = ["assigned", "in_progress", "completed"];
    const nextStatus = allowedStatuses.includes(status)
      ? status
      : assignment.status;

    const updatePayload = {
      status: nextStatus,
      notes:
        typeof notes === "string" && notes.trim()
          ? notes.trim()
          : assignment.notes,
    };

    if (nextStatus === "completed") {
      updatePayload.completedAt = new Date();
    }

    await db
      .update(verifierAssignments)
      .set(updatePayload)
      .where(eq(verifierAssignments.id, assignment.id));

    return res.json({
      success: true,
      message: "Verification progress updated",
      data: serializeBigInt({
        assignmentId: assignment.id,
        status: nextStatus,
        notes: updatePayload.notes,
      }),
    });
  } catch (error) {
    console.error("Error updating verification progress:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update verification progress",
      error: error.message,
    });
  }
};

/**
 * Store verification checklist for an assigned property
 */
export const submitVerificationChecklist = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const verifierId = req.user.id;
    const checklist = req.body || {};

    const assignment = await db.query.verifierAssignments.findFirst({
      where: and(
        eq(verifierAssignments.verifierId, verifierId),
        eq(verifierAssignments.propertyId, parseInt(propertyId)),
      ),
    });

    if (!assignment) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to verify this property",
      });
    }

    const checklistNote = `[checklist] ${JSON.stringify(checklist)}`;
    const mergedNotes = [assignment.notes, checklistNote]
      .filter(Boolean)
      .join("\n")
      .trim();

    await db
      .update(verifierAssignments)
      .set({
        status:
          assignment.status === "assigned" ? "in_progress" : assignment.status,
        notes: mergedNotes,
      })
      .where(eq(verifierAssignments.id, assignment.id));

    return res.json({
      success: true,
      message: "Verification checklist saved",
      data: serializeBigInt({
        assignmentId: assignment.id,
        checklist,
      }),
    });
  } catch (error) {
    console.error("Error submitting verification checklist:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit verification checklist",
      error: error.message,
    });
  }
};

/**
 * Request additional information from property owner
 */
export const requestAdditionalInfo = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const verifierId = req.user.id;
    const requestData = req.body || {};

    const assignment = await db.query.verifierAssignments.findFirst({
      where: and(
        eq(verifierAssignments.verifierId, verifierId),
        eq(verifierAssignments.propertyId, parseInt(propertyId)),
      ),
    });

    if (!assignment) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to verify this property",
      });
    }

    const infoRequestNote = `[request-info] ${JSON.stringify(requestData)}`;
    const mergedNotes = [assignment.notes, infoRequestNote]
      .filter(Boolean)
      .join("\n")
      .trim();

    await db
      .update(verifierAssignments)
      .set({
        status: "in_progress",
        notes: mergedNotes,
      })
      .where(eq(verifierAssignments.id, assignment.id));

    return res.json({
      success: true,
      message: "Additional information request saved",
      data: serializeBigInt({
        assignmentId: assignment.id,
        request: requestData,
      }),
    });
  } catch (error) {
    console.error("Error requesting additional information:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to request additional information",
      error: error.message,
    });
  }
};

/**
 * Get verification history
 */
export const getVerificationHistory = async (req, res) => {
  try {
    const verifierId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    const completedAssignments = await db.query.verifierAssignments.findMany({
      where: and(
        eq(verifierAssignments.verifierId, verifierId),
        eq(verifierAssignments.status, "completed"),
      ),
      with: {
        property: {
          with: {
            lister: {
              columns: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [desc(verifierAssignments.completedAt)],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json(
      serializeBigInt({
        success: true,
        history: completedAssignments.map((assignment) => ({
          id: assignment.id,
          completedAt: assignment.completedAt,
          notes: assignment.notes,
          property: {
            id: assignment.property.id,
            title: assignment.property.title,
            location: assignment.property.location,
            propertyValue: assignment.property.propertyValue,
            status: assignment.property.status,
            lister: assignment.property.lister,
          },
        })),
      }),
    );
  } catch (error) {
    console.error("Error fetching verification history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch verification history",
      error: error.message,
    });
  }
};

/**
 * Confirm blockchain verification transaction
 */
export const confirmBlockchainVerification = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { transactionHash } = req.body;
    const verifierId = req.user.id;

    console.log("Confirm blockchain verification:", {
      propertyId,
      verifierId,
      transactionHash,
    });

    // Verify the transaction exists and was successful
    await web3Service.ensureInitialized();
    const receipt =
      await web3Service.provider.getTransactionReceipt(transactionHash);

    if (!receipt) {
      return res.status(400).json({
        success: false,
        message: "Transaction not found",
      });
    }

    if (receipt.status === 0) {
      return res.status(400).json({
        success: false,
        message: "Transaction failed",
      });
    }

    // Update property with transaction hash
    await db
      .update(properties)
      .set({
        verificationTransactionHash: transactionHash,
      })
      .where(eq(properties.id, parseInt(propertyId)));

    console.log(
      `✅ Blockchain verification confirmed for property ${propertyId}`,
    );

    res.json({
      success: true,
      message: "Blockchain verification confirmed",
      transactionHash,
    });
  } catch (error) {
    console.error("Error confirming blockchain verification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to confirm blockchain verification",
      error: error.message,
    });
  }
};
