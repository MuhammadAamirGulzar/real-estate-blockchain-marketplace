import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertyCardSkeleton } from "@/components/ui/PropertyCardSkeleton";
import { useProperties } from "@/hooks/useProperties";
import React, { useCallback, useMemo } from "react";
import PropertyCard from "./PropertyCard";

// Constants
const SIMILAR_PROPERTIES_COUNT = 3;
const SKELETON_ITEMS = Array.from({ length: SIMILAR_PROPERTIES_COUNT });

/**
 * Error State Component
 * Displays error message when properties fail to load
 */
const ErrorState = () => (
  <div className="flex items-center justify-center p-8 rounded-lg bg-destructive/5 border border-destructive/20">
    <p className="text-destructive font-medium">
      Unable to load similar properties. Please try again later.
    </p>
  </div>
);

/**
 * Loading State Component
 * Displays skeleton loaders while properties are loading
 */
const LoadingState = () => (
  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
    {SKELETON_ITEMS.map((_, index) => (
      <PropertyCardSkeleton key={`skeleton-${index}`} />
    ))}
  </div>
);

/**
 * Empty State Component
 * Displays message when no similar properties are found
 */
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-48 rounded-lg bg-muted/40 border border-border/50">
    <p className="text-muted-foreground font-medium">
      No similar properties found
    </p>
    <p className="text-sm text-muted-foreground mt-1">
      Check back soon for new listings
    </p>
  </div>
);

/**
 * Properties Grid Component
 * Displays grid of similar properties
 */
const PropertiesGrid = ({ properties }) => (
  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
    {properties?.map((property) => (
      <PropertyCard key={property.id} property={property} />
    ))}
  </div>
);

/**
 * SimilarProperties Component
 * Displays a curated list of similar properties based on the current property.
 * Filters out the current property and shows up to 3 alternatives.
 *
 * Props:
 * @param {string} currentPropertyId - ID of the current property to exclude
 *
 * Features:
 * - Real-time property fetching via hook
 * - Error handling and fallback UI
 * - Loading skeleton states
 * - Empty state handling
 * - Performance optimized with memoization
 * - Responsive grid layout
 * - Consistent design system colors
 *
 * Future Enhancements:
 * - Filter by location similarity
 * - Filter by property type
 * - Filter by price range
 * - Sort by relevance score
 * - Pagination support
 *
 * @returns {React.ReactElement} Rendered similar properties section
 */
export const SimilarProperties = ({ currentPropertyId }) => {
  const { data: properties, isLoading, error } = useProperties();

  // Memoize filtered similar properties
  const similarProperties = useMemo(() => {
    if (!properties || properties.length === 0) return null;
    return properties
      .filter((p) => p.id !== currentPropertyId)
      .slice(0, SIMILAR_PROPERTIES_COUNT);
  }, [properties, currentPropertyId]);

  // Memoize loading state
  const loadingState = useMemo(() => <LoadingState />, []);

  // Memoize error state
  const errorState = useMemo(() => <ErrorState />, []);

  // Memoize empty state
  const emptyState = useMemo(() => <EmptyState />, []);

  // Memoize properties grid
  const propertiesGrid = useMemo(
    () => <PropertiesGrid properties={similarProperties} />,
    [similarProperties]
  );

  // Determine which state to render
  const renderContent = useCallback(() => {
    if (error) return errorState;
    if (isLoading) return loadingState;
    if (!similarProperties || similarProperties.length === 0) return emptyState;
    return propertiesGrid;
  }, [
    error,
    isLoading,
    similarProperties,
    errorState,
    loadingState,
    emptyState,
    propertiesGrid,
  ]);

  return (
    <Card className="border-border bg-card hover:shadow-md transition-shadow duration-200">
      <CardHeader className="border-b border-border/50">
        <CardTitle className="text-foreground">Similar Properties</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">{renderContent()}</CardContent>
    </Card>
  );
};

export default SimilarProperties;
