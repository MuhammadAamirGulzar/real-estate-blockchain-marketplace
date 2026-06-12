import express from "express";
import multer from "multer";
import paymentController from "../controllers/paymentController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { roleMiddleware } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/payment-proofs/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs only
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and PDF are allowed."));
    }
  },
});

// Public routes
/**
 * @swagger
 * /api/payments/exchange-rates:
 *   get:
 *     summary: Get live exchange rates
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: base
 *         schema:
 *           type: string
 *         description: Base currency (default USD)
 *       - in: query
 *         name: quotes
 *         schema:
 *           type: string
 *         description: Comma-separated quote currencies
 *     responses:
 *       200:
 *         description: Exchange rates retrieved successfully
 */
router.get("/exchange-rates", paymentController.getExchangeRates);
router.get("/rates", paymentController.getExchangeRates);
router.get("/convert", paymentController.convertCurrency);
router.get("/crypto-tokens", paymentController.getSupportedCryptoTokens);
router.get("/fiat-currencies", paymentController.getSupportedFiatCurrencies);
router.get("/bank-details", paymentController.getBankDetails);

/**
 * @swagger
 * /api/payments/methods:
 *   get:
 *     summary: Get supported payment methods
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Payment methods list
 */
router.get("/methods", paymentController.getSupportedPaymentMethods);

/**
 * @swagger
 * /api/payments/calculate:
 *   post:
 *     summary: Calculate investment details
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               propertyId:
 *                 type: integer
 *               paymentAmount:
 *                 type: number
 *               paymentCurrency:
 *                 type: string
 *     responses:
 *       200:
 *         description: Investment breakdown
 */
router.post("/calculate", paymentController.calculateInvestment);

// Protected user routes (requires authentication)
/**
 * @swagger
 * /api/payments/initiate-crypto:
 *   post:
 *     summary: Initiate crypto payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               propertyId:
 *                 type: integer
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *                 enum: [RWAP, ETH, USDC, USDT]
 *               walletAddress:
 *                 type: string
 *     responses:
 *       200:
 *         description: Crypto payment initiated
 */
router.post(
  "/initiate-crypto",
  authMiddleware,
  paymentController.initiateCryptoPayment,
);

/**
 * @swagger
 * /api/payments/initiate-fiat:
 *   post:
 *     summary: Initiate fiat bank transfer payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               propertyId:
 *                 type: integer
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *                 enum: [USD, PKR, AED, EUR, GBP]
 *     responses:
 *       200:
 *         description: Fiat payment initiated with bank instructions
 */
router.post(
  "/initiate-fiat",
  authMiddleware,
  paymentController.initiateFiatPayment,
);

/**
 * @swagger
 * /api/payments/upload-proof:
 *   post:
 *     summary: Upload bank transfer proof
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               investmentId:
 *                 type: integer
 *               transactionReference:
 *                 type: string
 *               documentFile:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Proof uploaded successfully
 */
router.post(
  "/upload-proof",
  authMiddleware,
  upload.single("documentFile"),
  paymentController.uploadPaymentProof,
);

/**
 * @swagger
 * /api/payments/status/{investmentId}:
 *   get:
 *     summary: Get payment status
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: investmentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Payment status retrieved
 */
router.get(
  "/status/:investmentId",
  authMiddleware,
  paymentController.getPaymentStatus,
);

/**
 * @swagger
 * /api/payments/instructions/{investmentId}:
 *   get:
 *     summary: Get bank payment instructions
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: investmentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Payment instructions retrieved
 */
router.get(
  "/instructions/:investmentId",
  authMiddleware,
  paymentController.getPaymentInstructions,
);

// Admin-only routes
/**
 * @swagger
 * /api/payments/verify/{paymentProofId}:
 *   post:
 *     summary: Verify bank transfer (Admin)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentProofId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               approved:
 *                 type: boolean
 *               verificationNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification completed
 */
router.post(
  "/verify/:paymentProofId",
  authMiddleware,
  roleMiddleware(["admin", "subadmin"]),
  paymentController.verifyBankTransfer,
);

/**
 * @swagger
 * /api/payments/refund/{investmentId}:
 *   post:
 *     summary: Process refund (Admin)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: investmentId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Refund processed
 */
router.post(
  "/refund/:investmentId",
  authMiddleware,
  roleMiddleware(["admin"]),
  paymentController.refundPayment,
);

/**
 * @swagger
 * /api/payments/pending-bank-transfers:
 *   get:
 *     summary: Get pending bank transfers (Admin)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *       - in: query
 *         name: minAmount
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Pending transfers list
 */
router.get(
  "/pending-bank-transfers",
  authMiddleware,
  roleMiddleware(["admin", "subadmin"]),
  paymentController.getPendingBankTransfers,
);

/**
 * @swagger
 * /api/payments/batch-verify:
 *   post:
 *     summary: Batch verify bank transfers (Admin)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               verifications:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     paymentProofId:
 *                       type: integer
 *                     approved:
 *                       type: boolean
 *                     notes:
 *                       type: string
 *     responses:
 *       200:
 *         description: Batch verification completed
 */
router.post(
  "/batch-verify",
  authMiddleware,
  roleMiddleware(["admin", "subadmin"]),
  paymentController.batchVerifyBankTransfers,
);

// ============================================================
// STRIPE ROUTES (USD card payments, test mode)
// ============================================================

/**
 * Create a Stripe PaymentIntent
 * Frontend receives clientSecret and uses Stripe.js to confirm payment
 * @route POST /api/payments/stripe/create-intent
 */
router.post(
  "/stripe/create-intent",
  authMiddleware,
  paymentController.createStripePaymentIntent,
);

/**
 * Stripe webhook — receives payment_intent.succeeded events
 * Stripe sends raw JSON body; express.raw() is needed for signature verification.
 * Mount this route with express.raw middleware BEFORE express.json parses the body.
 * @route POST /api/payments/stripe/webhook
 */
router.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  paymentController.stripeWebhook,
);

/**
 * Manual Stripe payment confirmation (test mode helper)
 * After completing a Stripe test payment, call this to trigger the same flow
 * as the webhook without needing a live webhook endpoint.
 * @route POST /api/payments/stripe/confirm
 */
router.post(
  "/stripe/confirm",
  authMiddleware,
  paymentController.confirmStripePayment,
);

export default router;
