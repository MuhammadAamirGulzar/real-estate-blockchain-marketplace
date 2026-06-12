import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClaimRevenue } from "@/hooks/useRevenue";
import { Building2, Coins, Loader2 } from "lucide-react";

/**
 * Per-property revenue claim card shown on investor Portfolio page.
 *
 * Props:
 *   propertyId    - DB property id
 *   assetId       - on-chain assetId (assetRegistryId)
 *   propertyTitle - display name
 *   propertyLocation - display location
 *   claimableEth  - string, amount in ETH investor can claim
 */
const RevenueClaimCard = ({
  propertyId,
  assetId,
  propertyTitle,
  propertyLocation,
  claimableEth,
}) => {
  const { mutate: claimRevenue, isPending } = useClaimRevenue();

  const claimable = parseFloat(claimableEth || "0");
  const hasRevenue = claimable > 0;

  const handleClaim = () => {
    claimRevenue({ propertyId, assetId, propertyTitle });
  };

  return (
    <Card className="border border-border/50 hover:border-primary/30 transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold truncate">
                {propertyTitle}
              </CardTitle>
              {propertyLocation && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {propertyLocation}
                </p>
              )}
            </div>
          </div>
          <Badge
            variant={hasRevenue ? "default" : "secondary"}
            className="shrink-0 text-xs"
          >
            {hasRevenue ? "Claimable" : "No Revenue"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Claimable Revenue
            </p>
            <div className="flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-amber-500" />
              <span className="text-lg font-bold">{claimable.toFixed(6)}</span>
              <span className="text-sm text-muted-foreground">ETH</span>
            </div>
          </div>

          <Button
            size="sm"
            onClick={handleClaim}
            disabled={!hasRevenue || isPending}
            className="ml-4"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Claiming…
              </>
            ) : (
              "Claim"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RevenueClaimCard;
