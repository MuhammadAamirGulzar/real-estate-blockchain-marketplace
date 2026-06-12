import { eq } from "drizzle-orm";
import path from "path";
import { db } from "../db/connection.js";
import { properties } from "../db/schema.js";
import { uploadCompletePropertyMetadata } from "./ipfsMetadataService.js";
import { web3Service } from "./web3Service.js";

/**
 * Get all properties from the database
 */
export const findAllProperties = async () => {
  return await db.query.properties.findMany({
    with: {
      lister: true,
    },
    orderBy: (properties, { desc }) => [desc(properties.createdAt)],
  });
};

/**
 * Find a property by its ID
 */
export const findPropertyById = async (id) => {
  return await db.query.properties.findFirst({
    where: eq(properties.id, parseInt(id)),
    with: {
      lister: true,
      investments: true,
    },
  });
};

/**
 * Find properties by status
 */
export const findPropertiesByStatus = async (status) => {
  return await db.query.properties.findMany({
    where: eq(properties.status, status),
    with: {
      lister: true,
    },
  });
};

/**
 * Find properties by lister ID
 */
export const findPropertiesByLister = async (listerId) => {
  return await db.query.properties.findMany({
    where: eq(properties.listerId, listerId),
  });
};

/**
 * Create a new property listing
 */
export const createProperty = async (propertyData) => {
  const result = await db.insert(properties).values(propertyData).returning();
  return result[0];
};

/**
 * Update a property's status
 */
export const updatePropertyStatus = async (id, status) => {
  const result = await db
    .update(properties)
    .set({ status })
    .where(eq(properties.id, parseInt(id)))
    .returning();
  return result[0];
};

/**
 * Update property with NFT data after minting
 */
export const updatePropertyWithNFTData = async (
  id,
  nftTokenId,
  fractionalTokenAddress
) => {
  const result = await db
    .update(properties)
    .set({
      nftTokenId: Number(nftTokenId),
      fractionalTokenAddress,
      status: "approved",
    })
    .where(eq(properties.id, parseInt(id)))
    .returning();
  return result[0];
};

/**
 * Update a property's details
 */
export const updateProperty = async (id, updateData) => {
  const result = await db
    .update(properties)
    .set(updateData)
    .where(eq(properties.id, parseInt(id)))
    .returning();
  return result[0];
};

/**
 * Delete a property (soft delete by changing status)
 */
export const deleteProperty = async (id) => {
  const result = await db
    .update(properties)
    .set({ status: "deleted" })
    .where(eq(properties.id, parseInt(id)))
    .returning();
  return result[0];
};

/**
 * Mint Property NFT after verification
 * Links database property → NFT → Fractional tokens
 */
export const mintPropertyNFT = async (propertyId) => {
  try {
    console.log(`🏠 Minting NFT for property ${propertyId}...`);

    const property = await findPropertyById(propertyId);

    if (!property) {
      throw new Error("Property not found in database");
    }

    if (property.status !== "verified") {
      throw new Error("Property must be verified before minting NFT");
    }

    // TODO: Create propertyDocuments and propertyImages tables if needed
    // Get property documents and images
    // const docs = await db
    //   .select()
    //   .from(propertyDocuments)
    //   .where(eq(propertyDocuments.propertyId, propertyId));
    // const images = await db
    //   .select()
    //   .from(propertyImages)
    //   .where(eq(propertyImages.propertyId, propertyId));

    const docs = [];
    const images = [];
    console.log("Property documents/images tables not yet implemented");

    // Prepare file paths for IPFS upload
    const uploadsDir = path.join(process.cwd(), "uploads");

    const mainImagePath =
      images.find((img) => img.isPrimary)?.filePath || images[0]?.filePath;
    const photosPaths = images
      .filter((img) => !img.isPrimary)
      .map((img) => path.join(uploadsDir, img.filePath));

    const titleDeedDoc = docs.find((doc) => doc.documentType === "title_deed");
    const ownershipProofDoc = docs.find(
      (doc) => doc.documentType === "ownership_proof"
    );
    const legalDocs = docs.filter(
      (doc) =>
        doc.documentType !== "title_deed" &&
        doc.documentType !== "ownership_proof"
    );

    const titleDeedPath = titleDeedDoc
      ? path.join(uploadsDir, titleDeedDoc.filePath)
      : null;
    const ownershipProofPath = ownershipProofDoc
      ? path.join(uploadsDir, ownershipProofDoc.filePath)
      : null;
    const legalDocsPaths = legalDocs.map((doc) =>
      path.join(uploadsDir, doc.filePath)
    );

    // Upload complete metadata to IPFS
    const {
      metadataCID,
      mainImageCID,
      photosCIDs,
      titleDeedCID,
      ownershipProofCID,
      legalDocsCIDs,
    } = await uploadCompletePropertyMetadata({
      propertyData: {
        name: property.title,
        description: property.description,
        propertyType: property.propertyType,
        address: property.address,
        city: property.city,
        state: property.state,
        country: property.country,
        postalCode: property.postalCode,
        coordinates: {
          lat: property.latitude,
          lng: property.longitude,
        },
        totalArea: property.totalArea,
        builtUpArea: property.builtUpArea,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        purchasePrice: property.purchasePrice,
        currentValuation: property.valuation,
        expectedROI: property.expectedRoi,
        rentalIncomeMonthly: property.rentalIncome,
        jurisdiction: property.jurisdiction || "UAE",
        hasEncumbrances: false,
        totalShares: property.totalShares || 1000000,
        sharePrice:
          property.sharePrice || Math.floor(property.valuation / 1000000),
        minInvestment: property.minInvestment || 100000,
      },
      mainImagePath: path.join(uploadsDir, mainImagePath),
      photosPaths,
      titleDeedPath,
      ownershipProofPath,
      legalDocsPaths,
    });

    console.log(`✅ Metadata uploaded to IPFS: ${metadataCID}`);

    // Mint NFT on blockchain
    const { propertyNFT } = web3Service;

    const onChainPropertyId = property.blockchainPropertyId || propertyId;

    const tx = await propertyNFT.mintPropertyNFT(
      onChainPropertyId,
      property.ownerId,
      property.valuation,
      `ipfs://${metadataCID}`
    );

    const receipt = await tx.wait();
    console.log(`✅ NFT minted. Transaction: ${receipt.hash}`);

    // Extract token ID from event
    const mintEvent = receipt.logs.find(
      (log) =>
        log.topics[0] ===
        propertyNFT.interface.getEvent("PropertyNFTMinted").topicHash
    );

    const tokenId = mintEvent ? mintEvent.args[0] : null;

    // Update database with NFT info
    await db
      .update(properties)
      .set({
        nftTokenId: tokenId?.toString(),
        nftContractAddress: await propertyNFT.getAddress(),
        metadataIpfsHash: metadataCID,
        imageIpfsHash: mainImageCID,
        status: "tokenized",
        updatedAt: new Date(),
      })
      .where(eq(properties.id, propertyId));

    console.log(
      `✅ Property ${propertyId} successfully tokenized as NFT #${tokenId}`
    );

    return {
      success: true,
      tokenId: tokenId?.toString(),
      nftContract: await propertyNFT.getAddress(),
      metadataCID,
      transactionHash: receipt.hash,
    };
  } catch (error) {
    console.error("❌ NFT minting failed:", error);
    throw error;
  }
};

/**
 * Open property for investment (fractionalize NFT)
 */
export const openPropertyForInvestment = async (propertyId) => {
  try {
    console.log(`💰 Opening property ${propertyId} for investment...`);

    const property = await findPropertyById(propertyId);

    if (!property) throw new Error("Property not found");
    if (!property.nftTokenId)
      throw new Error("Property must be tokenized first");

    const { investmentManager } = web3Service;

    const totalValueUSD = property.valuation;
    const totalShares = property.totalShares || 1000000;
    const minInvestmentUSD = property.minInvestment || 100000;

    const onChainPropertyId = property.blockchainPropertyId || propertyId;

    const tx = await investmentManager.openPropertyForInvestment(
      onChainPropertyId,
      totalValueUSD,
      totalShares,
      minInvestmentUSD
    );

    const receipt = await tx.wait();
    console.log(`✅ Property opened for investment. Tx: ${receipt.hash}`);

    // Update database
    await db
      .update(properties)
      .set({
        status: "open_for_investment",
        availableShares: totalShares,
        updatedAt: new Date(),
      })
      .where(eq(properties.id, propertyId));

    return {
      success: true,
      transactionHash: receipt.hash,
    };
  } catch (error) {
    console.error("❌ Failed to open property for investment:", error);
    throw error;
  }
};
