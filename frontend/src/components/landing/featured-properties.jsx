import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, MapPin, TrendingUp, Users } from "lucide-react";
import React, { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";

// Constants
const PROPERTY_STATUS = {
  ACTIVE: "active",
  COMING_SOON: "coming_soon",
};

const STATUS_CONFIG = {
  [PROPERTY_STATUS.ACTIVE]: {
    label: "Active",
    badgeClass: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
  },
  [PROPERTY_STATUS.COMING_SOON]: {
    label: "Coming Soon",
    badgeClass: "bg-accent text-accent-foreground hover:bg-accent/90",
  },
};

/**
 * Featured properties data
 * Each property includes tokenization details and investment metrics
 */
const FEATURED_PROPERTIES = [
  {
    id: 1,
    title: "Manhattan Office Complex",
    location: "New York, NY",
    image: "/modern-office-building-manhattan.jpg",
    roi: 14.2,
    tokenPrice: 250,
    totalValue: 12500000,
    tokensAvailable: 2450,
    investors: 156,
    status: PROPERTY_STATUS.ACTIVE,
  },
  {
    id: 2,
    title: "Miami Beach Resort",
    location: "Miami, FL",
    image: "/luxury-beach-resort-miami.jpg",
    roi: 11.8,
    tokenPrice: 180,
    totalValue: 8900000,
    tokensAvailable: 1890,
    investors: 203,
    status: PROPERTY_STATUS.ACTIVE,
  },
  {
    id: 3,
    title: "Austin Tech Hub",
    location: "Austin, TX",
    image: "/modern-tech-office-building-austin.jpg",
    roi: 13.5,
    tokenPrice: 320,
    totalValue: 15200000,
    tokensAvailable: 3100,
    investors: 89,
    status: PROPERTY_STATUS.COMING_SOON,
  },
];

/**
 * Section Header Component
 * Displays title and description for featured properties section
 */
const SectionHeader = () => (
  <div className="text-center mb-12 sm:mb-16">
    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-foreground">
      Featured{" "}
      <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
        Properties
      </span>
    </h2>
    <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
      Discover premium real estate opportunities with verified returns and
      transparent tokenization
    </p>
  </div>
);

/**
 * Property Image Component
 * Displays property image with status badge
 */
const PropertyImage = ({ image, title, status }) => {
  const statusConfig = STATUS_CONFIG[status];

  return (
    <div className="relative overflow-hidden">
      <img
        src={image || "/placeholder.svg"}
        alt={title}
        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
        loading="lazy"
      />
      <Badge className={`absolute top-4 right-4 ${statusConfig.badgeClass}`}>
        {statusConfig.label}
      </Badge>
    </div>
  );
};

/**
 * Property Header Component
 * Shows property title and location
 */
const PropertyHeader = ({ title, location }) => (
  <div className="mb-4">
    <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors duration-200">
      {title}
    </h3>
    <div className="flex items-center text-muted-foreground gap-1">
      <MapPin className="h-4 w-4 flex-shrink-0" />
      <span className="text-sm">{location}</span>
    </div>
  </div>
);

/**
 * Property Metrics Component
 * Displays ROI and investor count
 */
const PropertyMetrics = ({ roi, investors }) => (
  <div className="grid grid-cols-2 gap-4 mb-4">
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <TrendingUp className="h-4 w-4 text-secondary flex-shrink-0" />
        <span className="text-sm font-semibold text-secondary">
          {roi.toFixed(1)}% ROI
        </span>
      </div>
      <p className="text-xs text-muted-foreground">Annual Return</p>
    </div>
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <Users className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="text-sm font-semibold text-primary">
          {investors.toLocaleString()}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">Investors</p>
    </div>
  </div>
);

/**
 * Property Tokenization Details Component
 * Displays token price and available tokens
 */
const TokenizationDetails = ({ tokenPrice, tokensAvailable, totalValue }) => (
  <div className="border-t border-border pt-4 space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Token Price
        </p>
        <p className="text-lg font-bold text-primary">
          $
          {tokenPrice.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Available
        </p>
        <p className="text-lg font-bold text-foreground">
          {tokensAvailable.toLocaleString()}
        </p>
      </div>
    </div>
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        Total Value
      </p>
      <p className="text-sm text-foreground">
        $
        {(totalValue / 1000000).toLocaleString("en-US", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}
        M
      </p>
    </div>
  </div>
);

/**
 * Property Action Button Component
 * Handles navigation or coming soon state
 */
const PropertyActionButton = ({ propertyId, status }) => {
  const isActive = status === PROPERTY_STATUS.ACTIVE;

  if (isActive) {
    return (
      <Button
        asChild
        className="w-full mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Link to={`/marketplace/${propertyId}`}>
          View Details
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    );
  }

  return (
    <Button
      disabled
      className="w-full mt-4 bg-muted text-muted-foreground cursor-not-allowed"
    >
      Coming Soon
    </Button>
  );
};

/**
 * Property Card Component
 * Displays individual property with all details and actions
 */
const PropertyCard = ({ property }) => (
  <Card className="overflow-hidden border-border bg-card hover:shadow-lg transition-all duration-300 group">
    <PropertyImage
      image={property.image}
      title={property.title}
      status={property.status}
    />
    <CardContent className="p-6 space-y-4">
      <PropertyHeader title={property.title} location={property.location} />
      <PropertyMetrics roi={property.roi} investors={property.investors} />
      <TokenizationDetails
        tokenPrice={property.tokenPrice}
        tokensAvailable={property.tokensAvailable}
        totalValue={property.totalValue}
      />
      <PropertyActionButton propertyId={property.id} status={property.status} />
    </CardContent>
  </Card>
);

/**
 * Properties Grid Component
 * Renders grid of featured properties
 */
const PropertiesGrid = ({ properties }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-12">
    {properties.map((property) => (
      <PropertyCard key={property.id} property={property} />
    ))}
  </div>
);

/**
 * View All Button Component
 * Navigation link to full marketplace
 */
const ViewAllButton = () => (
  <div className="flex justify-center">
    <Button
      asChild
      size="lg"
      variant="outline"
      className="border-border text-foreground hover:bg-muted"
    >
      <Link to="/marketplace">
        View All Properties
        <ArrowRight className="ml-2 h-5 w-5" />
      </Link>
    </Button>
  </div>
);

/**
 * FeaturedProperties Component
 * Landing page section showcasing featured tokenized real estate properties.
 * Displays property metrics, tokenization details, and investment opportunities.
 * Integrates with marketplace for detailed property views.
 */
export function FeaturedProperties() {
  // Memoize properties to avoid recalculation
  const properties = useMemo(() => FEATURED_PROPERTIES, []);

  // Preload images for better performance
  const preloadImages = useCallback(() => {
    properties.forEach((property) => {
      if (property.image) {
        const img = new Image();
        img.src = property.image;
      }
    });
  }, [properties]);

  // Preload images on component mount
  React.useEffect(() => {
    preloadImages();
  }, [preloadImages]);

  return (
    <section className="py-16 sm:py-20 bg-muted/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader />
        <PropertiesGrid properties={properties} />
        <ViewAllButton />
      </div>
    </section>
  );
}

export default FeaturedProperties;
