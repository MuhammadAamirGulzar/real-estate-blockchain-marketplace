import "dotenv/config";
import { and, eq, inArray, lt } from "drizzle-orm";
import fetch from "node-fetch";
import { db } from "../db/connection.js";
import { ipfsUploads } from "../db/schema.js";

// Pinata Configuration
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET = process.env.PINATA_API_SECRET;
const PINATA_JWT_TOKEN = process.env.PINATA_JWT_TOKEN;
const PINATA_API_URL = "https://api.pinata.cloud";

const hasPinataConfig =
  (PINATA_API_KEY && PINATA_API_SECRET) || PINATA_JWT_TOKEN;

/**
 * Get Authorization header for Pinata
 */
const getAuthHeaders = () => {
  if (PINATA_JWT_TOKEN) {
    return {
      Authorization: `Bearer ${PINATA_JWT_TOKEN}`,
    };
  }

  if (PINATA_API_KEY && PINATA_API_SECRET) {
    return {
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_API_SECRET,
    };
  }

  return {};
};

/**
 * Track IPFS upload in database
 * @param {Object} uploadData - Upload tracking data
 * @returns {Promise<Object>} Created upload record
 */
export const trackIPFSUpload = async (uploadData) => {
  try {
    const [record] = await db
      .insert(ipfsUploads)
      .values({
        cid: uploadData.cid,
        status: uploadData.status || "pending",
        linkedTransactionId: uploadData.linkedTransactionId || null,
        workflowId: uploadData.workflowId || null,
        contentType: uploadData.contentType || null,
        fileName: uploadData.fileName || null,
        fileSize: uploadData.fileSize || null,
        uploaderUserId: uploadData.uploaderUserId || null,
        relatedEntityType: uploadData.relatedEntityType || null,
        relatedEntityId: uploadData.relatedEntityId || null,
        metadata: uploadData.metadata || null,
      })
      .returning();

    console.log(`📝 Tracked IPFS upload: ${uploadData.cid} (ID: ${record.id})`);
    return record;
  } catch (error) {
    console.error("❌ Failed to track IPFS upload:", error.message);
    throw error;
  }
};

/**
 * Update IPFS upload status in database
 * @param {string} cid - IPFS Content Identifier
 * @param {string} status - New status (pending, confirmed, orphaned, cleaned)
 * @returns {Promise<Object>} Updated record
 */
export const updateIPFSUploadStatus = async (cid, status) => {
  try {
    const [updated] = await db
      .update(ipfsUploads)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(ipfsUploads.cid, cid))
      .returning();

    if (!updated) {
      console.warn(`⚠️ IPFS upload not found: ${cid}`);
      return null;
    }

    console.log(`✅ Updated IPFS upload status: ${cid} → ${status}`);
    return updated;
  } catch (error) {
    console.error("❌ Failed to update IPFS upload status:", error.message);
    throw error;
  }
};

/**
 * Unpin content from Pinata
 * @param {string} cid - IPFS Content Identifier to unpin
 * @returns {Promise<boolean>} Success status
 */
export const unpinFromPinata = async (cid) => {
  if (!hasPinataConfig) {
    console.warn(
      `⚠️ Pinata not configured - skipping unpin for ${cid} (mock storage)`,
    );
    return true; // Consider successful for mock storage
  }

  try {
    console.log(`📌 Unpinning ${cid} from Pinata...`);

    const response = await fetch(`${PINATA_API_URL}/pinning/unpin/${cid}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();

      // If CID doesn't exist, consider it already unpinned
      if (response.status === 404) {
        console.log(`✅ CID ${cid} not found on Pinata (already unpinned)`);
        return true;
      }

      throw new Error(`Unpin failed: ${response.statusText} - ${errorText}`);
    }

    console.log(`✅ Successfully unpinned: ${cid}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to unpin ${cid}:`, error.message);
    return false;
  }
};

/**
 * Mark IPFS uploads as orphaned for a failed workflow
 * @param {string} workflowId - Workflow identifier
 * @returns {Promise<number>} Number of uploads marked as orphaned
 */
export const markWorkflowUploadsAsOrphaned = async (workflowId) => {
  try {
    const result = await db
      .update(ipfsUploads)
      .set({
        status: "orphaned",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ipfsUploads.workflowId, workflowId),
          eq(ipfsUploads.status, "pending"),
        ),
      )
      .returning();

    console.log(
      `⚠️ Marked ${result.length} IPFS uploads as orphaned for workflow: ${workflowId}`,
    );
    return result.length;
  } catch (error) {
    console.error("❌ Failed to mark uploads as orphaned:", error.message);
    throw error;
  }
};

/**
 * Get all orphaned IPFS uploads
 * @param {number} olderThanHours - Only get uploads older than this many hours
 * @returns {Promise<Array>} List of orphaned uploads
 */
export const getOrphanedUploads = async (olderThanHours = 24) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

    const orphaned = await db
      .select()
      .from(ipfsUploads)
      .where(
        and(
          eq(ipfsUploads.status, "orphaned"),
          lt(ipfsUploads.createdAt, cutoffDate),
        ),
      );

    console.log(
      `📋 Found ${orphaned.length} orphaned uploads older than ${olderThanHours} hours`,
    );
    return orphaned;
  } catch (error) {
    console.error("❌ Failed to get orphaned uploads:", error.message);
    throw error;
  }
};

/**
 * Clean up orphaned IPFS content (unpin and delete from DB)
 * @param {string} cid - IPFS Content Identifier
 * @returns {Promise<boolean>} Success status
 */
export const cleanupOrphanedContent = async (cid) => {
  try {
    console.log(`🧹 Cleaning up orphaned content: ${cid}`);

    // Attempt to unpin from Pinata
    const unpinSuccess = await unpinFromPinata(cid);

    if (unpinSuccess) {
      // Update status to 'cleaned' in database
      await db
        .update(ipfsUploads)
        .set({
          status: "cleaned",
          updatedAt: new Date(),
        })
        .where(eq(ipfsUploads.cid, cid));

      console.log(`✅ Cleaned up: ${cid}`);
      return true;
    } else {
      // Mark unpin as attempted even if it failed
      await db
        .update(ipfsUploads)
        .set({
          unpinAttempted: true,
          unpinAttemptedAt: new Date(),
          unpinError: "Failed to unpin from Pinata",
        })
        .where(eq(ipfsUploads.cid, cid));

      console.warn(`⚠️ Unpin failed for ${cid}, marked for retry`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Failed to cleanup ${cid}:`, error.message);

    // Record the error
    await db
      .update(ipfsUploads)
      .set({
        unpinAttempted: true,
        unpinAttemptedAt: new Date(),
        unpinError: error.message,
      })
      .where(eq(ipfsUploads.cid, cid));

    return false;
  }
};

/**
 * Bulk cleanup of orphaned content
 * @param {number} olderThanHours - Clean uploads older than this many hours
 * @param {number} maxCount - Maximum number to clean in one batch
 * @returns {Promise<Object>} Cleanup results
 */
export const bulkCleanupOrphaned = async (
  olderThanHours = 24,
  maxCount = 50,
) => {
  try {
    console.log(
      `🧹 Starting bulk cleanup of orphaned IPFS content (older than ${olderThanHours}h)`,
    );

    // Get orphaned uploads
    const orphaned = await getOrphanedUploads(olderThanHours);

    if (orphaned.length === 0) {
      console.log("✅ No orphaned content to clean up");
      return { success: 0, failed: 0, total: 0 };
    }

    // Limit batch size
    const toClean = orphaned.slice(0, maxCount);
    let successCount = 0;
    let failedCount = 0;

    for (const upload of toClean) {
      const success = await cleanupOrphanedContent(upload.cid);
      if (success) {
        successCount++;
      } else {
        failedCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(
      `✅ Bulk cleanup complete: ${successCount} cleaned, ${failedCount} failed`,
    );

    return {
      success: successCount,
      failed: failedCount,
      total: toClean.length,
      remaining: orphaned.length - toClean.length,
    };
  } catch (error) {
    console.error("❌ Bulk cleanup failed:", error.message);
    throw error;
  }
};

/**
 * Cleanup IPFS uploads for a failed transaction workflow
 * @param {string} workflowId - Workflow identifier
 * @returns {Promise<Object>} Cleanup results
 */
export const cleanupFailedWorkflow = async (workflowId) => {
  try {
    console.log(
      `🧹 Cleaning up IPFS uploads for failed workflow: ${workflowId}`,
    );

    // Mark uploads as orphaned
    await markWorkflowUploadsAsOrphaned(workflowId);

    // Get all pending/orphaned uploads for this workflow
    const uploads = await db
      .select()
      .from(ipfsUploads)
      .where(
        and(
          eq(ipfsUploads.workflowId, workflowId),
          inArray(ipfsUploads.status, ["pending", "orphaned"]),
        ),
      );

    let successCount = 0;
    let failedCount = 0;

    // Unpin each one
    for (const upload of uploads) {
      const success = await cleanupOrphanedContent(upload.cid);
      if (success) {
        successCount++;
      } else {
        failedCount++;
      }
    }

    console.log(
      `✅ Workflow cleanup complete: ${successCount} cleaned, ${failedCount} failed`,
    );

    return {
      success: successCount,
      failed: failedCount,
      total: uploads.length,
    };
  } catch (error) {
    console.error(
      `❌ Workflow cleanup failed for ${workflowId}:`,
      error.message,
    );
    throw error;
  }
};

/**
 * Confirm IPFS uploads for a successful workflow
 * @param {string} workflowId - Workflow identifier
 * @returns {Promise<number>} Number of uploads confirmed
 */
export const confirmWorkflowUploads = async (workflowId) => {
  try {
    const result = await db
      .update(ipfsUploads)
      .set({
        status: "confirmed",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ipfsUploads.workflowId, workflowId),
          eq(ipfsUploads.status, "pending"),
        ),
      )
      .returning();

    console.log(
      `✅ Confirmed ${result.length} IPFS uploads for workflow: ${workflowId}`,
    );
    return result.length;
  } catch (error) {
    console.error("❌ Failed to confirm uploads:", error.message);
    throw error;
  }
};

// Export service
export default {
  trackIPFSUpload,
  updateIPFSUploadStatus,
  unpinFromPinata,
  markWorkflowUploadsAsOrphaned,
  getOrphanedUploads,
  cleanupOrphanedContent,
  bulkCleanupOrphaned,
  cleanupFailedWorkflow,
  confirmWorkflowUploads,
};
