import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";

/**
 * Middleware to check if user has required role (off-chain database check)
 * @param {string|string[]} roleNames - Single role or array of roles (any match passes)
 */
export const checkRole = (roleNames) => {
  const roles = Array.isArray(roleNames) ? roleNames : [roleNames];

  return async (req, res, next) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    try {
      // Check if user's role is in the allowed list
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Required role(s): ${roles.join(" or ")}. Your role: ${req.user.role}`,
        });
      }

      req.user.currentRole = req.user.role;
      next();
    } catch (error) {
      console.error(`Role check failed:`, error);
      res.status(500).json({
        success: false,
        message: "Error checking user role.",
        error: error.message,
      });
    }
  };
};

/**
 * Middleware to check KYC approval status (off-chain database check)
 */
export const checkKYC = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  try {
    // Check KYC status from database
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user.id),
    });

    if (!user || user.kycStatus !== "approved") {
      return res.status(403).json({
        success: false,
        message: "KYC approval required to access this resource.",
        kycStatus: user?.kycStatus || "not_found",
      });
    }

    next();
  } catch (error) {
    console.error("KYC check failed:", error);
    res.status(500).json({
      success: false,
      message: "Error checking KYC status.",
      error: error.message,
    });
  }
};

/**
 * Creates a middleware function that checks if the authenticated user has one of the allowed roles.
 * @param {...string} allowedRoles - A list of roles that are allowed to access the route.
 * e.g., authorize('admin'), authorize('admin', 'verifier')
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // 1. This middleware assumes 'protect' middleware has already run and attached req.user
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // 2. Check if the user's role is in the list of allowed roles for this route
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: User with role '${req.user.role}' is not authorized to access this route.`,
      });
    }

    // 3. User has the required role, proceed.
    next();
  };
};

// Export alias for backwards compatibility
export { authorize as authorizeRoles, checkRole as roleMiddleware };

// Default export
export default checkRole;
