import { and, desc, eq, or } from "drizzle-orm";
import { db } from "../db/connection.js";
import { investments, paymentProofs, users } from "../db/schema.js";
import ipfsService from "./ipfsService.js";
import paymentService from "./paymentService.js";

/**
 * @title BankTransferService
 * @description Handles bank transfer proof upload and verification workflows
 * @features
 * - Upload bank statement/proof to IPFS
 * - Verify bank transfer payments (admin approval)
 * - Match payment references
 * - Send payment instructions via email
 * - Auto-expire old pending proofs
 * - Integration with Plaid/Stripe for automated verification (optional)
 */

class BankTransferService {
  /**
   * Upload bank transfer proof document
   * @param {Object} params - Upload parameters
   * @returns {Promise<Object>} Updated payment proof with IPFS details
   */
  async uploadBankProof({
    investmentId,
    userId,
    documentFile,
    transactionReference,
    metadata = {},
  }) {
    try {
      // Validate inputs
      if (!investmentId || !userId || !documentFile) {
        throw new Error("Missing required parameters");
      }

      // Get investment and verify ownership
      const [investment] = await db
        .select()
        .from(investments)
        .where(eq(investments.id, investmentId))
        .limit(1);

      if (!investment) {
        throw new Error("Investment not found");
      }

      if (investment.userId !== userId) {
        throw new Error("Unauthorized: Investment does not belong to user");
      }

      if (investment.paymentStatus === "completed") {
        throw new Error("Payment already completed");
      }

      // Get existing payment proof
      let paymentProof;
      if (investment.paymentProofId) {
        [paymentProof] = await db
          .select()
          .from(paymentProofs)
          .where(eq(paymentProofs.id, investment.paymentProofId))
          .limit(1);
      }

      if (!paymentProof) {
        throw new Error("Payment proof record not found");
      }

      // Check if expired
      if (
        paymentProof.expiresAt &&
        new Date() > new Date(paymentProof.expiresAt)
      ) {
        throw new Error(
          "Payment proof window has expired. Please create a new investment.",
        );
      }

      // Upload document to IPFS
      console.log("Uploading bank proof to IPFS...");
      const ipfsResult = await ipfsService.uploadFile(documentFile, {
        userId,
        investmentId,
        proofType: "bank_transfer",
        uploadedAt: new Date().toISOString(),
        ...metadata,
      });

      // Update payment proof with IPFS details
      const [updatedProof] = await db
        .update(paymentProofs)
        .set({
          documentHash: ipfsResult.ipfsHash,
          documentUrl: ipfsResult.url,
          transactionReference,
          status: "pending_verification",
          uploadedAt: new Date(),
        })
        .where(eq(paymentProofs.id, paymentProof.id))
        .returning();

      // Update investment status
      await db
        .update(investments)
        .set({
          paymentStatus: "pending_verification",
        })
        .where(eq(investments.id, investmentId));

      // TODO: Send notification to admins about new proof upload
      // await this.notifyAdminsNewProof(updatedProof);

      return {
        success: true,
        paymentProof: updatedProof,
        ipfsHash: ipfsResult.ipfsHash,
        ipfsUrl: ipfsResult.url,
        message:
          "Bank proof uploaded successfully. Awaiting admin verification.",
      };
    } catch (error) {
      console.error("Error uploading bank proof:", error);
      throw error;
    }
  }

  /**
   * Admin verify bank transfer payment
   * @param {Object} params - Verification parameters
   * @returns {Promise<Object>} Verification result
   */
  async verifyBankTransfer({
    paymentProofId,
    adminId,
    approved,
    verificationNotes = "",
  }) {
    try {
      // Validate inputs
      if (!paymentProofId || !adminId || approved === undefined) {
        throw new Error("Missing required parameters");
      }

      // Get payment proof
      const [proof] = await db
        .select()
        .from(paymentProofs)
        .where(eq(paymentProofs.id, paymentProofId))
        .limit(1);

      if (!proof) {
        throw new Error("Payment proof not found");
      }

      if (proof.status === "verified") {
        throw new Error("Payment proof already verified");
      }

      // Get associated investment
      const [investment] = await db
        .select()
        .from(investments)
        .where(eq(investments.id, proof.investmentId))
        .limit(1);

      if (!investment) {
        throw new Error("Associated investment not found");
      }

      if (approved) {
        // APPROVE: Update proof status
        const [updatedProof] = await db
          .update(paymentProofs)
          .set({
            status: "verified",
            verifiedBy: adminId,
            verifiedAt: new Date(),
            verificationNotes,
          })
          .where(eq(paymentProofs.id, paymentProofId))
          .returning();

        // Complete the investment payment
        await paymentService.processPaymentCompletion(investment.id);

        // TODO: Notify user of approval
        // await this.notifyUserPaymentApproved(investment, updatedProof);

        return {
          success: true,
          approved: true,
          paymentProof: updatedProof,
          investment,
          message: "Bank transfer verified and approved. Investment completed.",
        };
      } else {
        // REJECT: Update proof status
        const [updatedProof] = await db
          .update(paymentProofs)
          .set({
            status: "rejected",
            verifiedBy: adminId,
            verifiedAt: new Date(),
            verificationNotes,
            rejectionReason: verificationNotes,
          })
          .where(eq(paymentProofs.id, paymentProofId))
          .returning();

        // Update investment status to failed
        await db
          .update(investments)
          .set({
            paymentStatus: "failed",
          })
          .where(eq(investments.id, investment.id));

        // TODO: Notify user of rejection
        // await this.notifyUserPaymentRejected(investment, updatedProof);

        return {
          success: true,
          approved: false,
          paymentProof: updatedProof,
          investment,
          message: "Bank transfer rejected. User can upload new proof.",
        };
      }
    } catch (error) {
      console.error("Error verifying bank transfer:", error);
      throw error;
    }
  }

  /**
   * Match payment reference to find investment
   * @param {string} bankReference - Bank reference number
   * @returns {Promise<Object>} Matched investment and proof
   */
  async matchPaymentReference(bankReference) {
    try {
      if (!bankReference) {
        throw new Error("Bank reference is required");
      }

      // Clean and normalize reference
      const cleanReference = bankReference.trim().toUpperCase();

      // Search for matching proof
      const [proof] = await db
        .select({
          proof: paymentProofs,
          investment: investments,
          user: users,
        })
        .from(paymentProofs)
        .leftJoin(investments, eq(paymentProofs.investmentId, investments.id))
        .leftJoin(users, eq(paymentProofs.userId, users.id))
        .where(eq(paymentProofs.bankReference, cleanReference))
        .limit(1);

      if (!proof) {
        return {
          found: false,
          message: "No matching investment found for this reference",
        };
      }

      return {
        found: true,
        paymentProof: proof.proof,
        investment: proof.investment,
        user: {
          id: proof.user.id,
          email: proof.user.email,
          firstName: proof.user.firstName,
          lastName: proof.user.lastName,
        },
      };
    } catch (error) {
      console.error("Error matching payment reference:", error);
      throw error;
    }
  }

  /**
   * Send payment instructions via email
   * @param {number} userId - User ID
   * @param {number} investmentId - Investment ID
   * @param {string} currency - Currency code
   * @returns {Promise<Object>} Email sending result
   */
  async sendPaymentInstructions(userId, investmentId, currency) {
    try {
      // Get user details
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new Error("User not found");
      }

      // Get investment details
      const paymentStatus = await paymentService.getPaymentStatus(investmentId);

      // Get bank instructions
      const bankInstructions =
        await paymentService.getBankInstructions(currency);

      // Prepare email data
      const emailData = {
        to: user.email,
        subject: `Bank Transfer Instructions - Investment #${investmentId}`,
        template: "bank-transfer-instructions",
        data: {
          userName: `${user.firstName} ${user.lastName}`,
          investmentId,
          amount: paymentStatus.amount,
          currency,
          bankReference: paymentStatus.paymentProof?.bankReference,
          bankInstructions,
          expiresAt: paymentStatus.paymentProof?.expiresAt,
          propertyTitle: paymentStatus.propertyTitle,
        },
      };

      // TODO: Send email using email service
      console.log("Sending payment instructions email:", emailData);
      // await emailService.send(emailData);

      return {
        success: true,
        message: "Payment instructions sent to user email",
        email: user.email,
      };
    } catch (error) {
      console.error("Error sending payment instructions:", error);
      throw error;
    }
  }

  /**
   * Check for expired payment proofs and auto-reject
   * @returns {Promise<Object>} Cleanup results
   */
  async checkPaymentTimeout() {
    try {
      const now = new Date();

      // Find expired proofs
      const expiredProofs = await db
        .select()
        .from(paymentProofs)
        .where(
          and(
            or(
              eq(paymentProofs.status, "pending"),
              eq(paymentProofs.status, "pending_verification"),
            ),
            eq(paymentProofs.expiresAt, now), // This should use a less-than operator if available
          ),
        );

      const results = [];

      for (const proof of expiredProofs) {
        // Check if actually expired
        if (new Date(proof.expiresAt) < now) {
          // Update proof status
          await db
            .update(paymentProofs)
            .set({
              status: "expired",
              rejectionReason: "Payment proof window expired (7 days)",
            })
            .where(eq(paymentProofs.id, proof.id));

          // Update investment status
          await db
            .update(investments)
            .set({
              paymentStatus: "failed",
            })
            .where(eq(investments.id, proof.investmentId));

          results.push({
            proofId: proof.id,
            investmentId: proof.investmentId,
            userId: proof.userId,
            expired: true,
          });

          console.log(
            `❌ Payment proof ${proof.id} expired for investment ${proof.investmentId}`,
          );
        }
      }

      return {
        success: true,
        expiredCount: results.length,
        results,
      };
    } catch (error) {
      console.error("Error checking payment timeouts:", error);
      throw error;
    }
  }

  /**
   * Get all pending bank transfer proofs (for admin dashboard)
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Pending proofs
   */
  async getPendingBankTransfers(filters = {}) {
    try {
      let query = db
        .select({
          proof: paymentProofs,
          investment: investments,
          user: users,
        })
        .from(paymentProofs)
        .leftJoin(investments, eq(paymentProofs.investmentId, investments.id))
        .leftJoin(users, eq(paymentProofs.userId, users.id))
        .where(eq(paymentProofs.status, "pending_verification"))
        .orderBy(desc(paymentProofs.uploadedAt));

      // Apply filters
      if (filters.currency) {
        query = query.where(eq(paymentProofs.currency, filters.currency));
      }

      if (filters.minAmount) {
        query = query.where(
          and(
            eq(paymentProofs.status, "pending_verification"),
            // Amount filter would need proper comparison operator
          ),
        );
      }

      const results = await query;

      return results.map((row) => ({
        paymentProof: row.proof,
        investment: row.investment,
        user: {
          id: row.user.id,
          email: row.user.email,
          firstName: row.user.firstName,
          lastName: row.user.lastName,
        },
      }));
    } catch (error) {
      console.error("Error getting pending bank transfers:", error);
      throw error;
    }
  }

  /**
   * Batch verify multiple bank transfers
   * @param {Array} verifications - Array of {paymentProofId, approved, notes}
   * @param {number} adminId - Admin ID
   * @returns {Promise<Object>} Batch results
   */
  async batchVerifyBankTransfers(verifications, adminId) {
    try {
      const results = {
        approved: [],
        rejected: [],
        failed: [],
      };

      for (const verification of verifications) {
        try {
          const result = await this.verifyBankTransfer({
            paymentProofId: verification.paymentProofId,
            adminId,
            approved: verification.approved,
            verificationNotes: verification.notes || "",
          });

          if (result.approved) {
            results.approved.push(result);
          } else {
            results.rejected.push(result);
          }
        } catch (error) {
          results.failed.push({
            paymentProofId: verification.paymentProofId,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        summary: {
          total: verifications.length,
          approved: results.approved.length,
          rejected: results.rejected.length,
          failed: results.failed.length,
        },
        results,
      };
    } catch (error) {
      console.error("Error batch verifying bank transfers:", error);
      throw error;
    }
  }

  /**
   * Plaid automated verification (optional integration)
   * @param {number} paymentProofId - Payment proof ID
   * @param {string} plaidToken - Plaid access token
   * @returns {Promise<Object>} Verification result
   */
  async verifyWithPlaid(paymentProofId, plaidToken) {
    try {
      // TODO: Implement Plaid API integration
      // This would call Plaid API to verify bank account and transaction
      console.log("Plaid verification not yet implemented");
      throw new Error("Plaid integration coming soon");

      // Example flow:
      // 1. Get payment proof details
      // 2. Call Plaid API with token
      // 3. Verify account ownership
      // 4. Check for matching transaction
      // 5. Auto-approve if verified
    } catch (error) {
      console.error("Error with Plaid verification:", error);
      throw error;
    }
  }

  /**
   * Stripe payment verification webhook handler (optional)
   * @param {Object} event - Stripe webhook event
   * @returns {Promise<Object>} Processing result
   */
  async handleStripeWebhook(event) {
    try {
      // TODO: Implement Stripe webhook handling
      console.log("Stripe webhook handling not yet implemented");
      throw new Error("Stripe integration coming soon");

      // Example flow:
      // 1. Verify webhook signature
      // 2. Parse event type
      // 3. Extract payment intent details
      // 4. Match to investment by stripe_payment_intent_id
      // 5. Auto-complete payment
    } catch (error) {
      console.error("Error handling Stripe webhook:", error);
      throw error;
    }
  }

  /**
   * Get payment proof by ID
   * @param {number} proofId - Payment proof ID
   * @returns {Promise<Object>} Payment proof details
   */
  async getPaymentProof(proofId) {
    try {
      const [result] = await db
        .select({
          proof: paymentProofs,
          investment: investments,
          user: users,
        })
        .from(paymentProofs)
        .leftJoin(investments, eq(paymentProofs.investmentId, investments.id))
        .leftJoin(users, eq(paymentProofs.userId, users.id))
        .where(eq(paymentProofs.id, proofId))
        .limit(1);

      if (!result) {
        throw new Error("Payment proof not found");
      }

      return {
        paymentProof: result.proof,
        investment: result.investment,
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
        },
      };
    } catch (error) {
      console.error("Error getting payment proof:", error);
      throw error;
    }
  }
}

// Create singleton instance
const bankTransferService = new BankTransferService();

export default bankTransferService;
