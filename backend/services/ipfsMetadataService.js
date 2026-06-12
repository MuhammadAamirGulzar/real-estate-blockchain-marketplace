import ipfsService from "./ipfsService.js";

/**
 * Create ERC-721 compatible property metadata
 */
export const createPropertyMetadata = ({
  // Basic Info
  name,
  description,
  image, // Main property image (IPFS CID)

  // Property Details
  propertyType, // 'residential' | 'commercial' | 'land' | 'mixed-use'
  address,
  city,
  state,
  country,
  postalCode,
  coordinates, // { lat, lng }

  // Physical Characteristics
  totalArea, // sq ft or sq m
  builtUpArea,
  bedrooms,
  bathrooms,
  floors,
  yearBuilt,

  // Financial
  purchasePrice, // USD cents
  currentValuation, // USD cents
  expectedROI, // Percentage (2 decimals)
  rentalIncomeMonthly, // USD cents

  // Legal
  titleDeedCID, // IPFS CID
  ownershipProofCID, // IPFS CID
  jurisdiction,
  hasEncumbrances,
  legalDocumentsCIDs = [], // Array of IPFS CIDs

  // Media
  photos = [], // Array of IPFS CIDs
  videos = [], // Array of IPFS CIDs
  virtualTourURL,
  floorPlanCID,

  // Investment
  totalShares,
  sharePrice, // USD cents
  minInvestment, // USD cents

  // Additional
  attributes = [], // Array of { trait_type, value }
  externalURL,
}) => {
  return {
    // ERC-721 Standard
    name,
    description,
    image: `ipfs://${image}`,
    external_url: externalURL || "",

    // RWA Extensions
    properties: {
      type: propertyType,
      location: {
        address,
        city,
        state,
        country,
        postalCode,
        coordinates,
      },
      physical: {
        totalArea,
        builtUpArea,
        bedrooms,
        bathrooms,
        floors,
        yearBuilt,
      },
      financial: {
        purchasePrice,
        currentValuation,
        expectedROI,
        rentalIncomeMonthly,
        valuationDate: new Date().toISOString(),
      },
      legal: {
        titleDeed: titleDeedCID ? `ipfs://${titleDeedCID}` : "",
        ownershipProof: ownershipProofCID ? `ipfs://${ownershipProofCID}` : "",
        jurisdiction,
        hasEncumbrances,
        legalDocuments: legalDocumentsCIDs?.map((cid) => `ipfs://${cid}`) || [],
      },
      media: {
        photos: photos?.map((cid) => `ipfs://${cid}`) || [],
        videos: videos?.map((cid) => `ipfs://${cid}`) || [],
        virtualTour: virtualTourURL || "",
        floorPlan: floorPlanCID ? `ipfs://${floorPlanCID}` : "",
      },
      investment: {
        totalShares,
        sharePrice,
        minInvestment,
      },
    },
    attributes: attributes || [],
  };
};

/**
 * Upload multiple files to IPFS with pinning
 */
export const uploadMultipleFiles = async (fileBuffers) => {
  try {
    console.log(`📤 Uploading ${fileBuffers.length} files to IPFS...`);

    const cids = [];
    for (const { buffer, fileName } of fileBuffers) {
      const cid = await ipfsService.uploadToIPFS(buffer, fileName);

      // Auto-pin the content
      await ipfsService.pinContent(cid, `Multiple-${fileName}`);

      cids.push(cid);
    }

    console.log(`✅ All files uploaded and pinned: ${cids.length} files`);
    return cids;
  } catch (error) {
    console.error("❌ Multiple file upload failed:", error);
    throw error;
  }
};

/**
 * Complete property metadata upload workflow with Pinata integration
 */
export const uploadCompletePropertyMetadata = async ({
  propertyData,
  mainImageBuffer,
  photosBuffers = [],
  titleDeedBuffer,
  ownershipProofBuffer,
  legalDocsBuffers = [],
  floorPlanBuffer,
}) => {
  try {
    console.log("📤 Starting complete property metadata upload to Pinata...");

    // Upload main image
    console.log("  📸 Uploading main image...");
    const mainImageCID = await ipfsService.uploadToIPFS(
      mainImageBuffer,
      "property-main-image"
    );
    await ipfsService.pinContent(
      mainImageCID,
      `Property-MainImage-${propertyData.name}`
    );

    // Upload photos
    console.log(`  📷 Uploading ${photosBuffers.length} photos...`);
    const photosCIDs =
      photosBuffers.length > 0 ? await uploadMultipleFiles(photosBuffers) : [];

    // Upload legal documents
    console.log("  📄 Uploading legal documents...");
    const titleDeedCID = titleDeedBuffer
      ? await ipfsService.uploadToIPFS(titleDeedBuffer, "title-deed")
      : null;

    if (titleDeedCID) {
      await ipfsService.pinContent(
        titleDeedCID,
        `Property-TitleDeed-${propertyData.name}`
      );
    }

    const ownershipProofCID = ownershipProofBuffer
      ? await ipfsService.uploadToIPFS(ownershipProofBuffer, "ownership-proof")
      : null;

    if (ownershipProofCID) {
      await ipfsService.pinContent(
        ownershipProofCID,
        `Property-OwnershipProof-${propertyData.name}`
      );
    }

    const legalDocsCIDs =
      legalDocsBuffers.length > 0
        ? await uploadMultipleFiles(legalDocsBuffers)
        : [];

    // Upload floor plan
    console.log("  🏗️  Uploading floor plan...");
    const floorPlanCID = floorPlanBuffer
      ? await ipfsService.uploadToIPFS(floorPlanBuffer, "floor-plan")
      : null;

    if (floorPlanCID) {
      await ipfsService.pinContent(
        floorPlanCID,
        `Property-FloorPlan-${propertyData.name}`
      );
    }

    // Create complete metadata
    console.log("  🔧 Creating metadata...");
    const metadata = createPropertyMetadata({
      ...propertyData,
      image: mainImageCID,
      photos: photosCIDs,
      titleDeedCID,
      ownershipProofCID,
      legalDocumentsCIDs: legalDocsCIDs,
      floorPlanCID,
    });

    // Upload metadata JSON
    console.log("  📋 Uploading metadata JSON...");
    const metadataCID = await ipfsService.uploadMetadataToIPFS(
      metadata,
      "property-metadata.json"
    );

    // Pin the metadata
    await ipfsService.pinContent(
      metadataCID,
      `Property-Metadata-${propertyData.name}`
    );

    console.log("\n✅ Complete metadata uploaded and pinned successfully");
    console.log(`   📌 Metadata CID: ${metadataCID}`);
    console.log(`   🖼️  Main Image CID: ${mainImageCID}`);
    console.log(`   📸 Photos: ${photosCIDs.length} uploaded`);
    console.log(`   📄 Legal Docs: ${legalDocsCIDs.length} uploaded`);
    console.log(`   🏗️  Floor Plan CID: ${floorPlanCID || "N/A"}`);
    console.log(
      `\n   🔗 Gateway URL: ${ipfsService.getPinataGatewayURL(metadataCID)}`
    );

    return {
      metadataCID,
      mainImageCID,
      photosCIDs,
      titleDeedCID,
      ownershipProofCID,
      legalDocsCIDs,
      floorPlanCID,
      metadata,
      gatewayURL: ipfsService.getPinataGatewayURL(metadataCID),
    };
  } catch (error) {
    console.error("❌ Complete metadata upload failed:", error);
    throw error;
  }
};

/**
 * Simple property metadata upload with pinning
 */
export const uploadPropertyMetadata = async (propertyData) => {
  try {
    const { title, description, location, imageBuffer } = propertyData;

    console.log(`📤 Uploading property metadata: ${title}`);

    // Upload the image
    console.log("  📸 Uploading image...");
    const imageCID = await ipfsService.uploadToIPFS(
      imageBuffer,
      "property-image"
    );
    await ipfsService.pinContent(imageCID, `Property-Image-${title}`);

    // Create metadata
    const metadata = {
      name: title,
      description: description,
      image: `ipfs://${imageCID}`,
      attributes: [
        { trait_type: "Location", value: location },
        { trait_type: "Property Type", value: "Real Estate" },
        { trait_type: "Created", value: new Date().toISOString() },
      ],
    };

    // Upload metadata JSON
    console.log("  📋 Uploading metadata...");
    const metadataCID = await ipfsService.uploadMetadataToIPFS(
      metadata,
      "metadata.json"
    );

    // Pin the metadata
    await ipfsService.pinContent(metadataCID, `Property-${title}`);

    const metadataURI = `ipfs://${metadataCID}`;
    console.log(`✅ Metadata uploaded and pinned: ${metadataURI}`);
    console.log(
      `   🔗 Gateway: ${ipfsService.getPinataGatewayURL(metadataCID)}`
    );

    return metadataURI;
  } catch (error) {
    console.error("❌ Property metadata upload failed:", error);
    throw error;
  }
};

/**
 * Get metadata from IPFS using Pinata gateway
 */
export const getPropertyMetadata = async (cid) => {
  try {
    console.log(`📥 Retrieving metadata from IPFS: ${cid}`);

    const buffer = await ipfsService.getFromIPFS(cid);
    const metadata = JSON.parse(buffer.toString());

    console.log(`✅ Metadata retrieved successfully`);
    return metadata;
  } catch (error) {
    console.error("❌ Failed to retrieve metadata:", error);
    throw error;
  }
};

/**
 * Get Pinata account stats
 */
export const getPinataStats = async () => {
  try {
    return await ipfsService.getPinataUsage();
  } catch (error) {
    console.error("❌ Failed to get Pinata stats:", error);
    return null;
  }
};

/**
 * List all pinned property metadata
 */
export const listPinnedProperties = async (limit = 20) => {
  try {
    console.log(`📋 Listing pinned properties (limit: ${limit})...`);
    const files = await ipfsService.listPinnedFiles(limit);

    const properties = files.filter((f) =>
      f.metadata?.name?.includes("Property")
    );
    console.log(`✅ Found ${properties.length} pinned properties`);

    return properties;
  } catch (error) {
    console.error("❌ Failed to list pinned properties:", error);
    return [];
  }
};

export default {
  createPropertyMetadata,
  uploadMultipleFiles,
  uploadCompletePropertyMetadata,
  uploadPropertyMetadata,
  getPropertyMetadata,
  getPinataStats,
  listPinnedProperties,
};
