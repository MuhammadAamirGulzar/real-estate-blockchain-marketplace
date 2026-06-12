import api from "./api";

/**
 * Admin Service - Handles all admin-specific API calls
 * Includes user management, KYC approval, property approval, tokenization
 */

/**
 * Get admin dashboard statistics
 * @returns {Promise<Object>} Dashboard stats (users, properties, KYC pending, etc.)
 */
export const getAdminStats = async () => {
  const response = await api.get("/admin/dashboard-stats");
  return response.data;
};

/**
 * Get all users in the system
 * @param {Object} filters - Optional filters (role, status, etc.)
 * @returns {Promise<Array>} List of users
 */
export const getAllUsers = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const response = await api.get(`/admin/users${params ? `?${params}` : ""}`);
  return response.data;
};

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User details
 */
export const getUserById = async (userId) => {
  const response = await api.get(`/admin/users/${userId}`);
  return response.data;
};

/**
 * Create a new sub-admin
 * @param {Object} userData - Sub-admin data (firstName, lastName, email)
 * @returns {Promise<Object>} Created sub-admin
 */
export const createSubAdmin = async (userData) => {
  const response = await api.post("/admin/create-subadmin", userData);
  return response.data;
};

/**
 * Create a new verifier
 * @param {Object} userData - Verifier data (firstName, lastName, email)
 * @returns {Promise<Object>} Created verifier
 */
export const createVerifier = async (userData) => {
  const response = await api.post("/admin/create-verifier", userData);
  return response.data;
};

/**
 * Get all pending KYC submissions
 * @returns {Promise<Array>} List of pending KYC submissions
 */
export const getPendingKYC = async () => {
  const response = await api.get("/admin/kyc-requests");
  return response.data;
};

/**
 * Get KYC submission by user ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} KYC submission details
 */
export const getKYCByUserId = async (userId) => {
  const response = await api.get(`/admin/kyc/${userId}`);
  return response.data;
};

/**
 * Approve KYC for a user
 * @param {string} userId - User ID
 * @param {Object} data - Optional approval data (adminNotes)
 * @returns {Promise<Object>} Approval result
 */
export const approveKYC = async (userId, data = {}) => {
  const response = await api.post(`/admin/kyc/${userId}/approve`, data);
  return response.data;
};

/**
 * Reject KYC for a user
 * @param {string} userId - User ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object>} Rejection result
 */
export const rejectKYC = async (userId, reason) => {
  const response = await api.post(`/admin/kyc/${userId}/reject`, { reason });
  return response.data;
};

/**
 * Get all properties (with optional filters)
 * @param {Object} filters - Optional filters (status, etc.)
 * @returns {Promise<Array>} List of properties
 */
export const getAllProperties = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const response = await api.get(
    `/admin/properties${params ? `?${params}` : ""}`,
  );
  return response.data;
};

/**
 * Get property by ID
 * @param {string} propertyId - Property ID
 * @returns {Promise<Object>} Property details
 */
export const getPropertyById = async (propertyId) => {
  const response = await api.get(`/admin/properties/${propertyId}`);
  return response.data;
};

/**
 * Approve a property (mark as verified by admin)
 * @param {string} propertyId - Property ID
 * @param {Object} data - Optional approval data
 * @returns {Promise<Object>} Approval result
 */
export const approveProperty = async (propertyId, data = {}) => {
  const response = await api.post(
    `/admin/properties/${propertyId}/approve`,
    data,
  );
  return response.data;
};

/**
 * Reject a property
 * @param {string} propertyId - Property ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object>} Rejection result
 */
export const rejectProperty = async (propertyId, reason) => {
  const response = await api.post(`/admin/properties/${propertyId}/reject`, {
    reason,
  });
  return response.data;
};

/**
 * Tokenize an approved property
 * @param {Object} tokenData - Tokenization data (propertyId, tokenName, tokenSymbol, totalSupply, pricePerToken, etc.)
 * @returns {Promise<Object>} Tokenization result with transaction hash
 */
export const tokenizeProperty = async (tokenData) => {
  const { propertyId, ...rest } = tokenData;
  const response = await api.post(
    `/admin/properties/${propertyId}/tokenize`,
    rest,
  );
  return response.data;
};

/**
 * Assign a verifier to a property
 * @param {string} propertyId - Property ID
 * @param {string} verifierId - Verifier user ID
 * @returns {Promise<Object>} Assignment result
 */
export const assignVerifier = async (propertyId, verifierId) => {
  const response = await api.post(
    `/admin/property/${propertyId}/assign-verifier`,
    {
      verifierId,
    },
  );
  return response.data;
};

/**
 * Update user role
 * @param {string} userId - User ID
 * @param {string} newRole - New role (admin, subadmin, verifier, user)
 * @returns {Promise<Object>} Update result
 */
export const updateUserRole = async (userId, newRole) => {
  const response = await api.put(`/admin/users/${userId}/role`, {
    role: newRole,
  });
  return response.data;
};

/**
 * Delete/deactivate a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteUser = async (userId) => {
  const response = await api.delete(`/admin/users/${userId}`);
  return response.data;
};

/**
 * Get system-wide settings
 * @returns {Promise<Object>} System settings
 */
export const getSystemSettings = async () => {
  const response = await api.get("/admin/settings");
  return response.data;
};

/**
 * Update system settings
 * @param {Object} settings - Settings to update
 * @returns {Promise<Object>} Update result
 */
export const updateSystemSettings = async (settings) => {
  const response = await api.put("/admin/settings", settings);
  return response.data;
};

const adminService = {
  getAdminStats,
  getAllUsers,
  getUserById,
  createSubAdmin,
  createVerifier,
  getPendingKYC,
  getKYCByUserId,
  approveKYC,
  rejectKYC,
  getAllProperties,
  getPropertyById,
  approveProperty,
  rejectProperty,
  tokenizeProperty,
  assignVerifier,
  updateUserRole,
  deleteUser,
  getSystemSettings,
  updateSystemSettings,
};

export default adminService;
