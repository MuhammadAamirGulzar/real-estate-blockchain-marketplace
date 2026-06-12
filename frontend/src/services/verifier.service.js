import api from "./api";

/**
 * Verifier Service - Handles all verifier-specific API calls
 * Includes property verification, approval/rejection of assigned properties
 */

/**
 * Get verifier dashboard statistics
 * @returns {Promise<Object>} Dashboard stats (assigned properties, verified count, pending count)
 */
export const getVerifierStats = async () => {
  const response = await api.get("/verifier/stats");
  return response.data;
};

/**
 * Get all properties assigned to the current verifier
 * @param {Object} filters - Optional filters (status, etc.)
 * @returns {Promise<Array>} List of assigned properties
 */
export const getAssignedProperties = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const response = await api.get(
    `/verifier/assigned-properties${params ? `?${params}` : ""}`,
  );
  return response.data;
};

/**
 * Get detailed property information for verification
 * @param {string} propertyId - Property ID
 * @returns {Promise<Object>} Complete property details with documents
 */
export const getPropertyDetails = async (propertyId) => {
  const response = await api.get(`/verifier/properties/${propertyId}`);
  return response.data;
};

/**
 * Verify and approve a property
 * @param {string} propertyId - Property ID
 * @param {Object} verificationData - Verification details (notes, checklist items, etc.)
 * @returns {Promise<Object>} Verification result
 */
export const verifyProperty = async (propertyId, verificationData) => {
  const response = await api.post(
    `/verifier/property/${propertyId}/approve`,
    verificationData,
  );
  return response.data;
};

/**
 * Reject a property with reason
 * @param {string} propertyId - Property ID
 * @param {string} reason - Detailed rejection reason
 * @param {Object} additionalData - Optional additional data (specific issues, required fixes)
 * @returns {Promise<Object>} Rejection result
 */
export const rejectProperty = async (
  propertyId,
  reason,
  additionalData = {},
) => {
  const response = await api.post(`/verifier/property/${propertyId}/reject`, {
    reason,
    ...additionalData,
  });
  return response.data;
};

/**
 * Update verification progress/status
 * @param {string} propertyId - Property ID
 * @param {Object} progressData - Progress update data
 * @returns {Promise<Object>} Update result
 */
export const updateVerificationProgress = async (propertyId, progressData) => {
  const response = await api.put(
    `/verifier/properties/${propertyId}/progress`,
    progressData,
  );
  return response.data;
};

/**
 * Submit verification checklist for a property
 * @param {string} propertyId - Property ID
 * @param {Object} checklist - Checklist items with completion status
 * @returns {Promise<Object>} Submission result
 */
export const submitVerificationChecklist = async (propertyId, checklist) => {
  const response = await api.post(
    `/verifier/properties/${propertyId}/checklist`,
    checklist,
  );
  return response.data;
};

/**
 * Get verification history for the current verifier
 * @param {Object} filters - Optional filters (date range, status)
 * @returns {Promise<Array>} Verification history
 */
export const getVerificationHistory = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const response = await api.get(
    `/verifier/history${params ? `?${params}` : ""}`,
  );
  return response.data;
};

/**
 * Request additional information from property owner
 * @param {string} propertyId - Property ID
 * @param {Object} requestData - Information request details
 * @returns {Promise<Object>} Request result
 */
export const requestAdditionalInfo = async (propertyId, requestData) => {
  const response = await api.post(
    `/verifier/properties/${propertyId}/request-info`,
    requestData,
  );
  return response.data;
};

const verifierService = {
  getVerifierStats,
  getAssignedProperties,
  getPropertyDetails,
  verifyProperty,
  rejectProperty,
  updateVerificationProgress,
  submitVerificationChecklist,
  getVerificationHistory,
  requestAdditionalInfo,
};

export default verifierService;
