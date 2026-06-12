import express from "express";
import {
  calculateReturns,
  checkEligibilityHandler,
  completeInvestmentHandler,
  convertEthToRwapHandler,
  createInvestmentDirect,
  createInvestmentHandler,
  ensurePoolAllowanceHandler,
  getInvestmentHistory,
  getPortfolio,
  getPortfolioHandler,
  getUserInvestments,
} from "../controllers/investmentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// All investment routes require authentication
router.use(protect);

// POST /api/investment/create - Create new investment
router.post("/create", createInvestmentHandler);

// POST /api/investment/:id/complete - Complete investment (admin only)
router.post(
  "/:id/complete",
  authorizeRoles("admin", "subadmin"),
  completeInvestmentHandler,
);

// GET /api/investment/portfolio - Get user's portfolio
router.get("/portfolio", getPortfolioHandler);

// GET /api/investment/check-eligibility - Check if user can invest
router.get("/check-eligibility", checkEligibilityHandler);

// POST /api/investment/convert-eth-to-rwap - Convert treasury ETH transfer into RWAP
router.post("/convert-eth-to-rwap", convertEthToRwapHandler);

// POST /api/investment/ensure-pool-allowance - Ensure treasury allowance for pool token transfers
router.post("/ensure-pool-allowance", ensurePoolAllowanceHandler);

// GET /api/investments/user - Get user's investments
router.get("/user", getUserInvestments);

// GET /api/investments/history - Get investment history with pagination
router.get("/history", getInvestmentHistory);

// POST /api/investments/calculate-returns - Calculate projected returns
router.post("/calculate-returns", calculateReturns);

// Legacy routes for backward compatibility
router.post("/", createInvestmentDirect);
router.get("/portfolio/legacy", getPortfolio);

// GET /api/investments - Get user's investments (legacy)
router.get("/", getUserInvestments);

// GET /api/investments/:id - Get specific investment details
router.get("/:id", async (req, res) => {
  try {
    const { db } = await import("../db/connection.js");
    const { investments } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");

    const investment = await db.query.investments.findFirst({
      where: eq(investments.id, parseInt(req.params.id)),
      with: {
        property: true,
      },
    });

    if (!investment) {
      return res.status(404).json({ message: "Investment not found" });
    }

    // Ensure user can only view their own investments (unless admin)
    if (
      investment.userId !== req.user.id &&
      req.user.role !== "admin" &&
      req.user.role !== "subadmin"
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json({
      success: true,
      data: investment,
    });
  } catch (error) {
    console.error("Error fetching investment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch investment",
      error: error.message,
    });
  }
});

export default router;
