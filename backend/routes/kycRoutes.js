import express from "express";
import multer from "multer";
import path from "path";
import {
  getUserKYCStatus,
  getUserProfile,
  getUserStats,
  submitKYC,
  updateUserProfile,
} from "../controllers/userController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Configure multer for KYC document uploads
// Use memory storage so we can upload directly to IPFS
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only .png, .jpg, .jpeg and .pdf formats allowed!"));
    }
  },
});

// User stats endpoint
router.get("/stats", authenticateToken, getUserStats);

// KYC status endpoint
router.get("/kyc-status", authenticateToken, getUserKYCStatus);

// Submit KYC endpoint
router.post(
  "/submit-kyc",
  authenticateToken,
  upload.fields([
    { name: "idDocument", maxCount: 1 },
    { name: "proofOfAddress", maxCount: 1 },
    { name: "selfieImage", maxCount: 1 },
  ]),
  submitKYC
);

// User profile endpoints
router.get("/profile", authenticateToken, getUserProfile);
router.put("/profile", authenticateToken, updateUserProfile);

export default router;
