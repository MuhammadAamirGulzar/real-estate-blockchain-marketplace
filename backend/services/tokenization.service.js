import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { db } from "../db/connection.js";
import { properties } from "../db/schema.js";
import FractionalTokenService from "./FractionalTokenService.js";
import { web3Service } from "./web3Service.js";

/**
 * @title TokenizationService
 * @notice Service for tokenizing verified properties (Admin only)
 * @dev Handles the complete flow: PropertyNFT minting + FractionalPropertyToken deployment
 */
class TokenizationService {
  /**
   * Tokenize a verified property (ATOMIC VERSION)
   * @param {Object} params - Tokenization parameters
   * @returns {Object} Tokenization result with NFT and fractional token details
   * @description Uses atomic transaction pattern - blockchain fails = DB doesn't update
   */
  async tokenizeProperty({
    propertyId,
    adminWalletAddress,
    fractionalTokenName,
    fractionalTokenSymbol,
    totalFractionalSupply,
    propertyValuation,
    metadataURI,
    treasuryAddress,
  }) {
    let fractionalTokenResult = null; // Declare outside try block for catch access
    try {
      console.log(
        `🎯 Starting ATOMIC tokenization for property ID: ${propertyId}`,
      );

      // 0. Ensure web3Service is initialized
      if (!web3Service.initialized) {
        throw new Error(
          "Web3Service not initialized. Please restart the backend server.",
        );
      }

      if (!web3Service.contracts.PropertyNFT) {
        throw new Error(
          "PropertyNFT contract not available. Please check contract deployment and addresses.json.",
        );
      }

      // 1. Fetch property from database
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      if (!property) {
        throw new Error(`Property with ID ${propertyId} not found`);
      }

      // 2. Validate property status
      if (property.status !== "verified") {
        throw new Error(
          `Property must be verified before tokenization. Current status: ${property.status}`,
        );
      }

      // 3. Check if already tokenized
      if (property.nftTokenId || property.fractionalTokenAddress) {
        throw new Error(
          `Property already tokenized. NFT Token ID: ${property.nftTokenId}, Fractional Token: ${property.fractionalTokenAddress}`,
        );
      }

      // 4. Use assetRegistryId if available, otherwise use property ID as fallback
      const assetRegistryId = property.assetRegistryId || BigInt(propertyId);

      console.log(
        `📌 Using Asset Registry ID: ${assetRegistryId.toString()} (${
          property.assetRegistryId ? "from blockchain" : "database property ID"
        })`,
      );

      // 5. Check if this assetRegistryId already has an NFT
      const existingNFT = await this.checkExistingNFT(assetRegistryId);
      if (existingNFT) {
        throw new Error(
          `AssetRegistry ID ${assetRegistryId.toString()} already has NFT token ID: ${existingNFT}`,
        );
      }

      console.log("✅ Property validation passed");

      // 6. Deploy FractionalPropertyToken contract (prerequisite step)
      console.log("📦 Deploying FractionalPropertyToken...");
      const fractionalTokenResult =
        await FractionalTokenService.deployFractionalToken({
          propertyId: assetRegistryId.toString(),
          nftTokenId: 0, // Will be set after NFT minting
          name: fractionalTokenName,
          symbol: fractionalTokenSymbol,
          initialSupply: totalFractionalSupply,
          treasury: treasuryAddress || adminWalletAddress,
        });

      console.log(
        `✅ FractionalPropertyToken deployed at: ${fractionalTokenResult.contractAddress}`,
      );

      // 7. Ensure signer has MINTER_ROLE before atomic transaction
      await this.ensureMinterRole();

      // 8. Convert values to proper units for blockchain call
      const fractionalSupplyWei = ethers.parseEther(
        totalFractionalSupply.toString(),
      );
      const propertyValueWei = ethers.parseUnits(
        propertyValuation.toString(),
        6,
      ); // Assuming 6 decimals for USD
      const recipient = treasuryAddress || adminWalletAddress;
      const metadataURIFinal = metadataURI || property.metadataUrl;

      console.log("🎨 Starting ATOMIC NFT minting + DB update...");

      // 9. ATOMIC TRANSACTION: Mint PropertyNFT + Update Database
      // If blockchain fails, dbOperation never runs
      // If dbOperation fails, transaction is logged but database remains unchanged
      const result = await web3Service.executeTransaction({
        contract: "PropertyNFT",
        function: "mintProperty",
        args: [
          recipient,
          assetRegistryId,
          metadataURIFinal,
          fractionalTokenResult.contractAddress,
          fractionalSupplyWei,
          propertyValueWei,
        ],
        dbOperation: async (receipt) => {
          console.log(
            "🔄 Blockchain transaction confirmed, extracting tokenId...",
          );

          // Extract tokenId from PropertyMinted event
          const { PropertyNFT } = web3Service.contracts;
          const mintEvent = receipt.logs.find((log) => {
            try {
              const parsed = PropertyNFT.interface.parseLog(log);
              return parsed && parsed.name === "PropertyMinted";
            } catch {
              return false;
            }
          });

          if (!mintEvent) {
            throw new Error(
              "PropertyMinted event not found in transaction logs",
            );
          }

          const parsedEvent = PropertyNFT.interface.parseLog(mintEvent);
          const tokenId = Number(parsedEvent.args.tokenId);

          console.log(`✅ Extracted NFT Token ID: ${tokenId}`);
          console.log("💾 Updating database atomically...");

          // Update database with tokenization data
          await db
            .update(properties)
            .set({
              nftTokenId: tokenId,
              fractionalTokenAddress: fractionalTokenResult.contractAddress,
              totalFractionalSupply: totalFractionalSupply.toString(),
              status: "tokenized", // Update status to tokenized
              tokenizationTransactionHash: receipt.hash,
            })
            .where(eq(properties.id, propertyId));

          console.log("✅ Database updated atomically");

          // Return data for final result
          return {
            nftTokenId: tokenId,
            fractionalTokenAddress: fractionalTokenResult.contractAddress,
            assetRegistryId: assetRegistryId.toString(),
          };
        },
      });

      console.log("✅ ATOMIC tokenization completed successfully");

      // 10. Return complete result with serialized BigInt values
      return {
        success: true,
        propertyId,
        assetRegistryId: result.dbResult.assetRegistryId,
        nftTokenId: result.dbResult.nftTokenId,
        fractionalTokenAddress: result.dbResult.fractionalTokenAddress,
        fractionalTokenName,
        fractionalTokenSymbol,
        totalFractionalSupply,
        propertyValuation,
        nftTransactionHash: result.transactionHash,
        tokenDeploymentHash: fractionalTokenResult.transactionHash,
        treasuryAddress: recipient,
        transactionId: result.transactionId,
        message: "Property successfully tokenized (atomic transaction)",
      };
    } catch (error) {
      console.error("❌ ATOMIC tokenization failed:", error);

      // Check if we deployed FractionalToken but failed during NFT minting
      if (
        fractionalTokenResult?.contractAddress &&
        !error.message.includes("FractionalToken")
      ) {
        console.error(
          "⚠️  WARNING: FractionalToken was deployed but NFT minting failed.",
          "\n    Fractional Token Address:",
          fractionalTokenResult.contractAddress,
          "\n    This is an orphaned contract. Database was NOT updated (atomic guarantee).",
        );
      }

      throw error;
    }
  }

  /**
   * Ensure signer has MINTER_ROLE on PropertyNFT contract
   * @private
   */
  async ensureMinterRole() {
    try {
      const { PropertyNFT } = web3Service.contracts;
      if (!PropertyNFT) {
        throw new Error("PropertyNFT contract not initialized");
      }

      console.log("🔐 Checking MINTER_ROLE on PropertyNFT...");
      const MINTER_ROLE = ethers.id("MINTER_ROLE");
      const signerAddress =
        PropertyNFT.runner?.address || PropertyNFT.signer?.address;

      if (!signerAddress) {
        throw new Error("Cannot determine signer address");
      }

      // Check if signer has MINTER_ROLE
      const hasMinterRole = await PropertyNFT.hasRole(
        MINTER_ROLE,
        signerAddress,
      );

      if (!hasMinterRole) {
        console.log(
          `⚙️ Granting MINTER_ROLE to signer (${signerAddress}) on PropertyNFT...`,
        );

        try {
          const grantTx = await PropertyNFT.grantRole(
            MINTER_ROLE,
            signerAddress,
          );
          const receipt = await grantTx.wait();
          console.log(`✅ MINTER_ROLE granted (tx: ${receipt.hash})`);
        } catch (roleError) {
          const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
          const isAdmin = await PropertyNFT.hasRole(
            DEFAULT_ADMIN_ROLE,
            signerAddress,
          );
          console.warn(
            `⚠️ Signer DEFAULT_ADMIN_ROLE: ${isAdmin} (grantRole failed)`,
          );
          throw new Error(
            `Failed to grant MINTER_ROLE. Signer may not have admin privileges.`,
          );
        }
      } else {
        console.log("✅ Signer already has MINTER_ROLE");
      }
    } catch (error) {
      console.error("❌ Failed to ensure MINTER_ROLE:", error);
      throw error;
    }
  }

  /**
   * Check if assetRegistryId already has an NFT
   * @param {BigInt} assetRegistryId - Asset registry ID
   * @returns {Number|null} Existing token ID or null
   */
  async checkExistingNFT(assetRegistryId) {
    try {
      const { PropertyNFT } = web3Service.contracts;

      if (!PropertyNFT) {
        throw new Error("PropertyNFT contract not initialized");
      }

      const propertyNFT = PropertyNFT;

      const tokenId = await propertyNFT.assetRegistryToTokenId(assetRegistryId);
      return tokenId > 0 ? Number(tokenId) : null;
    } catch (error) {
      console.error("Error checking existing NFT:", error);
      return null;
    }
  }

  /**
   * Get property tokenization status
   * @param {Number} propertyId - Property database ID
   * @returns {Object} Tokenization status
   */
  async getTokenizationStatus(propertyId) {
    try {
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      if (!property) {
        throw new Error(`Property with ID ${propertyId} not found`);
      }

      return {
        propertyId,
        isTokenized: !!(property.nftTokenId && property.fractionalTokenAddress),
        status: property.status,
        nftTokenId: property.nftTokenId,
        fractionalTokenAddress: property.fractionalTokenAddress,
        totalFractionalSupply: property.totalFractionalSupply,
        assetRegistryId: property.assetRegistryId?.toString(),
      };
    } catch (error) {
      console.error("Error getting tokenization status:", error);
      throw error;
    }
  }

  /**
   * Get property details for tokenization (Admin view)
   * @param {Number} propertyId - Property database ID
   * @returns {Object} Property details suitable for tokenization
   */
  async getPropertyForTokenization(propertyId) {
    try {
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      if (!property) {
        throw new Error(`Property with ID ${propertyId} not found`);
      }

      // Check blockchain status
      let onChainStatus = null;
      if (property.assetRegistryId) {
        try {
          const { assetRegistry } = web3Service.contracts;
          if (assetRegistry) {
            const onChainProperty = await assetRegistry.properties(
              property.assetRegistryId,
            );
            onChainStatus = {
              status: onChainProperty.status,
              owner: onChainProperty.owner,
              assignedVerifier: onChainProperty.assignedVerifier,
            };
          }
        } catch (error) {
          console.warn("Could not fetch on-chain property status:", error);
        }
      }

      return {
        ...property,
        assetRegistryId: property.assetRegistryId?.toString(),
        onChainStatus,
        canBeTokenized:
          property.status === "verified" &&
          !property.nftTokenId &&
          !property.fractionalTokenAddress,
      };
    } catch (error) {
      console.error("Error getting property for tokenization:", error);
      throw error;
    }
  }

  /**
   * Activate property for investment (after tokenization)
   * @param {Number} nftTokenId - NFT token ID
   * @returns {Object} Activation result
   */
  async activatePropertyForInvestment(nftTokenId) {
    try {
      const { PropertyNFT } = web3Service.contracts;

      if (!PropertyNFT) {
        throw new Error("PropertyNFT contract not initialized");
      }

      const propertyNFT = PropertyNFT;

      const tx = await propertyNFT.setPropertyActive(nftTokenId, true);
      const receipt = await tx.wait();

      // Update database
      await db
        .update(properties)
        .set({ status: "active" })
        .where(eq(properties.nftTokenId, nftTokenId));

      console.log(`✅ Property NFT ${nftTokenId} activated for investment`);

      return {
        success: true,
        nftTokenId,
        transactionHash: receipt.hash,
        message: "Property activated for investment",
      };
    } catch (error) {
      console.error("❌ Failed to activate property:", error);
      throw error;
    }
  }

  /**
   * Enable trading for fractional tokens
   * @param {String} fractionalTokenAddress - Fractional token contract address
   * @returns {Object} Trading enablement result
   */
  async enableTokenTrading(fractionalTokenAddress) {
    try {
      const result = await FractionalTokenService.enableTrading(
        fractionalTokenAddress,
      );

      console.log(
        `✅ Trading enabled for fractional token: ${fractionalTokenAddress}`,
      );

      return {
        success: true,
        fractionalTokenAddress,
        transactionHash: result.hash,
        message: "Trading enabled for fractional tokens",
      };
    } catch (error) {
      console.error("❌ Failed to enable trading:", error);
      throw error;
    }
  }
}

export default new TokenizationService();
