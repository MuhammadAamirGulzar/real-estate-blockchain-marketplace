import InvestmentModal from "@/components/investment/InvestmentModal";
import { PropertyNFTCard } from "@/components/properties/PropertyNFTCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProperties } from "@/hooks/useProperties";
import {
  BarChart3,
  Building2,
  ChevronDown,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

const PROPERTY_TYPES = [
  { value: "", label: "All Types" },
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "villa", label: "Villa" },
  { value: "apartment", label: "Apartment" },
  { value: "townhouse", label: "Townhouse" },
  { value: "land", label: "Land" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "roi_high", label: "Highest ROI" },
  { value: "roi_low", label: "Lowest ROI" },
  { value: "price_high", label: "Highest Price" },
  { value: "price_low", label: "Lowest Price" },
];

const ROI_RANGES = [
  { value: "", label: "Any ROI" },
  { value: "0-8", label: "< 8%" },
  { value: "8-12", label: "8-12%" },
  { value: "12-16", label: "12-16%" },
  { value: "16-99", label: "> 16%" },
];

export default function MarketplacePage() {
  const { properties, loading } = useProperties("tokenized");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [roiRange, setRoiRange] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [investModalOpen, setInvestModalOpen] = useState(false);

  const stats = useMemo(() => {
    const tvl = properties.reduce((a, p) => a + Number(p.propertyValue || p.price || 0), 0);
    const avgRoi = properties.length
      ? properties.reduce((a, p) => a + Number(p.projectedRoi || p.expectedReturn || 0), 0) / properties.length
      : 0;
    return { count: properties.length, tvl, avgRoi };
  }, [properties]);

  const filtered = useMemo(() => {
    let list = [...properties];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.location?.toLowerCase().includes(q) ||
          p.city?.toLowerCase().includes(q)
      );
    }
    if (typeFilter) {
      list = list.filter((p) => p.propertyType?.toLowerCase().includes(typeFilter));
    }
    if (roiRange) {
      const [low, high] = roiRange.split("-").map(Number);
      list = list.filter((p) => {
        const r = Number(p.projectedRoi || p.expectedReturn || 0);
        return r >= low && r <= high;
      });
    }
    list.sort((a, b) => {
      const aRoi = Number(a.projectedRoi || a.expectedReturn || 0);
      const bRoi = Number(b.projectedRoi || b.expectedReturn || 0);
      const aPrice = Number(a.propertyValue || a.price || 0);
      const bPrice = Number(b.propertyValue || b.price || 0);
      const aDate = new Date(a.createdAt || 0).getTime();
      const bDate = new Date(b.createdAt || 0).getTime();
      switch (sortBy) {
        case "roi_high":   return bRoi - aRoi;
        case "roi_low":    return aRoi - bRoi;
        case "price_high": return bPrice - aPrice;
        case "price_low":  return aPrice - bPrice;
        default:           return bDate - aDate;
      }
    });
    return list;
  }, [properties, search, typeFilter, roiRange, sortBy]);

  const activeFilterCount = [typeFilter, roiRange].filter(Boolean).length;

  const handleInvest = (property) => {
    setSelectedProperty(property);
    setInvestModalOpen(true);
  };

  const formatTVL = (n) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${n.toLocaleString()}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="py-14 bg-navy-900">
          <div className="container-max space-y-3">
            <div className="h-6 w-32 rounded bg-navy-700 animate-pulse" />
            <div className="h-10 w-80 rounded bg-navy-700 animate-pulse" />
          </div>
        </div>
        <div className="container-max py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden bg-navy-700 border border-navy-500">
              <div className="aspect-[16/10] bg-navy-600 animate-pulse" />
              <div className="p-5 space-y-3">
                <div className="h-4 w-3/4 rounded bg-navy-600 animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-navy-600 animate-pulse" />
                <div className="h-2 rounded-full bg-navy-600 animate-pulse mt-4" />
                <div className="h-8 rounded bg-navy-600 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Banner */}
      <section className="relative py-14 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(212,175,55,0.08),transparent_60%)]" />
        <div className="container-max relative z-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-8 rounded-full bg-gradient-to-b from-gold-400 to-gold-600" />
                <span className="text-xs font-semibold uppercase tracking-widest text-gold-400">
                  Live Marketplace
                </span>
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
                Tokenized Property Marketplace
              </h1>
              <p className="text-muted-foreground max-w-xl">
                Invest in premium real estate assets represented as blockchain tokens.
                Buy, hold, and earn fractional rental income.
              </p>
            </div>
            <div className="flex gap-8 shrink-0">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{stats.count}</p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 justify-center">
                  <Building2 className="w-3 h-3" /> Properties
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gold-400">{formatTVL(stats.tvl)}</p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 justify-center">
                  <BarChart3 className="w-3 h-3" /> Total Value
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{stats.avgRoi.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 justify-center">
                  <TrendingUp className="w-3 h-3" /> Avg ROI
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filters Bar */}
      <div className="sticky top-0 z-20 bg-navy-900/95 backdrop-blur-md border-b border-navy-500">
        <div className="container-max py-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search properties..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-navy-700 border-navy-500 text-foreground placeholder:text-muted-foreground h-9 text-sm"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="appearance-none h-9 pl-3 pr-8 rounded-md bg-navy-700 border border-navy-500 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold-500 min-w-[130px]"
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={roiRange}
                onChange={(e) => setRoiRange(e.target.value)}
                className="appearance-none h-9 pl-3 pr-8 rounded-md bg-navy-700 border border-navy-500 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold-500 min-w-[120px]"
              >
                {ROI_RANGES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none h-9 pl-3 pr-8 rounded-md bg-navy-700 border border-navy-500 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold-500 min-w-[150px]"
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
            {activeFilterCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setTypeFilter(""); setRoiRange(""); }}
                className="text-muted-foreground hover:text-foreground h-9 gap-1 text-xs"
              >
                <X className="w-3.5 h-3.5" />
                Clear ({activeFilterCount})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Properties Grid */}
      <div className="container-max py-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-navy-700 flex items-center justify-center">
              <Building2 className="w-10 h-10 text-navy-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No properties found</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              No tokenized properties match your current filters.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSearch(""); setTypeFilter(""); setRoiRange(""); }}
              className="border-navy-400 text-foreground hover:bg-navy-700"
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              Showing <span className="text-foreground font-medium">{filtered.length}</span>{" "}
              {filtered.length === 1 ? "property" : "properties"}
              {search && ` matching "${search}"`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtered.map((property) => (
                <PropertyNFTCard
                  key={property.id}
                  property={property}
                  onInvest={handleInvest}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {investModalOpen && selectedProperty && (
        <InvestmentModal
          isOpen={investModalOpen}
          onClose={() => { setInvestModalOpen(false); setSelectedProperty(null); }}
          property={selectedProperty}
        />
      )}
    </div>
  );
}
