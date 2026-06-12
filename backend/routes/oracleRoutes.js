import express from "express";
import oracleController from "../controllers/oracleController.js";
import { authenticateToken as authMiddleware } from "../middleware/authMiddleware.js";
import { roleMiddleware } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Public routes
/**
 * @swagger
 * /api/oracle/property-price/{propertyId}:
 *   get:
 *     summary: Get current property price
 *     tags: [Oracle]
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *         description: Currency to display price in (default USD)
 *     responses:
 *       200:
 *         description: Property price retrieved
 */
router.get("/property-price/:propertyId", oracleController.getPropertyPrice);

/**
 * @swagger
 * /api/oracle/currency-rate/{from}/{to}:
 *   get:
 *     summary: Get currency exchange rate
 *     tags: [Oracle]
 *     parameters:
 *       - in: path
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: amount
 *         schema:
 *           type: number
 *         description: Amount to convert (default 1)
 *     responses:
 *       200:
 *         description: Exchange rate retrieved
 */
router.get("/currency-rate/:from/:to", oracleController.getCurrencyRate);

/**
 * @swagger
 * /api/oracle/price-history/{propertyId}:
 *   get:
 *     summary: Get property price history
 *     tags: [Oracle]
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *         description: Currency to display prices in (default USD)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Max number of records (default 100)
 *     responses:
 *       200:
 *         description: Price history retrieved
 */
router.get(
  "/price-history/:propertyId",
  oracleController.getPropertyPriceHistory,
);

/**
 * @swagger
 * /api/oracle/supported-currencies:
 *   get:
 *     summary: Get supported currencies
 *     tags: [Oracle]
 *     responses:
 *       200:
 *         description: Currency list retrieved
 */
router.get("/supported-currencies", oracleController.getSupportedCurrencies);

/**
 * @swagger
 * /api/oracle/multi-currency/{propertyId}:
 *   get:
 *     summary: Get property price in all supported currencies
 *     tags: [Oracle]
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Multi-currency prices retrieved
 */
router.get(
  "/multi-currency/:propertyId",
  oracleController.getMultiCurrencyDisplay,
);

// Admin-only routes
/**
 * @swagger
 * /api/oracle/update-property/{propertyId}:
 *   post:
 *     summary: Update property price (Admin)
 *     tags: [Oracle]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
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
 *               newPrice:
 *                 type: number
 *               currency:
 *                 type: string
 *               source:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Property price updated
 */
router.post(
  "/update-property/:propertyId",
  authMiddleware,
  roleMiddleware(["admin", "subadmin"]),
  oracleController.updatePropertyPrice,
);

/**
 * @swagger
 * /api/oracle/manual-override/{propertyId}:
 *   post:
 *     summary: Apply manual price override (Admin)
 *     tags: [Oracle]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
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
 *               newPrice:
 *                 type: number
 *               currency:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Manual override applied
 */
router.post(
  "/manual-override/:propertyId",
  authMiddleware,
  roleMiddleware(["admin"]),
  oracleController.applyManualOverride,
);

/**
 * @swagger
 * /api/oracle/anomalies:
 *   get:
 *     summary: Get price anomalies (Admin)
 *     tags: [Oracle]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: number
 *         description: Percentage threshold (default 20)
 *     responses:
 *       200:
 *         description: Price anomalies retrieved
 */
router.get(
  "/anomalies",
  authMiddleware,
  roleMiddleware(["admin", "subadmin"]),
  oracleController.getPriceAnomalies,
);

/**
 * @swagger
 * /api/oracle/sync-prices:
 *   post:
 *     summary: Sync property prices from blockchain (Admin)
 *     tags: [Oracle]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               propertyIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Prices synchronized
 */
router.post(
  "/sync-prices",
  authMiddleware,
  roleMiddleware(["admin", "subadmin"]),
  oracleController.syncPricesFromChain,
);

/**
 * Fetch real-world property price from external valuation API
 * (Rentcast, ATTOM, or configurable source) and save + optionally push on-chain
 * @route POST /api/oracle/fetch-realworld-price/:propertyId
 * @access Admin
 */
router.post(
  "/fetch-realworld-price/:propertyId",
  authMiddleware,
  roleMiddleware(["admin"]),
  oracleController.fetchRealWorldPropertyPrice,
);

export default router;
