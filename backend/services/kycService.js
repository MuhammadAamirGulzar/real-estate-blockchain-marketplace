import { db } from '../db/connection.js';
import { kycSubmissions, assetListerVerifications, verificationHistory } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Find a KYC submission by ID
 */
export const findSubmissionById = async (submissionId) => {
    return await db.query.kycSubmissions.findFirst({
        where: eq(kycSubmissions.id, parseInt(submissionId)),
        with: {
            user: true,
            reviewedBy: true,
        },
    });
};

/**
 * Find all pending KYC submissions
 */
export const findPendingSubmissions = async () => {
    return await db.query.kycSubmissions.findMany({
        where: eq(kycSubmissions.status, 'pending'),
        with: {
            user: true,
        },
        orderBy: (kycSubmissions, { asc }) => [asc(kycSubmissions.submittedAt)],
    });
};

/**
 * Find all KYC submissions for a specific user
 */
export const findSubmissionsByUserId = async (userId) => {
    return await db.query.kycSubmissions.findMany({
        where: eq(kycSubmissions.userId, userId),
        orderBy: (kycSubmissions, { desc }) => [desc(kycSubmissions.submittedAt)],
    });
};

/**
 * Create a new KYC submission
 */
export const createSubmission = async (submissionData) => {
    const result = await db.insert(kycSubmissions).values({
        ...submissionData,
        submittedAt: new Date(),
    }).returning();
    return result[0];
};

/**
 * Update KYC submission status
 */
export const updateSubmissionStatus = async (submissionId, status, reviewedBy = null) => {
    const updateData = {
        status,
        reviewedAt: new Date(),
    };

    if (reviewedBy) {
        updateData.reviewedBy = reviewedBy;
    }

    const result = await db.update(kycSubmissions)
        .set(updateData)
        .where(eq(kycSubmissions.id, parseInt(submissionId)))
        .returning();

    return result[0];
};

/**
 * Reject a KYC submission with a reason
 */
export const rejectSubmission = async (submissionId, rejectionReason, reviewedBy) => {
    const result = await db.update(kycSubmissions)
        .set({
            status: 'rejected',
            rejectionReason,
            reviewedBy,
            reviewedAt: new Date(),
        })
        .where(eq(kycSubmissions.id, parseInt(submissionId)))
        .returning();

    return result[0];
};

// === Asset Lister Verification Functions ===

/**
 * Find pending asset lister verifications
 */
export const findPendingListerVerifications = async () => {
    return await db.query.assetListerVerifications.findMany({
        where: eq(assetListerVerifications.status, 'pending'),
        with: {
            user: true,
        },
        orderBy: (assetListerVerifications, { asc }) => [asc(assetListerVerifications.submittedAt)],
    });
};

/**
 * Find asset lister verification by user ID
 */
export const findListerVerificationByUserId = async (userId) => {
    return await db.query.assetListerVerifications.findFirst({
        where: eq(assetListerVerifications.userId, userId),
        with: {
            user: true,
        },
    });
};

/**
 * Create a new asset lister verification submission
 */
export const createListerVerification = async (verificationData) => {
    const result = await db.insert(assetListerVerifications).values({
        ...verificationData,
        submittedAt: new Date(),
    }).returning();

    return result[0];
};

/**
 * Update asset lister verification status
 */
export const updateListerVerificationStatus = async (verificationId, status, reviewedBy = null, adminNotes = null) => {
    const updateData = {
        status,
        reviewedAt: new Date(),
    };

    if (reviewedBy) {
        updateData.reviewedBy = reviewedBy;
    }

    if (adminNotes) {
        updateData.adminNotes = adminNotes;
    }

    const result = await db.update(assetListerVerifications)
        .set(updateData)
        .where(eq(assetListerVerifications.id, parseInt(verificationId)))
        .returning();

    return result[0];
};

/**
 * Reject asset lister verification
 */
export const rejectListerVerification = async (verificationId, rejectionReason, reviewedBy, adminNotes = null) => {
    const updateData = {
        status: 'rejected',
        rejectionReason,
        reviewedBy,
        reviewedAt: new Date(),
    };

    if (adminNotes) {
        updateData.adminNotes = adminNotes;
    }

    const result = await db.update(assetListerVerifications)
        .set(updateData)
        .where(eq(assetListerVerifications.id, parseInt(verificationId)))
        .returning();

    return result[0];
};

/**
 * Request resubmission for asset lister verification
 */
export const requestResubmission = async (verificationId, reviewedBy, adminNotes) => {
    const result = await db.update(assetListerVerifications)
        .set({
            status: 'requires_resubmission',
            adminNotes,
            reviewedBy,
            reviewedAt: new Date(),
        })
        .where(eq(assetListerVerifications.id, parseInt(verificationId)))
        .returning();

    return result[0];
};

// === Verification History ===

/**
 * Log a verification status change to history
 */
export const logVerificationHistory = async (userId, verificationType, previousStatus, newStatus, reviewedBy = null, notes = null) => {
    const result = await db.insert(verificationHistory).values({
        userId,
        verificationType,
        previousStatus,
        newStatus,
        reviewedBy,
        notes,
        createdAt: new Date(),
    }).returning();

    return result[0];
};

/**
 * Get verification history for a user
 */
export const getUserVerificationHistory = async (userId) => {
    return await db.query.verificationHistory.findMany({
        where: eq(verificationHistory.userId, userId),
        with: {
            reviewedBy: true,
        },
        orderBy: (verificationHistory, { desc }) => [desc(verificationHistory.createdAt)],
    });
};

/**
 * Get statistics on KYC submissions
 */
export const getKycStatistics = async () => {
    const submissions = await db.query.kycSubmissions.findMany();
    
    return {
        total: submissions.length,
        pending: submissions.filter(s => s.status === 'pending').length,
        approved: submissions.filter(s => s.status === 'approved').length,
        rejected: submissions.filter(s => s.status === 'rejected').length,
    };
};

/**
 * Get statistics on asset lister verifications
 */
export const getListerVerificationStatistics = async () => {
    const verifications = await db.query.assetListerVerifications.findMany();
    
    return {
        total: verifications.length,
        pending: verifications.filter(v => v.status === 'pending').length,
        approved: verifications.filter(v => v.status === 'approved').length,
        rejected: verifications.filter(v => v.status === 'rejected').length,
        requiresResubmission: verifications.filter(v => v.status === 'requires_resubmission').length,
    };
};