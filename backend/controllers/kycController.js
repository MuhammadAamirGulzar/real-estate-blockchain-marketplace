import { db } from '../db/connection.js';
import { kycSubmissions, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { createSubmission, findSubmissionsByUserId, updateSubmissionStatus } from '../services/kycService.js';

/**
 * Submit KYC documents
 * POST /api/kyc/submit
 */
export const submitKyc = async (req, res) => {
    try {
        const userId = req.user.id;
        const { documentType, documentDetails } = req.body;

        // Check if user already has a pending submission
        const existingSubmission = await db.query.kycSubmissions.findFirst({
            where: eq(kycSubmissions.userId, userId),
        });

        if (existingSubmission && existingSubmission.status === 'pending') {
            return res.status(400).json({
                success: false,
                message: 'You already have a pending KYC submission',
            });
        }

        // Create new KYC submission
        const submission = await createSubmission({
            userId,
            status: 'pending',
            submittedAt: new Date(),
        });

        console.log(`✅ KYC submission created for user ${userId}: ${submission.id}`);

        res.status(201).json({
            success: true,
            message: 'KYC submission created successfully',
            data: submission,
        });
    } catch (error) {
        console.error('Error submitting KYC:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit KYC',
            error: error.message,
        });
    }
};

/**
 * Submit Basic KYC (for investors)
 */
export const submitBasicKyc = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, cnic, dateOfBirth, address, phoneNumber } = req.body;

    // Validate required fields
    if (!fullName || !cnic) {
      return res.status(400).json({
        success: false,
        message: 'Full name and CNIC are required'
      });
    }

    // Check if user already has a pending or approved KYC submission
    const existingSubmission = await db
      .select()
      .from(basicKycSubmissions)
      .where(eq(basicKycSubmissions.userId, userId))
      .limit(1);

    if (existingSubmission.length > 0) {
      const status = existingSubmission[0].status;
      if (status === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Your KYC is already approved'
        });
      } else if (status === 'pending' || status === 'under_review') {
        return res.status(400).json({
          success: false,
          message: 'You already have a pending KYC submission'
        });
      }
    }

    // Handle file uploads
    const files = req.files;
    let selfieDocumentId = null;
    let idCardDocumentId = null;

    if (files && files.selfie && files.selfie[0]) {
      const selfieDoc = await saveDocumentToDb(userId, files.selfie[0], 'selfie');
      selfieDocumentId = selfieDoc.id;
    }

    if (files && files.idCard && files.idCard[0]) {
      const idCardDoc = await saveDocumentToDb(userId, files.idCard[0], 'id_card');
      idCardDocumentId = idCardDoc.id;
    }

    // Create KYC submission
    const [submission] = await db
      .insert(basicKycSubmissions)
      .values({
        userId,
        fullName,
        cnic,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        address,
        phoneNumber,
        selfieDocumentId,
        idCardDocumentId,
        status: 'pending',
      })
      .returning();

    // Update user's KYC status
    await db
      .update(users)
      .set({ kycStatus: 'pending' })
      .where(eq(users.id, userId));

    // Create verification history entry
    await createVerificationHistory(userId, 'basic', 'pending');

    res.status(201).json({
      success: true,
      message: 'KYC submission successful',
      data: {
        submissionId: submission.id,
        status: submission.status
      }
    });

  } catch (error) {
    console.error('Error submitting basic KYC:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit KYC',
      error: error.message
    });
  }
};

/**
 * Submit Asset Lister Verification
 */
export const submitAssetListerVerification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      companyName, 
      registrationId, 
      businessAddress, 
      businessType, 
      yearsInBusiness 
    } = req.body;

    // Check if user has approved basic KYC first
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length || user[0].kycStatus !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'You must complete and get approved basic KYC before applying for asset lister verification'
      });
    }

    // Check if user already has a pending or approved lister verification
    const existingVerification = await db
      .select()
      .from(assetListerVerifications)
      .where(eq(assetListerVerifications.userId, userId))
      .limit(1);

    if (existingVerification.length > 0) {
      const status = existingVerification[0].status;
      if (status === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Your asset lister verification is already approved'
        });
      } else if (status === 'pending' || status === 'under_review') {
        return res.status(400).json({
          success: false,
          message: 'You already have a pending asset lister verification'
        });
      }
    }

    // Handle file uploads
    const files = req.files;
    let businessLicenseDocumentId = null;
    let propertyProofDocumentId = null;

    if (files && files.businessLicense && files.businessLicense[0]) {
      const businessLicenseDoc = await saveDocumentToDb(userId, files.businessLicense[0], 'business_license');
      businessLicenseDocumentId = businessLicenseDoc.id;
    }

    if (files && files.propertyProof && files.propertyProof[0]) {
      const propertyProofDoc = await saveDocumentToDb(userId, files.propertyProof[0], 'property_proof');
      propertyProofDocumentId = propertyProofDoc.id;
    }

    // Create asset lister verification
    const [verification] = await db
      .insert(assetListerVerifications)
      .values({
        userId,
        companyName,
        registrationId,
        businessAddress,
        businessType,
        yearsInBusiness: yearsInBusiness ? parseInt(yearsInBusiness) : null,
        businessLicenseDocumentId,
        propertyProofDocumentId,
        status: 'pending',
      })
      .returning();

    // Create verification history entry
    await createVerificationHistory(userId, 'lister', 'pending');

    res.status(201).json({
      success: true,
      message: 'Asset lister verification submitted successfully',
      data: {
        verificationId: verification.id,
        status: verification.status
      }
    });

  } catch (error) {
    console.error('Error submitting asset lister verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit asset lister verification',
      error: error.message
    });
  }
};

/**
 * Get user's KYC status
 * GET /api/kyc/status
 */
export const getMyKycStatus = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get user's latest submission
        const submissions = await findSubmissionsByUserId(userId);

        if (submissions.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    status: 'not_submitted',
                    message: 'You have not submitted KYC yet',
                },
            });
        }

        const latestSubmission = submissions[0];

        res.status(200).json({
            success: true,
            data: {
                status: latestSubmission.status,
                submittedAt: latestSubmission.submittedAt,
                reviewedAt: latestSubmission.reviewedAt,
                rejectionReason: latestSubmission.rejectionReason,
                history: submissions,
            },
        });
    } catch (error) {
        console.error('Error fetching KYC status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch KYC status',
            error: error.message,
        });
    }
};

/**
 * Get all pending KYC submissions (verifier only)
 * GET /api/kyc/pending
 */
export const getPendingSubmissions = async (req, res) => {
    try {
        const submissions = await db.query.kycSubmissions.findMany({
            where: eq(kycSubmissions.status, 'pending'),
            with: {
                user: true,
            },
            orderBy: (kycSubmissions, { asc }) => [asc(kycSubmissions.submittedAt)],
        });

        res.status(200).json({
            success: true,
            count: submissions.length,
            data: submissions,
        });
    } catch (error) {
        console.error('Error fetching pending submissions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending submissions',
            error: error.message,
        });
    }
};

/**
 * Approve KYC submission (verifier only)
 * POST /api/kyc/submissions/:id/approve
 */
export const approveKycSubmission = async (req, res) => {
    try {
        const { id } = req.params;
        const verifierId = req.user.id;

        // Update submission status
        const updatedSubmission = await updateSubmissionStatus(id, 'approved', verifierId);

        if (!updatedSubmission) {
            return res.status(404).json({
                success: false,
                message: 'KYC submission not found',
            });
        }

        // Update user's KYC status in users table
        await db.update(users)
            .set({ kycStatus: 'approved' })
            .where(eq(users.id, updatedSubmission.userId));

        console.log(`✅ KYC submission ${id} approved by verifier ${verifierId}`);

        res.status(200).json({
            success: true,
            message: 'KYC submission approved',
            data: updatedSubmission,
        });
    } catch (error) {
        console.error('Error approving KYC:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to approve KYC submission',
            error: error.message,
        });
    }
};

/**
 * Reject KYC submission (verifier only)
 * POST /api/kyc/submissions/:id/reject
 */
export const rejectKycSubmission = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;
        const verifierId = req.user.id;

        if (!rejectionReason) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required',
            });
        }

        // Update submission status with rejection reason
        const updatedSubmission = await db.update(kycSubmissions)
            .set({
                status: 'rejected',
                rejectionReason,
                reviewedBy: verifierId,
                reviewedAt: new Date(),
            })
            .where(eq(kycSubmissions.id, parseInt(id)))
            .returning()
            .then(res => res[0]);

        if (!updatedSubmission) {
            return res.status(404).json({
                success: false,
                message: 'KYC submission not found',
            });
        }

        console.log(`✅ KYC submission ${id} rejected by verifier ${verifierId}`);

        res.status(200).json({
            success: true,
            message: 'KYC submission rejected',
            data: updatedSubmission,
        });
    } catch (error) {
        console.error('Error rejecting KYC:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reject KYC submission',
            error: error.message,
        });
    }
};

/**
 * Request KYC resubmission (verifier only)
 * POST /api/kyc/submissions/:id/request-resubmission
 */
export const requestKycResubmission = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const verifierId = req.user.id;

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Reason for resubmission is required',
            });
        }

        const updatedSubmission = await db.update(kycSubmissions)
            .set({
                status: 'requires_resubmission',
                rejectionReason: reason,
                reviewedBy: verifierId,
                reviewedAt: new Date(),
            })
            .where(eq(kycSubmissions.id, parseInt(id)))
            .returning()
            .then(res => res[0]);

        if (!updatedSubmission) {
            return res.status(404).json({
                success: false,
                message: 'KYC submission not found',
            });
        }

        console.log(`✅ KYC submission ${id} marked for resubmission by verifier ${verifierId}`);

        res.status(200).json({
            success: true,
            message: 'KYC resubmission requested',
            data: updatedSubmission,
        });
    } catch (error) {
        console.error('Error requesting resubmission:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to request resubmission',
            error: error.message,
        });
    }
};

/**
 * Get document by ID (for admin review)
 * GET /api/kyc/documents/:id
 */
export const getDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const userRole = req.user.role;

    // Only admins or the document owner can access documents
    if (userRole !== 'admin' && userRole !== 'verifier') {
      // Check if user owns this document
      const [document] = await db
        .select()
        .from(kycDocuments)
        .where(eq(kycDocuments.id, parseInt(documentId)))
        .limit(1);

      if (!document || document.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const [document] = await db
      .select()
      .from(kycDocuments)
      .where(eq(kycDocuments.id, parseInt(documentId)))
      .limit(1);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check if file exists
    if (!fs.existsSync(document.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${document.fileName}"`);
    
    // Send file
    res.sendFile(path.resolve(document.filePath));

  } catch (error) {
    console.error('Error getting document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get document',
      error: error.message
    });
  }
};
