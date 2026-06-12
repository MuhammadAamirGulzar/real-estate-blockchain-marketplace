import { web3Service } from "./web3Service.js";
import { ethers } from "ethers";

/**
 * Mint a PropertyNFT using the detailed `mintProperty` function from your contract.
 * @param {Object} params - Minting parameters
 * @returns {Object} Minting result
 */
export const mintPropertyNFT = async ({
  assetRegistryId,
  metadataURI,
  fractionalTokenAddress,
  fractionalSupply,
  propertyValue,
  recipient,
}) => {
  try {
    const { propertyNFT: propertyNFTContract, serverWallet } = web3Service;
    if (!propertyNFTContract) {
      throw new Error("PropertyNFT contract not initialized in web3Service.");
    }

    const finalRecipient = recipient || serverWallet.address;

    console.log(`🎨 Minting PropertyNFT for asset ${assetRegistryId}...`);

    const tx = await propertyNFTContract.mintProperty(
      finalRecipient,
      assetRegistryId,
      metadataURI,
      fractionalTokenAddress,
      ethers.parseEther(fractionalSupply.toString()),
      ethers.parseUnits(propertyValue.toString(), 6) // Assuming 6 decimals for USD
    );

    const receipt = await tx.wait();

    // Extract tokenId from the 'PropertyMinted' event
    const mintEvent = receipt.logs.find(
      (log) =>
        log.topics[0] ===
        propertyNFTContract.interface.getEvent("PropertyMinted").topicHash
    );

    const tokenId = mintEvent ? Number(mintEvent.args[0]) : null;

    console.log(`✅ PropertyNFT minted - Token ID: ${tokenId}`);

    return {
      tokenId,
      transactionHash: receipt.hash,
      contractAddress: await propertyNFTContract.getAddress(),
      metadataURI,
    };
  } catch (error) {
    console.error("❌ Failed to mint PropertyNFT:", error);
    throw error;
  }
};

/**
 * Get NFT details from the blockchain
 */
export const getNFTDetails = async (tokenId) => {
  try {
    const propertyNFTContract = web3Service.propertyNFT;
    if (!propertyNFTContract) {
      throw new Error("PropertyNFT contract not initialized");
    }

    const nftData = await propertyNFTContract.properties(tokenId);

    return {
      tokenId,
      owner: nftData.owner || "Unknown",
      metadataURI: nftData.metadataURI || nftData.uri || "Unknown",
    };
  } catch (error) {
    console.error("❌ Error fetching NFT details:", error);
    throw error;
  }
};

/**
 * Transfer NFT to a new owner
 */
export const transferNFT = async (tokenId, toAddress) => {
  try {
    const propertyNFTContract = web3Service.propertyNFT;
    if (!propertyNFTContract) {
      throw new Error("PropertyNFT contract not initialized");
    }

    console.log(`🔄 Transferring NFT ${tokenId} to ${toAddress}...`);

    const tx = await propertyNFTContract.transferFrom(
      web3Service.serverWallet.address,
      toAddress,
      tokenId
    );
    const receipt = await tx.wait();

    console.log(`✅ NFT transferred successfully`);
    console.log(`   Transaction Hash: ${receipt.hash}`);

    return {
      success: true,
      transactionHash: receipt.hash,
    };
  } catch (error) {
    console.error("❌ Error transferring NFT:", error);
    throw error;
  }
};

/**
 * Get PropertyNFT info from the blockchain.
 * @param {number} tokenId - NFT token ID
 */
export const getPropertyInfo = async (tokenId) => {
  try {
    const { propertyNFT: propertyNFTContract } = web3Service;
    if (!propertyNFTContract) {
      throw new Error("PropertyNFT contract not initialized in web3Service.");
    }

    const info = await propertyNFTContract.getPropertyInfo(tokenId);

    return {
      assetRegistryId: info.assetRegistryId.toString(),
      fractionalTokenContract: info.fractionalTokenContract,
      totalFractionalSupply: ethers.formatEther(info.totalFractionalSupply),
      propertyValue: ethers.formatUnits(info.propertyValue, 6),
      isActive: info.isActive,
      createdAt: new Date(Number(info.createdAt) * 1000),
      creator: info.creator,
    };
  } catch (error) {
    console.error("❌ Failed to get property info:", error);
    throw error;
  }
};

/**
 * Set a property's active/inactive status on the blockchain.
 * @param {number} tokenId - NFT token ID
 * @param {boolean} active - The new active status
 */
export const setPropertyActive = async (tokenId, active) => {
  try {
    const { propertyNFT: propertyNFTContract } = web3Service;
    if (!propertyNFTContract) {
      throw new Error("PropertyNFT contract not initialized in web3Service.");
    }

    const tx = await propertyNFTContract.setPropertyActive(tokenId, active);
    const receipt = await tx.wait();

    console.log(
      `✅ Property ${tokenId} status set to ${active ? "active" : "inactive"}`
    );
    return receipt;
  } catch (error) {
    console.error("❌ Failed to set property active status:", error);
    throw error;
  }
};

/**
 * Update the metadata URI for a given token on the blockchain.
 * @param {number} tokenId - NFT token ID
 * @param {string} newURI - The new metadata URI
 */
export const updateMetadataURI = async (tokenId, newURI) => {
  try {
    const { propertyNFT: propertyNFTContract } = web3Service;
    if (!propertyNFTContract) {
      throw new Error("PropertyNFT contract not initialized in web3Service.");
    }

    const tx = await propertyNFTContract.updateMetadataURI(tokenId, newURI);
    const receipt = await tx.wait();

    console.log(`✅ Metadata URI updated for token ${tokenId}`);
    return receipt;
  } catch (error) {
    console.error("❌ Failed to update metadata URI:", error);
    throw error;
  }
};

/**
 * Get the NFT token ID by its associated asset registry ID.
 * @param {number} assetRegistryId - The asset registry ID
 */
export const getTokenIdByAssetId = async (assetRegistryId) => {
  try {
    const { propertyNFT: propertyNFTContract } = web3Service;
    if (!propertyNFTContract) {
      throw new Error("PropertyNFT contract not initialized in web3Service.");
    }
    const tokenId = await propertyNFTContract.getTokenIdByAssetId(assetRegistryId);
    return Number(tokenId);
  } catch (error) {
    console.error("❌ Failed to get token ID by asset ID:", error);
    throw error;
  }
};

/**
 * Check if a property NFT exists for a given asset registry ID.
 * @param {number} assetRegistryId - The asset registry ID
 */
export const propertyExists = async (assetRegistryId) => {
  try {
    const { propertyNFT: propertyNFTContract } = web3Service;
    if (!propertyNFTContract) {
      throw new Error("PropertyNFT contract not initialized in web3Service.");
    }
    return await propertyNFTContract.propertyExists(assetRegistryId);
  } catch (error) {
    console.error("❌ Failed to check property existence:", error);
    throw error;
  }
};