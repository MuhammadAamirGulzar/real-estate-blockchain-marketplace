import * as api from "@/services/api";
import { useEffect, useState } from "react";

export const useProperties = (status = null) => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoading(true);
        const data = await api.getProperties(status);

        // Normalise API response (supports array, {properties}, or {data})
        const apiList = Array.isArray(data)
          ? data
          : data?.properties || data?.data || [];

        const normalised = apiList.map((p, idx) => {
          const propertyValue = Number(p.propertyValue ?? p.price ?? 0) || 0;
          const projectedRoi =
            Number(
              p.projectedRoi ??
                p.expectedReturn ??
                p.expectedROI ??
                p.expectedRoi ??
                0,
            ) || 0;
          const tokenPrice = Number(p.tokenPrice ?? 0) || 0;
          const supply =
            Number(p.totalFractionalSupply ?? p.totalTokens ?? 0) || 0;
          const sold = Number(p.tokensSold ?? 0) || 0;

          // Parse amenities (may arrive as JSON string or array)
          let amenities = p.amenities ?? [];
          if (typeof amenities === "string") {
            try {
              amenities = JSON.parse(amenities);
            } catch {
              amenities = [];
            }
          }

          // Build images array
          const images = (() => {
            if (p.imageUrls) {
              try {
                return JSON.parse(p.imageUrls);
              } catch {
                return [];
              }
            }
            if (p.images) return p.images;
            if (p.imageUrl || p.image || p.ipfsUrl || p.documentUrl) {
              return [
                p.imageUrl || p.image || p.ipfsUrl || p.documentUrl,
              ].filter(Boolean);
            }
            return [];
          })();

          return {
            id: p.id ?? idx,
            title: p.title ?? "Untitled Property",
            location:
              p.location ??
              [p.city, p.state, p.country].filter(Boolean).join(", ") ??
              "Unknown location",
            price: propertyValue,
            propertyValue,
            projectedRoi,
            expectedReturn: projectedRoi,
            tokenPrice,
            totalFractionalSupply: supply,
            tokensSold: sold,
            status: p.status ?? "pending",
            image: images[0] || "/propertyimage.jpg",
            images,
            lister: p.lister,
            description: p.description,
            createdAt: p.createdAt,
            // Extended fields
            propertyType: p.propertyType,
            streetAddress: p.streetAddress,
            city: p.city,
            state: p.state,
            country: p.country,
            unitNumber: p.unitNumber,
            floorNumber: p.floorNumber,
            totalArea: p.totalArea ?? p.sqft,
            bedrooms: p.bedrooms,
            bathrooms: p.bathrooms,
            yearBuilt: p.yearBuilt,
            propertyCondition: p.propertyCondition,
            amenities,
            highlights: p.highlights,
            titleDeedNumber: p.titleDeedNumber,
            monthlyRentalIncome: Number(p.monthlyRentalIncome ?? 0) || 0,
            // Blockchain
            nftTokenId: p.nftTokenId,
            fractionalTokenAddress: p.fractionalTokenAddress,
            verifiedAt: p.verifiedAt,
            verificationTransactionHash: p.verificationTransactionHash,
            rejectionReason: p.rejectionReason,
            documents: p.documents ?? [],
          };
        });

        setProperties(normalised);
      } catch (err) {
        setError(err.message);
        // Mock data fallback
        setProperties([
          {
            id: 1,
            title: "Modern Single-Family Home in Austin",
            location: "Austin, TX",
            price: 485000,
            expectedReturn: 12.5,
            status: "approved",
            image: "/propertyimage.jpg",
          },
          {
            id: 2,
            title: "Miami Beach Resort",
            location: "Miami, FL",
            price: 3200000,
            expectedReturn: 15.2,
            status: "approved",
            image: "/luxury-beach-resort-miami.jpg",
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, [status]);

  return { properties, loading, error };
};
