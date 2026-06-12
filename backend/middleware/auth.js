import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Access token required" });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key",
    );

    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.id))
      .limit(1);

    if (userResult.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    req.user = userResult[0];
    next();
  } catch (error) {
    console.error("❌ Authentication error:", error.message);
    return res.status(403).json({ success: false, message: "Invalid token" });
  }
};

const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    if (req.user.role !== role) {
      return res
        .status(403)
        .json({ success: false, message: "Insufficient permissions" });
    }

    next();
  };
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: User with role '${req.user.role}' is not authorized`,
      });
    }

    next();
  };
};

export { authenticateToken, authorizeRoles, requireRole };
