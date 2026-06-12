import InvestmentModal from "@/components/investment/InvestmentModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProperty } from "@/hooks/useProperty";
import { resolvePropertyImages } from "@/lib/propertyImageResolver";
import {
  ArrowLeft,
  BedDouble,
  Building2,
  Calendar,
  CheckCircle,
  Copy,
  ExternalLink,
  FileText,
  MapPin,
  Ruler,
  Shield,
  TrendingUp,
  Users,
  Wifi,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

const AMENITY_ICONS = {
  "Swimming Pool": Wifi,
  "Gym & Fitness": Users,
  "24/7 Security": Shield,
  "Covered Parking": Building2,
  Concierge: Users,
  "Smart Home": Wifi,
  "Rooftop Terrace": Building2,
  "Pet Friendly": CheckCircle,
};

export default function PropertyDetailsPage() {
  const { id } = useParams();
  const { property, loading } = useProperty(id);
  const [isInvestmentModalOpen, setIsInvestmentModalOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [activeImg, setActiveImg] = useState(0);

  const fmt = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n)
      ? n.toLocaleString("en-US", { maximumFractionDigits: d })
      : "N/A";
  };
  const fmtUSD = (v) => {
    const n = Number(v || 0);
    return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${fmt(v)}`;
  };
  const copy = (txt) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copied!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading property...</p>
        </div>
      </div>
    );
  }
  if (!property) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm">
          <Building2 className="w-16 h-16 text-navy-400 mx-auto" />
          <h3 className="text-xl font-bold text-foreground">
            Property Not Found
          </h3>
          <p className="text-muted-foreground text-sm">
            This property listing does not exist or has been removed.
          </p>
          <Link to="/marketplace">
            <Button
              variant="outline"
              className="border-navy-400 hover:bg-navy-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Marketplace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const images = resolvePropertyImages(property, 5);
  const heroImg = images[activeImg] || null;
  const amenities = property.amenities || [];
  const listingPrice = Number(property.propertyValue || property.price || 0);
  const roi = Number(property.projectedRoi || property.expectedReturn || 0);
  const rentIncome = Number(property.monthlyRentalIncome || 0);
  const supply = Number(
    property.totalFractionalSupply || property.totalTokens || 0,
  );
  const sold = Number(property.tokensSold || 0);
  const tokenPrice = Number(property.tokenPrice || 0);
  const fundPct = supply > 0 ? Math.min((sold / supply) * 100, 100) : 0;
  const remaining = supply - sold;

  const statusConfig = {
    tokenized: {
      label: "Active",
      cls: "bg-green-500/15 text-green-400 border border-green-500/25",
    },
    active: {
      label: "Active",
      cls: "bg-green-500/15 text-green-400 border border-green-500/25",
    },
    verified: {
      label: "Verified",
      cls: "bg-blue-500/15  text-blue-400  border border-blue-500/25",
    },
    funded: {
      label: "Funded",
      cls: "bg-gold-400/15  text-gold-300  border border-gold-400/25",
    },
    default: {
      label: "Pending",
      cls: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
    },
  };
  const sc =
    statusConfig[property.status?.toLowerCase()] || statusConfig.default;

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <div className="border-b border-navy-500 bg-navy-900">
        <div className="container-max py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              to="/marketplace"
              className="hover:text-gold-400 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Marketplace
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium line-clamp-1">
              {property.title}
            </span>
          </div>
        </div>
      </div>

      <div className="container-max py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── LEFT COLUMN ──────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <div className="space-y-2">
              <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-navy-700">
                {heroImg ? (
                  <img
                    src={heroImg}
                    alt={property.title}
                    className="w-full h-full object-cover"
                    onError={() => {
                      setImgError(true);
                      setActiveImg((curr) =>
                        curr < images.length - 1 ? curr + 1 : curr,
                      );
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Building2 className="w-20 h-20 text-navy-400" />
                  </div>
                )}
                {/* Status badge */}
                <div className="absolute top-4 left-4">
                  <span
                    className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider ${sc.cls}`}
                  >
                    {sc.label}
                  </span>
                </div>
                {property.nftTokenId && (
                  <div className="absolute top-4 right-4">
                    <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-navy-900/80 border border-navy-400/40 text-gold-400 backdrop-blur-sm">
                      NFT #{property.nftTokenId}
                    </span>
                  </div>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImg(i)}
                      className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all ${i === activeImg ? "border-gold-400" : "border-navy-500 hover:border-navy-300"}`}
                    >
                      <img
                        src={img}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title & Header */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                    {property.title}
                  </h1>
                  <div className="flex items-center gap-1.5 text-muted-foreground mt-1.5">
                    <MapPin className="w-4 h-4 text-gold-400 flex-shrink-0" />
                    <span className="text-sm">
                      {property.location ||
                        [property.city, property.state, property.country]
                          .filter(Boolean)
                          .join(", ")}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase ${sc.cls}`}
                >
                  {sc.label}
                </span>
              </div>
            </div>

            {/* Property Specs */}
            <Card className="bg-navy-700 border-navy-500">
              <CardHeader className="pb-4">
                <CardTitle className="text-base text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gold-400" />
                  Property Specifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    {
                      label: "Type",
                      value: property.propertyType?.replace(/_/g, " ") || "—",
                      icon: Building2,
                    },
                    {
                      label: "Bedrooms",
                      value:
                        property.bedrooms || property.sqft
                          ? `${property.bedrooms || "—"} Bed`
                          : "—",
                      icon: BedDouble,
                    },
                    {
                      label: "Area",
                      value:
                        property.totalArea || property.sqft
                          ? `${(property.totalArea || property.sqft)?.toLocaleString()} sqft`
                          : "—",
                      icon: Ruler,
                    },
                    {
                      label: "Year Built",
                      value: property.yearBuilt || "—",
                      icon: Calendar,
                    },
                    {
                      label: "Condition",
                      value: property.propertyCondition || "—",
                      icon: CheckCircle,
                    },
                    {
                      label: "Location",
                      value: property.city || "—",
                      icon: MapPin,
                    },
                    {
                      label: "Floor",
                      value: property.floorNumber || property.unitNumber || "—",
                      icon: Building2,
                    },
                    {
                      label: "Title Deed",
                      value: property.titleDeedNumber
                        ? property.titleDeedNumber.slice(0, 12) + "…"
                        : "On File",
                      icon: FileText,
                    },
                  ].map((s, i) => (
                    <div key={i} className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <s.icon className="w-3 h-3" />
                        {s.label}
                      </p>
                      <p className="text-sm font-semibold text-foreground capitalize">
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            {property.description && (
              <Card className="bg-navy-700 border-navy-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-foreground">
                    About This Property
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {property.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Financials */}
            <Card className="bg-navy-700 border-navy-500">
              <CardHeader className="pb-4">
                <CardTitle className="text-base text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-gold-400" />
                  Financial Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-navy-800 rounded-xl">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                      Listing Price
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {fmtUSD(listingPrice)}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-navy-800 rounded-xl">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                      Annual ROI
                    </p>
                    <p className="text-2xl font-bold text-green-400">
                      {roi.toFixed(2)}%
                    </p>
                  </div>
                  {rentIncome > 0 && (
                    <div className="text-center p-4 bg-navy-800 rounded-xl">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                        Monthly Rental
                      </p>
                      <p className="text-2xl font-bold text-gold-400">
                        {fmtUSD(rentIncome)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Amenities */}
            {amenities.length > 0 && (
              <Card className="bg-navy-700 border-navy-500">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base text-foreground">
                    Amenities & Features
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {amenities.map((a) => (
                      <span
                        key={a}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-navy-800 border border-navy-500 text-foreground"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-gold-400" />
                        {a}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Verification */}
            {(property.verifiedAt || property.verificationTransactionHash) && (
              <Card className="bg-navy-700 border-navy-500">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base text-foreground flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-400" />
                    Verification Certificate
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {property.verifiedAt && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Verified On</span>
                      <span className="text-foreground font-medium">
                        {new Date(property.verifiedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {property.verificationTransactionHash && (
                    <div className="flex justify-between items-center text-sm gap-2">
                      <span className="text-muted-foreground flex-shrink-0">
                        Tx Hash
                      </span>
                      <div className="flex items-center gap-2 min-w-0">
                        <code className="text-xs text-gold-400 truncate">
                          {property.verificationTransactionHash.slice(0, 18)}…
                        </code>
                        <button
                          onClick={() =>
                            copy(property.verificationTransactionHash)
                          }
                          className="flex-shrink-0 hover:text-gold-400 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                    <CheckCircle className="w-3.5 h-3.5" />
                    This property has been verified and approved by a licensed
                    RWAChain verifier.
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── RIGHT COLUMN ─────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Investment Panel */}
            <div className="sticky top-6 space-y-5">
              <Card className="bg-navy-700 border border-gold-500/20">
                <CardHeader className="pb-4 border-b border-navy-500">
                  <CardTitle className="text-base text-foreground">
                    Investment Details
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Fractional property ownership via blockchain tokens
                  </p>
                </CardHeader>
                <CardContent className="space-y-5 pt-4">
                  {/* Token price */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Token Price
                    </span>
                    <span className="text-lg font-bold text-gold-400">
                      {tokenPrice > 0 ? `$${tokenPrice.toFixed(4)}` : "TBD"}
                    </span>
                  </div>

                  {/* Total supply */}
                  {supply > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Total Supply
                      </span>
                      <span className="text-foreground font-semibold">
                        {fmt(supply)} tokens
                      </span>
                    </div>
                  )}

                  {/* Annual ROI */}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Projected Annual ROI
                    </span>
                    <span className="text-green-400 font-semibold flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {roi.toFixed(2)}%
                    </span>
                  </div>

                  {/* Listing price */}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Property Value
                    </span>
                    <span className="text-foreground font-semibold">
                      {fmtUSD(listingPrice)}
                    </span>
                  </div>

                  {/* NFT Token ID */}
                  {property.nftTokenId && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        NFT Token ID
                      </span>
                      <span className="text-gold-400 font-semibold">
                        #{property.nftTokenId}
                      </span>
                    </div>
                  )}

                  {/* Contract address */}
                  {property.fractionalTokenAddress && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">
                        Token Contract
                      </p>
                      <div className="flex items-center gap-2 p-2 bg-navy-800 rounded-lg">
                        <code className="text-xs text-foreground flex-1 truncate">
                          {property.fractionalTokenAddress}
                        </code>
                        <button
                          onClick={() => copy(property.fractionalTokenAddress)}
                          className="flex-shrink-0"
                        >
                          <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-gold-400 transition-colors" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Funding Progress */}
                  {supply > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {remaining > 0
                            ? `${fmt(remaining)} tokens available`
                            : "Fully Funded"}
                        </span>
                        <span className="font-bold text-gold-400">
                          {fundPct.toFixed(1)}% funded
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-navy-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-400 transition-all duration-700"
                          style={{ width: `${fundPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Min investment note */}
                  <p className="text-xs text-muted-foreground text-center">
                    Minimum investment:{" "}
                    <span className="text-foreground font-medium">$500</span> ·
                    KYC required
                  </p>

                  {/* CTA */}
                  {property.status === "tokenized" ||
                  property.status === "active" ? (
                    <Button
                      onClick={() => setIsInvestmentModalOpen(true)}
                      className="w-full py-5 text-sm font-bold text-navy-900"
                      style={{
                        background:
                          "linear-gradient(135deg,#D4AF37 0%,#8C7020 100%)",
                      }}
                    >
                      Invest in This Property
                      <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                    </Button>
                  ) : (
                    <div className="text-center py-3 px-4 bg-navy-800 rounded-lg text-xs text-muted-foreground">
                      This property is not yet available for investment. Check
                      back after tokenization.
                    </div>
                  )}

                  {/* Secondary market link */}
                  {property.nftTokenId && (
                    <Link to={`/trading/${property.id}`} className="block">
                      <Button
                        variant="outline"
                        className="w-full border-navy-400 text-foreground hover:bg-navy-600 text-sm gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Trade on Secondary Market
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <InvestmentModal
        isOpen={isInvestmentModalOpen}
        onClose={() => setIsInvestmentModalOpen(false)}
        property={property}
      />
    </div>
  );
}
