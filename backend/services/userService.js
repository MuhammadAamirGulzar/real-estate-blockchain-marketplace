import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

/**
 * Find a user by their wallet address
 */
export const findUserByWalletAddress = async (walletAddress) => {
    return await db.query.users.findFirst({
        where: eq(users.walletAddress, walletAddress.toLowerCase()),
    });
};

/**
 * Find a user by their email
 */
export const findUserByEmail = async (email) => {
    return await db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase()),
    });
};

/**
 * Find a user by their ID
 */
export const findUserById = async (id) => {
    return await db.query.users.findFirst({
        where: eq(users.id, id),
    });
};

/**
 * Hash password
 */
export const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(12);
    return await bcrypt.hash(password, salt);
};

/**
 * Verify password
 */
export const verifyPassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

/**
 * Create a new user
 */
export const createUser = async (userData) => {
    const result = await db.insert(users).values({
        ...userData,
        walletAddress: userData.walletAddress ? userData.walletAddress.toLowerCase() : null,
    }).returning();
    return result[0];
};

/**
 * Update a user's KYC status
 */
export const updateKycStatus = async (userId, kycStatus) => {
    const result = await db.update(users)
        .set({ kycStatus })
        .where(eq(users.id, userId))
        .returning();
    return result[0];
};

/**
 * Update a user's role
 */
export const updateUserRole = async (walletAddress, role) => {
    const result = await db.update(users)
        .set({ role })
        .where(eq(users.walletAddress, walletAddress.toLowerCase()))
        .returning();
    return result[0];
};

/**
 * Update user profile information
 */
export const updateUserProfile = async (userId, profileData) => {
    const result = await db.update(users)
        .set(profileData)
        .where(eq(users.id, userId))
        .returning();
    return result[0];
};

/**
 * Connect wallet to existing user
 */
export const connectWalletToUser = async (userId, walletAddress) => {
    const result = await db.update(users)
        .set({ 
            walletAddress: walletAddress.toLowerCase(),
            isWalletConnected: true 
        })
        .where(eq(users.id, userId))
        .returning();
    return result[0];
};

/**
 * Get all users (admin function)
 */
export const getAllUsers = async () => {
    return await db.query.users.findMany({
        orderBy: (users, { desc }) => [desc(users.createdAt)],
    });
};

/**
 * Get users by role
 */
export const getUsersByRole = async (role) => {
    return await db.query.users.findMany({
        where: eq(users.role, role),
    });
};

/**
 * Get users by KYC status
 */
export const getUsersByKycStatus = async (kycStatus) => {
    return await db.query.users.findMany({
        where: eq(users.kycStatus, kycStatus),
    });
};