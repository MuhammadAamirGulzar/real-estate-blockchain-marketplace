import * as api from "@/services/api";
import { useEffect, useState } from "react";

export const useProperty = (id) => {
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const fetchProperty = async () => {
      try {
        setLoading(true);
        const data = await api.getProperty(id);

        // Normalize the property data
        const propertyValue =
          Number(data.propertyValue ?? data.price ?? 0) || 0;
        const projectedRoi =
          Number(
            data.projectedRoi ??
              data.expectedReturn ??
              data.expectedROI ??
              data.expectedRoi ??
              0,
          ) || 0;
        const tokenPrice =
          Number(
            data.tokenPrice ??
              data.sharePrice ??
              (propertyValue > 0 ? propertyValue / 10000 : 1),
          ) || 1;
        const supply =
          Number(data.totalFractionalSupply ?? data.totalTokens ?? 0) || 0;
        const sold = Number(data.tokensSold ?? 0) || 0;

        // Parse amenities
        let amenities = data.amenities ?? [];
        if (typeof amenities === "string") {
          try {
            amenities = JSON.parse(amenities);
          } catch {
            amenities = [];
          }
        }

        // Build images array
        const images = (() => {
          if (data.imageUrls) {
            try {
              return JSON.parse(data.imageUrls);
            } catch {
              return [];
            }
          }
          if (data.images) return data.images;
          const single =
            data.imageUrl || data.image || data.ipfsUrl || data.documentUrl;
          if (single) return [single];
          return [];
        })();

        // Collect documents from response (may be nested or flat)
        const documents = data.documents ?? data.propertyDocuments ?? [];

        const normalized = {
          id: data.id,
          title: data.title || "Untitled Property",
          location:
            data.location ||
            [data.city, data.state, data.country].filter(Boolean).join(", ") ||
            "Unknown location",
          description: data.description || "",
          price: propertyValue,
          propertyValue,
          projectedRoi,
          expectedReturn: projectedRoi,
          status: data.status || "pending",
          image: images[0] || "/propertyimage.jpg",
          images,
          documents,
          // Extended property details
          propertyType: data.propertyType,
          streetAddress: data.streetAddress,
          city: data.city,
          state: data.state,
          country: data.country,
          unitNumber: data.unitNumber,
          floorNumber: data.floorNumber,
          totalArea: data.totalArea ?? data.sqft ?? data.builtUpArea,
          bedrooms: data.bedrooms,
          bathrooms: data.bathrooms,
          yearBuilt: data.yearBuilt,
          propertyCondition: data.propertyCondition,
          amenities,
          highlights: data.highlights,
          titleDeedNumber: data.titleDeedNumber,
          monthlyRentalIncome: Number(data.monthlyRentalIncome ?? 0) || 0,
          occupancyRate: data.occupancyRate,
          // Token / investment
          totalFractionalSupply: supply,
          totalTokens: supply,
          tokensSold: sold,
          tokenPrice,
          minInvestment: data.minInvestment || 500,
          // Blockchain
          nftTokenId: data.nftTokenId,
          fractionalTokenAddress: data.fractionalTokenAddress,
          assetRegistryId: data.assetRegistryId,
          // Metadata and timestamps
          metadataUrl: data.metadataUrl,
          lister: data.lister,
          listerId: data.listerId,
          createdAt: data.createdAt,
          verifiedAt: data.verifiedAt,
          verifiedBy: data.verifiedBy,
          verificationTransactionHash: data.verificationTransactionHash,
          rejectionReason: data.rejectionReason,
        };

        setProperty(normalized);
      } catch (err) {
        console.error("Error fetching property:", err);
        setError(err.message);

        // Fallback mock data for development
        setProperty({
          id: parseInt(id),
          title: "Property Not Found",
          location: "Unknown",
          description:
            "Could not load property details. Please try again later.",
          price: 0,
          propertyValue: 0,
          expectedReturn: 0,
          status: "unknown",
          image: "/hero.jpg",
          propertyType: "Unknown",
          yearBuilt: null,
          sqft: null,
          occupancyRate: null,
          totalTokens: 10000,
          availableTokens: 10000,
          tokensSold: 0,
          tokenPrice: 0,
          minInvestment: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProperty();
  }, [id]);

  return { property, loading, error };
};
