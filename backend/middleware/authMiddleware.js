import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";

export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    console.log(`🔐 Auth check for ${req.method} ${req.path}`);
    console.log(`📋 Token present: ${!!token}`);

    if (!token) {
      console.warn(`⚠️ No token provided for ${req.path}`);
      return res
        .status(401)
        .json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(`✅ Token decoded, userId: ${decoded.id}`);

    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.id),
    });
    if (!user) {
      console.warn(`⚠️ User not found for id: ${decoded.id}`);
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    console.log(`✅ User authenticated: ${user.email}`);
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      walletAddress: user.walletAddress,
      kycStatus: user.kycStatus,
    };
    next();
  } catch (err) {
    console.error("❌ Auth error:", err.message);
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
}

export function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Insufficient permissions",
        requiredRole: roles,
        currentRole: req.user.role,
      });
    }

    next();
  };
}

// Add default export for backwards compatibility
export default authenticateToken;

// Named exports
export { authenticateToken as authMiddleware, authenticateToken as protect };
