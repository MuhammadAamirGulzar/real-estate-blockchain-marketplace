import { api } from "./api";

/**
 * KYC Service
 * Handles KYC verification and compliance
 */
export const kycService = {
  /**
   * Submit KYC data
   */
  submitKYC: async (data) => {
    try {
      const formData = new FormData();
      formData.append("firstName", data.firstName);
      formData.append("lastName", data.lastName);
      formData.append("email", data.email);
      formData.append("phoneNumber", data.phoneNumber);
      formData.append("dateOfBirth", data.dateOfBirth);
      formData.append("nationality", data.nationality);
      formData.append("address", data.address);
      formData.append("city", data.city);
      formData.append("postalCode", data.postalCode);
      formData.append("country", data.country);

      // Add files
      if (data.idDocument) {
        formData.append("idDocument", data.idDocument);
      }
      if (data.proofOfAddress) {
        formData.append("proofOfAddress", data.proofOfAddress);
      }
      if (data.selfieImage) {
        formData.append("selfieImage", data.selfieImage);
      }

      const response = await api.post("/user/submit-kyc", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get KYC status
   */
  getKYCStatus: async () => {
    try {
      const response = await api.get("/user/kyc-status");
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Update KYC data
   */
  updateKYC: async (data) => {
    try {
      const response = await api.put("/user/profile", data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get KYC history
   */
  getKYCHistory: async () => {
    try {
      const response = await api.get("/user/kyc-status");
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Backward-compatible aliases used by older components.
  updateProfile: async (data) => {
    return kycService.updateKYC(data);
  },

  getHistory: async () => {
    return kycService.getKYCHistory();
  },
};
