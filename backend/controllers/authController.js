import jwt from "jsonwebtoken";
import {
  connectWalletToUser,
  createUser,
  findUserByEmail,
  findUserByWalletAddress,
  hashPassword,
  updateKycStatus,
  verifyPassword,
} from "../services/userService.js";
import walletAuthService from "../services/walletAuthService.js";
import { web3Service } from "../services/web3Service.js";

// Email/Password Authentication
export const signup = async (req, res) => {
  try {
    console.log("📝 Signup request body:", req.body);
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      console.warn("❌ Missing required fields for signup");
      return res.status(400).json({
        success: false,
        message: "Email, password, first name, and last name are required",
      });
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      console.warn(`⚠️ User already exists: ${email}`);
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await createUser({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      role: "user",
      kycStatus: "not_submitted",
      isWalletConnected: false,
      canChangePassword: true, // Regular users can change their password
      createdByAdmin: false,
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log(`✅ User registered: ${email}`);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        kycStatus: user.kycStatus,
        walletAddress: user.walletAddress,
        isWalletConnected: user.isWalletConnected,
        canChangePassword: user.canChangePassword,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find user by email
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log(`✅ User logged in: ${email}`);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        kycStatus: user.kycStatus,
        walletAddress: user.walletAddress,
        isWalletConnected: user.isWalletConnected,
        canChangePassword: user.canChangePassword,
        createdByAdmin: user.createdByAdmin,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
};

// Wallet Connection and Management
export const connectWallet = async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;
    const userId = req.user.id; // From auth middleware

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({
        success: false,
        message: "Wallet address, signature, and message are required",
      });
    }

    const lowerWallet = walletAddress.toLowerCase();

    // Check if user can change wallet (admin permission required for admin-created users)
    const canChange = await walletAuthService.canChangeWallet(userId);
    if (!canChange) {
      return res.status(403).json({
        success: false,
        message: "Wallet address can only be changed by admin for this account",
      });
    }

    // Check if wallet is already connected to another user
    const existingWalletUser = await findUserByWalletAddress(lowerWallet);
    if (existingWalletUser && existingWalletUser.id !== userId) {
      return res.status(400).json({
        success: false,
        message: "This wallet is already connected to another account",
      });
    }

    // Verify signature and create wallet session
    const sessionData = await walletAuthService.verifyWalletSignature(
      lowerWallet,
      signature,
      message,
      userId
    );

    // Connect wallet to user
    const updatedUser = await connectWalletToUser(userId, lowerWallet);

    // Sync on-chain role if possible
    try {
      const { kycRegistry } = web3Service;
      if (kycRegistry) {
        const USER_ROLE = await kycRegistry.USER_ROLE();
        const isVerifiedOnChain = await kycRegistry.hasRole(
          USER_ROLE,
          lowerWallet
        );

        if (isVerifiedOnChain && updatedUser.kycStatus !== "approved") {
          await updateKycStatus(updatedUser.id, "approved");
          updatedUser.kycStatus = "approved";
          console.log(
            `✅ KYC status synced from blockchain for ${lowerWallet}`
          );
        }
      }
    } catch (error) {
      console.warn("Could not verify KYC status on-chain:", error.message);
    }

    console.log(`✅ Wallet connected: ${lowerWallet} to user ${userId}`);

    res.status(200).json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        kycStatus: updatedUser.kycStatus,
        walletAddress: updatedUser.walletAddress,
        isWalletConnected: updatedUser.isWalletConnected,
      },
      session: sessionData,
    });
  } catch (error) {
    console.error("Wallet connection error:", error);
    res.status(500).json({
      success: false,
      message: "Wallet connection failed",
      error: error.message,
    });
  }
};

export const getNonce = async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid wallet address",
      });
    }

    const nonceData = await walletAuthService.generateWalletNonce(
      walletAddress
    );

    console.log(`✅ Nonce generated for ${walletAddress}`);

    res.status(200).json({
      success: true,
      nonce: nonceData.nonce,
      message: nonceData.message,
      expiresAt: nonceData.expiresAt,
    });
  } catch (error) {
    console.error("Error generating nonce:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate nonce",
      error: error.message,
    });
  }
};

export const verifyWallet = async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({
        success: false,
        message: "Wallet address, signature, and message are required",
      });
    }

    const lowerWallet = walletAddress.toLowerCase();

    // Verify signature
    await walletAuthService.verifyWalletSignature(
      lowerWallet,
      signature,
      message
    );

    let user = await findUserByWalletAddress(lowerWallet);

    if (!user) {
      user = await createUser({
        walletAddress: lowerWallet,
        role: "user",
        kycStatus: "not_submitted",
        isWalletConnected: true,
      });
      console.log(`✅ New user created: ${lowerWallet}`);
    } else {
      // Update wallet connection status
      await connectWalletToUser(user.id, lowerWallet);
    }

    // Create wallet session
    const sessionData = await walletAuthService.verifyWalletSignature(
      lowerWallet,
      signature,
      message,
      user.id
    );

    // Sync on-chain role if possible
    try {
      const { kycRegistry } = web3Service;
      if (kycRegistry) {
        const USER_ROLE = await kycRegistry.USER_ROLE();
        const isVerifiedOnChain = await kycRegistry.hasRole(
          USER_ROLE,
          lowerWallet
        );

        if (isVerifiedOnChain && user.kycStatus !== "approved") {
          await updateKycStatus(user.id, "approved");
          user.kycStatus = "approved";
          console.log(
            `✅ KYC status synced from blockchain for ${lowerWallet}`
          );
        }
      }
    } catch (error) {
      console.warn("Could not verify KYC status on-chain:", error.message);
    }

    const token = jwt.sign(
      {
        id: user.id,
        walletAddress: user.walletAddress,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log(`✅ User authenticated: ${lowerWallet}`);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        kycStatus: user.kycStatus,
        isWalletConnected: true,
      },
      session: sessionData,
    });
  } catch (error) {
    console.error("Wallet verification error:", error);
    res.status(500).json({
      success: false,
      message: "Wallet verification failed",
      error: error.message,
    });
  }
};

export const logout = async (req, res) => {
  try {
    // If user has wallet connected, disconnect wallet sessions
    if (req.user && req.user.id) {
      await walletAuthService.disconnectWallet(req.user.id);
    }

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  }
};

export async function getCurrentUser(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Get wallet authorization status
    let walletAuthStatus = null;
    if (req.user.id) {
      try {
        walletAuthStatus = await walletAuthService.getWalletAuthStatus(
          req.user.id
        );
      } catch (error) {
        console.warn("Could not get wallet auth status:", error.message);
      }
    }

    res.json({
      success: true,
      user: {
        ...req.user,
        walletAuth: walletAuthStatus,
      },
    });
  } catch (err) {
    console.error("Get current user error:", err);
    res.status(500).json({ success: false, message: "Failed to get user" });
  }
}

/**
 * Disconnect wallet (user can disconnect anytime)
 */
export const disconnectWallet = async (req, res) => {
  try {
    const userId = req.user.id;

    await walletAuthService.disconnectWallet(userId);

    console.log(`✅ Wallet disconnected for user ${userId}`);

    res.status(200).json({
      success: true,
      message: "Wallet disconnected successfully",
    });
  } catch (error) {
    console.error("Wallet disconnection error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to disconnect wallet",
      error: error.message,
    });
  }
};

/**
 * Get wallet authorization status
 */
export const getWalletAuthStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const authStatus = await walletAuthService.getWalletAuthStatus(userId);

    res.status(200).json({
      success: true,
      walletAuth: authStatus,
    });
  } catch (error) {
    console.error("Error getting wallet auth status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get wallet authorization status",
      error: error.message,
    });
  }
};
