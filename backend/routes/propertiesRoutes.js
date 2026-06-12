import express from "express";
import multer from "multer";
import path from "path";
import {
  approveProperty,
  createProperty,
  delistProperty,
  getAllProperties,
  getPropertyById,
  listProperty,
} from "../controllers/propertiesController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Multer config: store in uploads/, accept images + PDFs
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(
      ext && mime ? null : new Error("Only images and PDFs are allowed"),
      ext && mime,
    );
  },
});

const propertyUpload = upload.fields([
  { name: "photos", maxCount: 8 },
  { name: "titleDeed", maxCount: 1 },
  { name: "floorPlan", maxCount: 1 },
  { name: "valuation", maxCount: 1 },
  { name: "noc", maxCount: 1 },
]);

// Public routes for viewing properties
router.get("/", getAllProperties);
router.get("/:id", getPropertyById);

// User route: submit a new property for tokenization (with file uploads)
router.post(
  "/",
  protect,
  authorize("user", "admin", "subadmin"),
  propertyUpload,
  listProperty,
);

// Owner: delist their own property
router.patch("/:id/delist", protect, delistProperty);

// Admin/subadmin/verifier: approve a property
router.patch(
  "/:id/approve",
  protect,
  authorize("admin", "subadmin", "verifier"),
  approveProperty,
);

// Admin-only route: directly create an approved/tokenized property
router.post("/admin/create", protect, authorize("admin"), createProperty);

export default router;
