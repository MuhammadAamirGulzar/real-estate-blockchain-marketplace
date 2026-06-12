import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { 
  getPortfolioStats,
  getUserTransactions,
  getUserPayouts
} from "../controllers/portfolioController.js";

const router = express.Router();

// Get portfolio statistics
router.get("/stats", protect, getPortfolioStats);

// Get user transactions
router.get("/transactions", protect, getUserTransactions);

// Get user payouts
router.get("/payouts", protect, getUserPayouts);

export default router;