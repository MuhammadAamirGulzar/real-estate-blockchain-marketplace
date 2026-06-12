import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import React, { useMemo } from "react";

// Constants
const MAP_CONFIG = {
  placeholder: {
    height: "h-64",
    message: "Map integration coming soon",
  },
};

/**
 * Map Header Component
 * Displays title with location icon
 */
const MapHeader = () => (
  <CardHeader className="border-b border-border">
    <CardTitle className="flex items-center gap-3 text-foreground">
      <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
      <span>Property Location</span>
    </CardTitle>
  </CardHeader>
);

/**
 * Map Placeholder Component
 * Shows placeholder message while map is loading or not available
 */
const MapPlaceholder = () => (
  <div
    className={`flex flex-col items-center justify-center ${MAP_CONFIG.placeholder.height} rounded-lg bg-muted/40 border border-border/50`}
  >
    <MapPin className="w-12 h-12 text-muted-foreground mb-3 opacity-40" />
    <p className="text-muted-foreground text-sm font-medium">
      {MAP_CONFIG.placeholder.message}
    </p>
  </div>
);

/**
 * Coordinates Display Component
 * Shows property coordinates in a formatted manner
 */
const CoordinatesDisplay = ({ coordinates }) => {
  if (!coordinates || !coordinates.lat || !coordinates.lng) {
    return null;
  }

  return (
    <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/50">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Coordinates
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Latitude</p>
          <p className="text-sm font-mono text-foreground">
            {coordinates.lat.toFixed(6)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Longitude</p>
          <p className="text-sm font-mono text-foreground">
            {coordinates.lng.toFixed(6)}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Map Content Component
 * Container for map placeholder and coordinates
 */
const MapContentArea = ({ coordinates }) => (
  <CardContent className="p-6 space-y-4">
    <MapPlaceholder />
    <CoordinatesDisplay coordinates={coordinates} />
  </CardContent>
);

/**
 * PropertyMap Component
 * Displays property location map with coordinates.
 * Currently uses placeholder UI, ready for integration with Leaflet or Google Maps.
 *
 * Props:
 * @param {Object} coordinates - Property coordinates
 * @param {number} coordinates.lat - Latitude value
 * @param {number} coordinates.lng - Longitude value
 *
 * Features:
 * - Responsive design with proper spacing
 * - Formatted coordinate display
 * - Ready for map library integration
 * - Performance optimized with memoization
 * - Consistent with design system colors
 *
 * Future Integration:
 * - Replace MapPlaceholder with actual map library component
 * - Support for zoom, markers, and other map features
 * - Integration with property data from API
 *
 * @returns {React.ReactElement} Rendered property map card
 */
export const PropertyMap = ({ coordinates }) => {
  // Memoize content to prevent unnecessary re-renders
  const content = useMemo(
    () => <MapContentArea coordinates={coordinates} />,
    [coordinates]
  );

  return (
    <Card className="border-border bg-card hover:shadow-md transition-shadow duration-200">
      <MapHeader />
      {content}
    </Card>
  );
};

export default PropertyMap;
