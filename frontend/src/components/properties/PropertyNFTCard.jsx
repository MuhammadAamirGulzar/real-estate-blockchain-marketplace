import { Button } from "@/components/ui/button";
import { resolvePropertyImages } from "@/lib/propertyImageResolver";
import {
  ArrowRight,
  BedDouble,
  Building2,
  MapPin,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

/**
 * PropertyNFTCard
 * Prypco-mint-style tokenized property card.
 * Shows: hero image, status badge, type chip, name/address,
 *        3-stat row (price / ROI / token price), funding progress bar,
 *        token availability, and invest CTA.
 */
export function PropertyNFTCard({ property, onInvest }) {
  const [imgIndex, setImgIndex] = useState(0);

  const {
    id,
    title,
    location,
    city,
    propertyType,
    propertyValue,
    price,
    projectedRoi,
    expectedReturn,
    tokenPrice,
    totalFractionalSupply,
    totalTokens,
    tokensSold,
    fundedAmount,
    fundingGoal,
    bedrooms,
    totalArea,
    sqft,
    status,
    imageUrl,
    images,
  } = property;

  /* ── Derived values ─────────────────────────────────────── */
  const listingPrice = Number(propertyValue || price || 0);
  const roi = Number(projectedRoi || expectedReturn || 0);
  const perToken = Number(tokenPrice || 0);

  const supply = Number(totalFractionalSupply || totalTokens || 0);
  const sold = Number(tokensSold || 0);
  const funded = Number(fundedAmount || 0);
  const goal = Number(fundingGoal || listingPrice || 1);

  const fundingPct =
    goal > 0
      ? Math.min((funded / goal) * 100, 100)
      : supply > 0
        ? Math.min((sold / supply) * 100, 100)
        : 0;
  const tokensRemaining = supply > 0 ? supply - sold : 0;

  const galleryImages = resolvePropertyImages(
    {
      ...property,
      imageUrl,
      images,
    },
    3,
  );
  const heroImage = galleryImages[imgIndex] || null;

  /* ── Status badge config ────────────────────────────────── */
  const statusConfig = {
    tokenized: {
      label: "ACTIVE",
      cls: "bg-green-500/20 text-green-400 border border-green-500/30",
    },
    active: {
      label: "ACTIVE",
      cls: "bg-green-500/20 text-green-400 border border-green-500/30",
    },
    funded: {
      label: "FUNDED",
      cls: "bg-gold-400/20  text-gold-300  border border-gold-400/30",
    },
    verified: {
      label: "VERIFIED",
      cls: "bg-blue-500/20  text-blue-400  border border-blue-500/30",
    },
    default: {
      label: "FUNDING",
      cls: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    },
  };
  const sc = statusConfig[status?.toLowerCase()] || statusConfig.default;

  const typeLabel = (propertyType || "Property")
    .replace(/_/g, " ")
    .toUpperCase();

  const formatUSD = (n) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(2)}M`
      : `$${n.toLocaleString("en-US")}`;

  return (
    <div className="group relative flex flex-col rounded-2xl overflow-hidden bg-navy-700 border border-navy-500 hover:border-gold-400/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
      {/* ── Hero Image ─────────────────────────────────────── */}
      <div className="relative aspect-[16/10] overflow-hidden bg-navy-800">
        {heroImage ? (
          <img
            src={heroImage}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => {
              setImgIndex((curr) =>
                curr < galleryImages.length - 1 ? curr + 1 : curr,
              );
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-navy-800 to-navy-600">
            <Building2 className="w-16 h-16 text-navy-400" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-900/90 via-navy-900/20 to-transparent" />

        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <span
            className={`text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full uppercase ${sc.cls}`}
          >
            {sc.label}
          </span>
        </div>

        {/* Property type chip */}
        <div className="absolute top-3 right-3">
          <span className="text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded-full bg-navy-900/70 border border-navy-400/30 text-navy-100 uppercase backdrop-blur-sm">
            {typeLabel}
          </span>
        </div>

        {/* City label at bottom of image */}
        {(city || location) && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-white/80">
            <MapPin className="w-3.5 h-3.5 text-gold-400" />
            <span className="text-xs font-medium">{city || location}</span>
          </div>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-5 gap-4">
        {/* Title */}
        <div>
          <h3 className="font-display text-base font-semibold text-foreground leading-tight line-clamp-2 group-hover:text-gold-300 transition-colors">
            {title}
          </h3>
          {location && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {location}
            </p>
          )}
        </div>

        {/* Quick specs */}
        {(bedrooms || totalArea || sqft) && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {bedrooms && (
              <span className="flex items-center gap-1">
                <BedDouble className="w-3.5 h-3.5" />
                {bedrooms} Bed
              </span>
            )}
            {(totalArea || sqft) && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {(totalArea || sqft)?.toLocaleString()} sqft
              </span>
            )}
          </div>
        )}

        {/* 3-stat row */}
        <div className="grid grid-cols-3 gap-2 py-3 border-y border-navy-500">
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Listing Price
            </p>
            <p className="text-sm font-bold text-foreground">
              {formatUSD(listingPrice)}
            </p>
          </div>
          <div className="space-y-0.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Annual ROI
            </p>
            <p className="text-sm font-bold text-green-400 flex items-center justify-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" />
              {roi.toFixed(2)}%
            </p>
          </div>
          <div className="space-y-0.5 text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Token Price
            </p>
            <p className="text-sm font-bold text-gold-400">
              {perToken > 0 ? `$${perToken.toFixed(2)}` : "TBD"}
            </p>
          </div>
        </div>

        {/* Funding progress */}
        {fundingPct > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Funding Progress</span>
              <span className="font-semibold text-gold-400">
                {fundingPct.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-navy-600 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-400 transition-all duration-700"
                style={{ width: `${fundingPct}%` }}
              />
            </div>
            {tokensRemaining > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" />
                {tokensRemaining.toLocaleString()} tokens remaining
              </p>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="flex gap-2 mt-auto pt-1">
          <Link to={`/property/${id}`} className="flex-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full border-navy-400 text-foreground hover:bg-navy-600 hover:border-gold-500 text-xs"
            >
              View Details
            </Button>
          </Link>
          {(status === "tokenized" || status === "active") && onInvest && (
            <Button
              size="sm"
              onClick={() => onInvest(property)}
              className="flex-1 text-xs font-semibold text-xs"
              style={{
                background: "linear-gradient(135deg, #D4AF37 0%, #8C7020 100%)",
                color: "#050D1F",
              }}
            >
              Invest Now
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PropertyNFTCard;
