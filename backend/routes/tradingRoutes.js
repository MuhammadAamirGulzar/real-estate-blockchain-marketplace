import express from "express";
import {
  cancelTradingOffer,
  getMarketDataHandler,
  getOrdersHandler,
  getTradingHistoryHandler,
  getUserOrdersHandler,
  recordCancelHandler,
  recordOrderHandler,
  recordTradeHandler,
} from "../controllers/tradingController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ─── Public ───────────────────────────────────────────────────────────────────

// List active on-chain orders for a property: ?propertyId=X
router.get("/orders", getOrdersHandler);

// Market stats (volume, last price) for a property
router.get("/market/:propertyId", getMarketDataHandler);

// ─── Authenticated ────────────────────────────────────────────────────────────

// User's own orders (blockchain + DB)
router.get("/user-orders", protect, getUserOrdersHandler);

// User's trade purchase history
router.get("/history", protect, getTradingHistoryHandler);

// Record a new on-chain order creation in DB
router.post("/orders/record", protect, recordOrderHandler);

// Record a completed on-chain trade execution in DB
router.post("/orders/:orderId/record-trade", protect, recordTradeHandler);

// Mark a listing cancelled after on-chain cancelOrder()
router.post("/orders/:listingId/record-cancel", protect, recordCancelHandler);

// ─── Legacy routes (deprecated, kept for backward compatibility) ───────────

// Old route shapes still wired up by existing frontend service
router.get("/offers", getOrdersHandler);
router.delete("/offers/:id", protect, cancelTradingOffer);

export default router;
