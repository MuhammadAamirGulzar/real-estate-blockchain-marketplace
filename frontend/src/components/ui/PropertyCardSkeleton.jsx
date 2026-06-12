import * as React from 'react';
import { Card, CardContent, CardHeader } from './card';
import { Skeleton } from './skeleton';

/**
 * PropertyCardSkeleton Component
 * Loading skeleton for property card with smooth animations.
 * 
 * Features:
 * - Matches PropertyCard layout and dimensions
 * - Pulse animation for visual feedback
 * - Proper spacing and proportions
 * - Accessible design (no aria-label needed, used for loading state)
 * - Design system color integration
 * - Consistent rounded corners
 * - Professional appearance during data loading
 * 
 * Usage:
 * Basic Usage:
 * ```jsx
 * <PropertyCardSkeleton />
 * ```
 * 
 * In Grid Layout:
 * ```jsx
 * <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 *   {isLoading ? (
 *     Array.from({ length: 6 }).map((_, i) => (
 *       <PropertyCardSkeleton key={i} />
 *     ))
 *   ) : (
 *     properties.map((prop) => (
 *       <PropertyCard key={prop.id} property={prop} />
 *     ))
 *   )}
 * </div>
 * ```
 * 
 * With Suspense:
 * ```jsx
 * <Suspense fallback={<PropertyCardSkeleton />}>
 *   <PropertyCard propertyId={id} />
 * </Suspense>
 * ```
 * 
 * Multiple Skeletons:
 * ```jsx
 * <div className="space-y-4">
 *   {[1, 2, 3].map((key) => (
 *     <PropertyCardSkeleton key={key} />
 *   ))}
 * </div>
 * ```
 * 
 * Structure:
 * - Card wrapper with border and shadow
 * - Image skeleton (h-48 - 192px)
 * - Title skeleton (w-3/4)
 * - Description skeleton (w-1/2)
 * - Price/action skeleton (w-1/3)
 * 
 * Accessibility:
 * - Semantic HTML via Card component
 * - Proper spacing for readability
 * - No interactive elements (read-only)
 * - Screen readers will interpret as loading state
 * 
 * Performance:
 * - Memoized to prevent unnecessary re-renders
 * - No state or effects
 * - Lightweight component
 * - Uses Tailwind classes (no CSS-in-JS)
 * 
 * @returns {React.ReactElement} Rendered property card skeleton
 */
const PropertyCardSkeleton = React.memo(() => (
  <Card>
    <CardHeader className="p-0">
      <Skeleton className="w-full h-48 rounded-t-lg" />
    </CardHeader>
    <CardContent className="space-y-3 pt-4">
      <Skeleton className="w-3/4 h-6 rounded-md" />
      <Skeleton className="w-1/2 h-4 rounded-md" />
      <Skeleton className="w-1/3 h-8 rounded-md mt-2" />
    </CardContent>
  </Card>
));

PropertyCardSkeleton.displayName = 'PropertyCardSkeleton';

export { PropertyCardSkeleton };
