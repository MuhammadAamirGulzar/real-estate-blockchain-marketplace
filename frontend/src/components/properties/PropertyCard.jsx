import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { resolvePropertyImages } from "@/lib/propertyImageResolver";
import {
  ArrowRight,
  DollarSign,
  MapPin,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

/**
 * PropertyCard Component
 * Displays a single property listing card with image, details, and CTA.
 * Includes hover effects, responsive design, and lazy loading.
 *
 * Props:
 * @param {Object} property - Property data object
 * @param {string} property.id - Unique property identifier
 * @param {string} property.title - Property name/title
 * @param {string} property.location - Property location/address
 * @param {number} property.price - Property price (USD)
 * @param {string} property.image - Property image URL
 * @param {number} property.fundedPercentage - Funding percentage (0-100)
 * @param {number} property.apy - Annual percentage yield
 * @param {number} property.investors - Number of investors
 *
 * Features:
 * - Lazy loading for images
 * - Smooth hover animations
 * - Responsive design
 * - Performance optimized with memoization
 * - Consistent design system colors
 * - Accessible component structure
 *
 * @returns {React.ReactElement} Rendered property card
 */
export function PropertyCard({ property }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  const {
    id,
    name,
    location,
    price,
    totalTokens,
    tokensSold,
    expectedReturn,
    status,
    type,
  } = property;

  const cardImages = resolvePropertyImages(property, 3);

  const fundingProgress = (tokensSold / totalTokens) * 100;
  const remainingTokens = totalTokens - tokensSold;

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-secondary text-secondary-foreground";
      case "funded":
        return "bg-primary text-primary-foreground";
      case "upcoming":
        return "bg-accent text-accent-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  return (
    <Card className="overflow-hidden group hover-lift theme-transition">
      {/* Image Section */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-4 rounded-full border-primary border-t-transparent animate-spin"></div>
          </div>
        )}
        <img
          src={cardImages[imageIndex]}
          alt={name}
          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() =>
            setImageIndex((curr) =>
              curr < cardImages.length - 1 ? curr + 1 : curr,
            )
          }
          loading="lazy"
        />

        {/* Status Badge */}
        <div className="absolute top-4 left-4">
          <Badge className={getStatusColor(status)}>
            {status || "Available"}
          </Badge>
        </div>

        {/* Type Badge */}
        {type && (
          <div className="absolute top-4 right-4">
            <Badge
              variant="outline"
              className="bg-background/80 backdrop-blur-sm"
            >
              {type}
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-6 space-y-4">
        {/* Title & Location */}
        <div>
          <h3 className="mb-2 text-xl font-bold transition-colors group-hover:text-primary line-clamp-1">
            {name}
          </h3>
          <div className="flex items-center text-sm text-muted-foreground">
            <MapPin className="flex-shrink-0 w-4 h-4 mr-1" />
            <span className="line-clamp-1">{location}</span>
          </div>
        </div>

        {/* Price & Return */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Total Value</p>
            <p className="text-lg font-bold text-foreground">
              {formatCurrency(price)}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">
              Expected Return
            </p>
            <div className="flex items-center">
              <TrendingUp className="w-4 h-4 mr-1 text-secondary" />
              <p className="text-lg font-bold text-secondary">
                {expectedReturn || "12"}%
              </p>
            </div>
          </div>
        </div>

        {/* Funding Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Funding Progress</span>
            <span className="font-semibold text-foreground">
              {fundingProgress.toFixed(1)}%
            </span>
          </div>
          <Progress value={fundingProgress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center">
              <Users className="w-3 h-3 mr-1" />
              <span>
                {formatNumber(tokensSold)} / {formatNumber(totalTokens)} tokens
              </span>
            </div>
            <span>{formatNumber(remainingTokens)} left</span>
          </div>
        </div>

        {/* Investment Info */}
        <div className="flex items-center justify-between pt-4 text-sm border-t border-border">
          <div className="flex items-center text-muted-foreground">
            <DollarSign className="w-4 h-4 mr-1" />
            <span>Min. Investment: ${formatNumber(price / totalTokens)}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-6 pt-0">
        <Button asChild className="w-full group/btn">
          <Link to={`/property/${id}`}>
            View Details
            <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover/btn:translate-x-1" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default PropertyCard;
