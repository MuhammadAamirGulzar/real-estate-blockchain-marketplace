import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";

/**
 * Wallet Authorization Service
 * Handles signature-based authentication for all blockchain actions
 */

// In-memory nonce storage (consider Redis for production)
const nonces = new Map();

/**
 * Generate a nonce for wallet signature
 */
export const generateWalletNonce = async (walletAddress) => {
  const nonce = uuidv4();
  const timestamp = Date.now();
  const expiresAt = timestamp + 5 * 60 * 1000; // 5 minutes

  nonces.set(walletAddress.toLowerCase(), {
    nonce,
    timestamp,
    expiresAt,
  });

  return {
    nonce,
    message: `Sign this message to authenticate with RWAchain: ${nonce}`,
    expiresAt,
  };
};

/**
 * Verify wallet signature and create session
 */
export const verifyWalletSignature = async (
  walletAddress,
  signature,
  message,
  userId = null
) => {
  const lowerWallet = walletAddress.toLowerCase();

  // Check nonce validity
  const nonceData = nonces.get(lowerWallet);
  console.log(
    `🔍 Verifying signature for ${lowerWallet}. Nonce found: ${!!nonceData}`
  );

  if (!nonceData) {
    console.log("❌ Nonce not found in map. Available keys:", [
      ...nonces.keys(),
    ]);
    throw new Error("Nonce expired or invalid. Request a new nonce.");
  }

  if (nonceData.expiresAt < Date.now()) {
    console.log(`❌ Nonce expired for ${lowerWallet}`);
    throw new Error("Nonce expired or invalid. Request a new nonce.");
  }

  // Verify signature
  let recoveredAddress;
  try {
    recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();
    console.log(
      `🔐 Recovered address: ${recoveredAddress}, Expected: ${lowerWallet}`
    );
  } catch (error) {
    console.error("❌ Ethers verifyMessage error:", error);
    throw new Error(`Invalid signature: ${error.message}`);
  }

  if (recoveredAddress !== lowerWallet) {
    console.error(
      `❌ Signature mismatch: Recovered ${recoveredAddress} !== Expected ${lowerWallet}`
    );
    throw new Error("Signature does not match wallet address");
  }

  // Clean up nonce
  nonces.delete(lowerWallet);

  // Create wallet session if userId provided
  if (userId) {
    const sessionNonce = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // TODO: Create walletSessions table if needed for session management
    // try {
    //   await db.insert(walletSessions).values({
    //     userId,
    //     walletAddress: lowerWallet,
    //     sessionNonce,
    //     signature,
    //     message,
    //     isActive: true,
    //     expiresAt,
    //   });
    // } catch (dbErr) {
    //   console.error("❌ DB Error inserting wallet session:", dbErr);
    // }
    console.log("Wallet session created (in-memory):", {
      userId,
      walletAddress: lowerWallet,
    });

    // Update user's wallet connection status
    try {
      await db
        .update(users)
        .set({
          walletLinkedAt: new Date(),
          lastWalletSignature: signature,
          isWalletConnected: true,
        })
        .where(eq(users.id, userId));
    } catch (dbErr) {
      console.error("❌ DB Error updating user wallet status:", dbErr);
      throw new Error(`Database error updating user: ${dbErr.message}`);
    }

    return { verified: true, sessionNonce, expiresAt };
  }

  return { verified: true };
};

/**
 * Verify wallet session for blockchain actions
 */
export const verifyWalletSession = async (
  userId,
  walletAddress,
  requiredRole = null
) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (
    !user.walletAddress ||
    user.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
  ) {
    throw new Error("Wallet address mismatch");
  }

  if (!user.isWalletConnected) {
    throw new Error("Wallet not connected");
  }

  if (requiredRole && user.role !== requiredRole) {
    throw new Error(`${requiredRole} role required`);
  }

  // TODO: Uncomment when walletSessions table is created
  // Check active wallet session
  // const activeSession = await db.query.walletSessions.findFirst({
  //   where: and(
  //     eq(walletSessions.userId, userId),
  //     eq(walletSessions.walletAddress, walletAddress.toLowerCase()),
  //     eq(walletSessions.isActive, true),
  //     gt(walletSessions.expiresAt, new Date())
  //   ),
  // });
  // if (!activeSession) {
  //   throw new Error("No active wallet session. Please reconnect your wallet.");
  // }
  // Update last used timestamp
  // await db
  //   .update(walletSessions)
  //   .set({ lastUsedAt: new Date() })
  //   .where(eq(walletSessions.id, activeSession.id));

  return { user, session: null };
};

/**
 * Verify signature for specific action
 */
export const verifyActionSignature = async (
  userId,
  walletAddress,
  action,
  signature,
  message,
  targetType = null,
  targetId = null
) => {
  // Verify wallet session first
  const { user } = await verifyWalletSession(userId, walletAddress);

  // Verify the action signature
  let recoveredAddress;
  try {
    recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();
  } catch (error) {
    throw new Error("Invalid action signature");
  }

  if (recoveredAddress !== walletAddress.toLowerCase()) {
    throw new Error("Action signature does not match wallet address");
  }

  // TODO: Create signatureVerifications table if needed for audit logging
  // await db.insert(signatureVerifications).values({
  //   userId,
  //   walletAddress: walletAddress.toLowerCase(),
  //   action,
  //   signature,
  //   message,
  //   isValid: true,
  //   targetType,
  //   targetId,
  // });
  console.log("Signature verified for action:", {
    userId,
    action,
    targetType,
    targetId,
  });

  return { user, verified: true };
};

/**
 * Log admin action with signature
 */
export const logAdminAction = async (
  adminId,
  action,
  signature,
  message,
  targetUserId = null,
  targetType = null,
  targetId = null,
  transactionHash = null,
  details = null
) => {
  // TODO: Create adminActions table in schema if needed for audit logging
  // await db.insert(adminActions).values({
  //   adminId,
  //   action,
  //   targetUserId,
  //   targetType,
  //   targetId,
  //   signature,
  //   message,
  //   transactionHash,
  //   details,
  // });
  console.log("Admin action logged:", {
    adminId,
    action,
    targetType,
    targetId,
  });
};

/**
 * Disconnect wallet session
 */
export const disconnectWallet = async (userId) => {
  // TODO: Uncomment when walletSessions table is created
  // Deactivate all wallet sessions
  // await db
  //   .update(walletSessions)
  //   .set({ isActive: false })
  //   .where(eq(walletSessions.userId, userId));
  console.log("Wallet disconnected:", { userId });

  // Update user wallet connection status
  await db
    .update(users)
    .set({
      isWalletConnected: false,
      lastWalletSignature: null,
      walletNonce: null,
      walletNonceExpiry: null,
    })
    .where(eq(users.id, userId));

  return { disconnected: true };
};

/**
 * Check if wallet can be changed (admin permission required)
 */
export const canChangeWallet = async (userId) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Only admin can change wallet addresses for users created by admin
  if (user.createdByAdmin && user.role !== "admin") {
    return false;
  }

  return true;
};

/**
 * Admin-only: Change user's wallet address
 */
export const adminChangeWallet = async (
  adminId,
  targetUserId,
  newWalletAddress,
  signature,
  message
) => {
  // Verify admin permissions
  const admin = await db.query.users.findFirst({
    where: eq(users.id, adminId),
  });

  if (!admin || admin.role !== "admin") {
    throw new Error("Admin permissions required");
  }

  // Verify admin signature
  await verifyActionSignature(
    adminId,
    admin.walletAddress,
    "change_wallet",
    signature,
    message,
    "user",
    targetUserId
  );

  // Check if new wallet is already in use
  const existingUser = await db.query.users.findFirst({
    where: eq(users.walletAddress, newWalletAddress.toLowerCase()),
  });

  if (existingUser && existingUser.id !== targetUserId) {
    throw new Error("Wallet address already in use");
  }

  // Disconnect current wallet sessions
  await disconnectWallet(targetUserId);

  // Update wallet address
  await db
    .update(users)
    .set({
      walletAddress: newWalletAddress.toLowerCase(),
      isWalletConnected: false,
    })
    .where(eq(users.id, targetUserId));

  // Log admin action
  await logAdminAction(
    adminId,
    "change_wallet",
    signature,
    message,
    targetUserId,
    "user",
    targetUserId,
    null,
    { oldWallet: admin.walletAddress, newWallet: newWalletAddress }
  );

  return { success: true };
};

/**
 * Get user's wallet authorization status
 */
export const getWalletAuthStatus = async (userId) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    // TODO: Uncomment when walletSessions table is created
    // with: {
    //   walletSessions: {
    //     where: and(
    //       eq(walletSessions.isActive, true),
    //       gt(walletSessions.expiresAt, new Date())
    //     ),
    //   },
    // },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return {
    hasWallet: !!user.walletAddress,
    walletAddress: user.walletAddress,
    isConnected: user.isWalletConnected,
    canChangeWallet: await canChangeWallet(userId),
    activeSessions: 0, // user.walletSessions?.length || 0,
    lastConnected: user.walletLinkedAt,
  };
};

export default {
  generateWalletNonce,
  verifyWalletSignature,
  verifyWalletSession,
  verifyActionSignature,
  logAdminAction,
  disconnectWallet,
  canChangeWallet,
  adminChangeWallet,
  getWalletAuthStatus,
};
