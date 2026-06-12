import Header from "@/components/layout/Header";
import RevenueClaimCard from "@/components/revenue/RevenueClaimCard";
import RevenueHistory from "@/components/revenue/RevenueHistory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInvestments } from "@/hooks/useInvestment";
import { useBatchClaimRevenue, useClaimableRevenue } from "@/hooks/useRevenue";
import {
  ArrowLeft,
  Building2,
  Coins,
  DollarSign,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PortfolioPage() {
  const navigate = useNavigate();
  const { investments, loading, error } = useInvestments();
  const { data: revenueData, isLoading: revenueLoading } =
    useClaimableRevenue();
  const { mutate: batchClaim, isPending: batchClaiming } =
    useBatchClaimRevenue();

  const claimableProperties = revenueData?.properties || [];
  const totalClaimableEth = parseFloat(revenueData?.totalClaimable || "0");

  const handleClaimAll = () => {
    const claimable = claimableProperties.filter(
      (p) => parseFloat(p.claimableEth || 0) > 0,
    );
    if (claimable.length === 0) return;
    batchClaim({
      assetIds: claimable.map((p) => p.assetId),
      properties: claimable,
    });
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/user/dashboard");
  };

  const getExpectedGrowthMultiplier = (investment) => {
    const roiRaw =
      investment?.property?.projectedRoi ??
      investment?.property?.expectedReturn ??
      investment?.expectedAnnualReturn ??
      0;

    const roi = parseFloat(roiRaw);
    if (!Number.isFinite(roi) || roi <= 0) {
      return 1;
    }

    return 1 + roi / 100;
  };

  // Calculate portfolio statistics from real investments
  const totalInvested = investments.reduce(
    (sum, inv) => sum + parseFloat(inv.fiatAmount || 0),
    0,
  );
  const totalValue = investments.reduce(
    (sum, inv) =>
      sum + parseFloat(inv.fiatAmount || 0) * getExpectedGrowthMultiplier(inv),
    0,
  );
  const totalReturn =
    totalInvested > 0
      ? (((totalValue - totalInvested) / totalInvested) * 100).toFixed(1)
      : "0.0";

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container-max py-8">
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container-max py-8">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
            <p className="font-medium text-destructive">Failed to load portfolio</p>
            <p className="mt-2 text-sm text-destructive/90">{error}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container-max py-8 space-y-8 animate-fade-in theme-transition">
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={handleBack}
            className="mb-4 inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            My Portfolio
          </h1>
          <p className="text-muted-foreground">
            Track your real estate investments and performance
          </p>
        </div>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Invested
                  </p>
                  <p className="text-2xl font-bold">
                    ${totalInvested.toLocaleString()}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Current Value</p>
                  <p className="text-2xl font-bold">
                    ${totalValue.toLocaleString()}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Return</p>
                  <p className="text-2xl font-bold text-green-600">
                    +{totalReturn}%
                  </p>
                </div>
                <Building2 className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Claimable Revenue
                  </p>
                  <p className="text-2xl font-bold text-amber-600">
                    {revenueLoading ? "—" : totalClaimableEth.toFixed(6)}
                    <span className="text-base font-normal text-muted-foreground ml-1">
                      ETH
                    </span>
                  </p>
                </div>
                <Coins className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Investments List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Investments</CardTitle>
          </CardHeader>
          <CardContent>
            {investments.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No investments yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Browse the marketplace to start investing
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {investments.map((investment) => {
                  const investedAmount = parseFloat(investment.fiatAmount || 0);
                  const currentValue =
                    investedAmount * getExpectedGrowthMultiplier(investment);
                  const returnPercent = (
                    ((currentValue - investedAmount) / (investedAmount || 1)) *
                    100
                  ).toFixed(1);
                  const tokens = parseFloat(
                    investment.fractionalTokensReceived || 0,
                  );

                  return (
                    <div key={investment.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">
                            Property #{investment.propertyId}
                          </h3>
                          <p className="text-muted-foreground">
                            {investment.paymentCurrency || "USD"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {tokens.toFixed(2)} tokens
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Status: {investment.paymentStatus}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge
                            className={
                              returnPercent > 0
                                ? "bg-green-500 text-white"
                                : "bg-muted text-foreground"
                            }
                          >
                            {returnPercent > 0 ? "+" : ""}
                            {returnPercent}%
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Invested
                          </p>
                          <p className="font-semibold">
                            {investment.paymentCurrency}{" "}
                            {investedAmount.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Current Value
                          </p>
                          <p className="font-semibold">
                            {investment.paymentCurrency}{" "}
                            {currentValue.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Revenue Claiming Section ───────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-500" />
                Revenue Distributions
              </CardTitle>
              {claimableProperties.some(
                (p) => parseFloat(p.claimableEth || 0) > 0,
              ) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClaimAll}
                  disabled={batchClaiming}
                  className="gap-2"
                >
                  {batchClaiming ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Coins className="h-3.5 w-3.5" />
                  )}
                  Claim All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading revenue data…
                </span>
              </div>
            ) : claimableProperties.length === 0 ? (
              <div className="text-center py-8">
                <Coins className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No revenue distributions yet
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Revenue is distributed periodically by the property admin
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {claimableProperties.map((prop) => (
                  <RevenueClaimCard
                    key={prop.propertyId}
                    propertyId={prop.propertyId}
                    assetId={prop.assetId}
                    propertyTitle={prop.propertyTitle}
                    propertyLocation={prop.location}
                    claimableEth={prop.claimableEth}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Revenue Claim History ─────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Claim History</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueHistory />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
