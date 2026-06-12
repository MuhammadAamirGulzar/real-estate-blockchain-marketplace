import express from "express";
import { 
  signup, 
  login, 
  connectWallet, 
  disconnectWallet,
  getNonce, 
  verifyWallet, 
  logout, 
  getCurrentUser,
  getWalletAuthStatus
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Email/Password Authentication
router.post("/signup", signup);
router.post("/login", login);

// Wallet Connection (for existing users)
router.post("/connect-wallet", protect, connectWallet);
router.post("/disconnect-wallet", protect, disconnectWallet);
router.post("/nonce", getNonce);
router.get("/wallet-status", protect, getWalletAuthStatus);

// Legacy wallet-only auth (for backward compatibility)
router.post("/verify-wallet", verifyWallet);

// Common routes
router.post("/logout", logout);
router.get("/me", protect, getCurrentUser);

export default router;
