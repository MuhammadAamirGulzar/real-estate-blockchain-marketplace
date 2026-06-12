import { config } from "@/config/environment";
import { ethers } from "ethers";
import AssetRegistryABI from "../contracts/abi/AssetRegistry.json";

const getAssetRegistryAddress = () => {
  const addr = config.contracts.assetRegistry;
  if (!addr)
    throw new Error(
      "AssetRegistry contract address not configured. Ensure contracts are deployed and addresses.json is populated.",
    );
  return addr;
};

class VerificationService {
  /**
   * Get AssetRegistry contract instance
   */
  async getAssetRegistryContract(signer) {
    const address = getAssetRegistryAddress();
    return new ethers.Contract(address, AssetRegistryABI.abi, signer);
  }

  /**
   * Verify a property on the blockchain
   * @param {number} propertyId - The on-chain property ID
   * @param {object} signer - Ethers signer instance
   * @returns {Promise<object>} Transaction receipt
   */
  async verifyProperty(propertyId, signer) {
    try {
      const contract = await this.getAssetRegistryContract(signer);

      console.log("Verifying property on blockchain:", propertyId);
      const tx = await contract.verifyProperty(propertyId);

      console.log("Transaction submitted:", tx.hash);
      const receipt = await tx.wait();

      console.log("Property verified on blockchain:", receipt);
      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error("Error verifying property on blockchain:", error);
      throw new Error(
        error.message || "Failed to verify property on blockchain",
      );
    }
  }

  /**
   * Reject a property on the blockchain
   * @param {number} propertyId - The on-chain property ID
   * @param {string} reason - Rejection reason
   * @param {object} signer - Ethers signer instance
   * @returns {Promise<object>} Transaction receipt
   */
  async rejectProperty(propertyId, reason, signer) {
    try {
      const contract = await this.getAssetRegistryContract(signer);

      console.log("Rejecting property on blockchain:", propertyId, reason);
      const tx = await contract.rejectProperty(propertyId, reason);

      console.log("Transaction submitted:", tx.hash);
      const receipt = await tx.wait();

      console.log("Property rejected on blockchain:", receipt);
      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error("Error rejecting property on blockchain:", error);
      throw new Error(
        error.message || "Failed to reject property on blockchain",
      );
    }
  }

  /**
   * Get property details from blockchain
   * @param {number} propertyId - The on-chain property ID
   * @param {object} provider - Ethers provider instance
   * @returns {Promise<object>} Property details
   */
  async getPropertyDetails(propertyId, provider) {
    try {
      const contract = new ethers.Contract(
        ASSET_REGISTRY_ADDRESS,
        AssetRegistryABI.abi,
        provider,
      );

      const property = await contract.properties(propertyId);

      return {
        id: property.id.toString(),
        owner: property.owner,
        metadataHash: property.metadataHash,
        status: property.status,
        assignedVerifier: property.assignedVerifier,
        listedAt: property.listedAt.toString(),
        verifiedAt: property.verifiedAt.toString(),
        rejectionReason: property.rejectionReason,
      };
    } catch (error) {
      console.error("Error fetching property from blockchain:", error);
      throw error;
    }
  }

  /**
   * Check if user is assigned as verifier for a property
   * @param {number} propertyId - The on-chain property ID
   * @param {string} verifierAddress - Verifier's wallet address
   * @param {object} provider - Ethers provider instance
   * @returns {Promise<boolean>}
   */
  async isAssignedVerifier(propertyId, verifierAddress, provider) {
    try {
      const property = await this.getPropertyDetails(propertyId, provider);
      return (
        property.assignedVerifier.toLowerCase() ===
        verifierAddress.toLowerCase()
      );
    } catch (error) {
      console.error("Error checking verifier assignment:", error);
      return false;
    }
  }

  /**
   * List a property on-chain using the user's own KYC-approved wallet.
   * Must be called from the frontend — AssetRegistry.listProperty() requires
   * onlyKYCApproved and sets msg.sender as the on-chain property owner.
   */
  async listPropertyOnChain(metadataURI, signer) {
    const contract = await this.getAssetRegistryContract(signer);
    console.log("📝 Listing property on-chain with user wallet...");
    const tx = await contract.listProperty(metadataURI);
    const receipt = await tx.wait();

    let onChainId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === "PropertyListed") {
          onChainId = parsed.args.propertyId.toString();
          break;
        }
      } catch (_) {}
    }

    console.log(
      `✅ Property listed on-chain. ID: ${onChainId}, Tx: ${receipt.hash}`,
    );
    return { transactionHash: receipt.hash, onChainId };
  }
}

export const verificationService = new VerificationService();
