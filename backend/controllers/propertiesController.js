import { eq, inArray } from "drizzle-orm";
import { ethers } from "ethers";
import fs from "fs";
import { db } from "../db/connection.js";
import { properties, propertyDocuments } from "../db/schema.js";
import { uploadPropertyMetadata } from "../services/ipfsMetadataService.js";
import ipfsService from "../services/ipfsService.js";
import * as propertyService from "../services/propertyService.js";

export const listProperty = async (req, res) => {
  const {
    title,
    location,
    description,
    propertyType,
    propertyValue,
    // Extended fields
    streetAddress,
    city,
    state,
    country,
    unitNumber,
    floorNumber,
    totalArea,
    bedrooms,
    bathrooms,
    yearBuilt,
    propertyCondition,
    amenities,
    highlights,
    titleDeedNumber,
    monthlyRentalIncome,
    projectedRoi,
    // Wallet signature
    submissionSignature,
    submissionMessage,
  } = req.body;

  const listerId = req.user.id;

  // ── Verify wallet signature (non-blocking: no wallet = still accepted) ──────
  if (submissionSignature && submissionMessage) {
    try {
      const recovered = ethers.verifyMessage(
        submissionMessage,
        submissionSignature,
      );
      if (
        req.user.walletAddress &&
        recovered.toLowerCase() !== req.user.walletAddress.toLowerCase()
      ) {
        return res.status(400).json({
          message:
            "Signature verification failed: signer does not match your connected wallet.",
        });
      }
    } catch (_sigErr) {
      return res
        .status(400)
        .json({ message: "Invalid wallet signature format." });
    }
  }

  // Build a clean location string if not directly provided
  const resolvedLocation =
    location ||
    [streetAddress, city, state, country].filter(Boolean).join(", ") ||
    "Unknown";

  // Parse numeric fields safely
  const safeDecimal = (v) =>
    v !== undefined && v !== "" ? String(v) : undefined;
  const safeInt = (v) =>
    v !== undefined && v !== "" ? parseInt(v, 10) : undefined;

  try {
    // Upload metadata JSON to IPFS
    const metadataResult = await ipfsService.uploadJSONToIPFS({
      title,
      location: resolvedLocation,
      description,
      propertyType,
      propertyValue: safeDecimal(propertyValue),
      streetAddress,
      city,
      state,
      country,
      bedrooms: safeInt(bedrooms),
      bathrooms: safeInt(bathrooms),
      totalArea: safeDecimal(totalArea),
      yearBuilt: safeInt(yearBuilt),
      amenities: amenities ? JSON.parse(amenities) : [],
      projectedRoi: safeDecimal(projectedRoi),
      monthlyRentalIncome: safeDecimal(monthlyRentalIncome),
      documents: [],
    });

    // Persist to DB
    const newProperty = await propertyService.createProperty({
      listerId,
      title,
      location: resolvedLocation,
      description,
      propertyType,
      propertyValue: safeDecimal(propertyValue) || "0",
      metadataUrl: `ipfs://${metadataResult.ipfsHash}`,
      // Start as awaiting_blockchain; sync service promotes to pending_assignment
      // once the PropertyListed event fires on-chain
      status: "awaiting_blockchain",
      submissionSignature: submissionSignature || null,
      submissionMessage: submissionMessage || null,
      // Extended fields
      streetAddress: streetAddress || null,
      city: city || null,
      state: state || null,
      country: country || null,
      unitNumber: unitNumber || null,
      floorNumber: safeInt(floorNumber) || null,
      totalArea: safeDecimal(totalArea) || null,
      bedrooms: safeInt(bedrooms) || null,
      bathrooms: safeInt(bathrooms) || null,
      yearBuilt: safeInt(yearBuilt) || null,
      propertyCondition: propertyCondition || null,
      amenities: amenities || null,
      highlights: highlights || null,
      titleDeedNumber: titleDeedNumber || null,
      monthlyRentalIncome: safeDecimal(monthlyRentalIncome) || null,
      projectedRoi: safeDecimal(projectedRoi) || null,
    });

    // Upload each file to IPFS then persist document records
    if (req.files && Object.keys(req.files).length > 0) {
      const fileEntries = [];
      for (const [fieldName, fileArr] of Object.entries(req.files)) {
        const filesArr = Array.isArray(fileArr) ? fileArr : [fileArr];
        for (const file of filesArr) {
          let ipfsHash = "";
          let ipfsUrl = "";
          try {
            const buffer = fs.readFileSync(file.path);
            let result;
            if (fieldName === "photos") {
              result = await ipfsService.uploadPropertyImage(
                buffer,
                file.originalname,
              );
            } else {
              result = await ipfsService.uploadPropertyDocument(
                buffer,
                file.originalname,
                fieldName,
              );
            }
            ipfsHash = result.ipfsHash || "";
            ipfsUrl = result.ipfsUrl || "";
            console.log(
              `✅ IPFS upload: ${fieldName}/${file.originalname} → ${ipfsHash}`,
            );
          } catch (ipfsErr) {
            console.error(
              `⚠️  IPFS upload failed for ${file.originalname}:`,
              ipfsErr.message,
            );
          }
          fileEntries.push({
            propertyId: newProperty.id,
            documentType: fieldName,
            fileName: file.originalname,
            filePath: `/uploads/${file.filename}`,
            fileSize: file.size,
            mimeType: file.mimetype,
            ipfsHash,
            ipfsUrl,
          });
        }
      }
      if (fileEntries.length > 0) {
        await db.insert(propertyDocuments).values(fileEntries);
      }
    }

    // On-chain listing must be done by the frontend using the user's KYC-approved wallet.
    // AssetRegistry.listProperty() has onlyKYCApproved — the deployer key cannot call it.
    return res.status(201).json({
      message: "Property submitted for review.",
      property: newProperty,
    });
  } catch (error) {
    console.error("Error listing property:", error);
    res
      .status(500)
      .json({ message: "Failed to list property", error: error.message });
  }
};

// @desc    Get all properties from the database
// @route   GET /api/properties
export const getAllProperties = async (req, res) => {
  try {
    // Get status filter from query params (for marketplace: only tokenized)
    const { status } = req.query;

    let allProperties;
    if (status === "tokenized") {
      // Return both "tokenized" and "active" — both are marketplace-visible
      allProperties = await db
        .select()
        .from(properties)
        .where(inArray(properties.status, ["tokenized", "active"]));
    } else if (status) {
      allProperties = await db
        .select()
        .from(properties)
        .where(eq(properties.status, status));
    } else {
      allProperties = await propertyService.findAllProperties();
    }

    // Fetch first document (image/document) per property to expose as imageUrl
    const docs = await db
      .select({
        propertyId: propertyDocuments.propertyId,
        ipfsUrl: propertyDocuments.ipfsUrl,
      })
      .from(propertyDocuments);

    const docMap = docs.reduce((acc, doc) => {
      if (!acc[doc.propertyId]) acc[doc.propertyId] = doc.ipfsUrl;
      return acc;
    }, {});

    const enriched = allProperties.map((p) => ({
      ...p,
      imageUrl: docMap[p.id] || null,
      // Convert BigInt to string for JSON serialization
      assetRegistryId: p.assetRegistryId?.toString(),
      nftTokenId: p.nftTokenId?.toString(),
    }));

    res.json(enriched);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch properties", error: error.message });
  }
};

// @desc    Get a single property by ID from the database
// @route   GET /api/properties/:id
export const getPropertyById = async (req, res) => {
  try {
    const property = await propertyService.findPropertyById(req.params.id);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Fetch associated documents for image
    const docs = await db
      .select({ ipfsUrl: propertyDocuments.ipfsUrl })
      .from(propertyDocuments)
      .where(eq(propertyDocuments.propertyId, property.id))
      .limit(1);

    // Serialize BigInt values and add imageUrl
    const serialized = {
      ...property,
      imageUrl: docs[0]?.ipfsUrl || null,
      assetRegistryId: property.assetRegistryId?.toString(),
      nftTokenId: property.nftTokenId?.toString(),
    };

    res.json(serialized);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch property", error: error.message });
  }
};

// @desc    Create a new property listing (Admin only)
// @route   POST /api/properties
export const createProperty = async (req, res) => {
  // Note: Assumes file upload middleware like multer has processed the request
  // and the file path is available at req.file.path
  if (!req.file) {
    return res.status(400).json({ message: "Property image is required." });
  }

  const { title, description, location, propertyValue } = req.body;

  try {
    // 1. Upload property details and image to IPFS to get a metadata URI
    const metadataURI = await uploadPropertyMetadata({
      title,
      description,
      location,
      imagePath: req.file.path, // Path to the uploaded image
    });

    // 2. Save the property to the database with 'pending_assignment' status
    const newProperty = await propertyService.createProperty({
      title,
      description,
      location,
      propertyValue,
      metadataUrl: metadataURI,
      status: "pending_assignment",
      listerId: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: "Property created successfully",
      property: newProperty,
    });
  } catch (error) {
    console.error("Create property error:", error);
    res
      .status(500)
      .json({ message: "Failed to create property", error: error.message });
  }
};

export const delistProperty = async (req, res) => {
  const propertyId = parseInt(req.params.id, 10);
  const listerId = req.user.id;

  try {
    const property = await propertyService.findPropertyById(propertyId);

    if (!property) {
      return res.status(404).json({ message: "Property not found." });
    }

    // Security Check: Ensure the authenticated lister owns this property
    if (property.listerId !== listerId) {
      return res.status(403).json({
        message:
          "Forbidden: You do not have permission to delist this property.",
      });
    }

    // Update the property status to 'delisted'
    await propertyService.updatePropertyStatus(propertyId, "delisted");

    res.json({ message: "Property has been successfully delisted." });
  } catch (error) {
    console.error("Error delisting property:", error);
    res
      .status(500)
      .json({ message: "Failed to delist property", error: error.message });
  }
};

/**
 * Verifier approves a property listing.
 * This is currently an off-chain action that updates the DB.
 * Can be extended to call an AssetRegistry contract.
 */
export const approveProperty = async (req, res) => {
  const { propertyId } = req.params;
  const verifierId = req.user.id; // from 'protect' middleware

  try {
    const updatedProperty = await propertyService.updateProperty(propertyId, {
      status: "verified",
      verifiedBy: verifierId,
    });

    if (!updatedProperty) {
      return res
        .status(404)
        .json({ message: "Property not found or already processed" });
    }

    res.status(200).json({
      success: true,
      message: "Property approved successfully",
      property: updatedProperty,
    });
  } catch (error) {
    console.error("Error approving property:", error);
    res
      .status(500)
      .json({ message: "Failed to approve property", error: error.message });
  }
};
