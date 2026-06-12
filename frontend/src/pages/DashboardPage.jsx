import {
  Activity,
  AlertCircle,
  Building2,
  DollarSign,
  Plus,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import WalletConnectionCard from "@/components/wallet/WalletConnectionCard";
import { useAuth } from "@/contexts/AuthContext";
import { useInvestments } from "@/hooks/useInvestment";
import { useClaimableRevenue } from "@/hooks/useRevenue";

export default function DashboardPage() {
  const { user } = useAuth();
  const { investments, loading, error } = useInvestments();
  const { data: revenueData, isLoading: revenueLoading } =
    useClaimableRevenue();

  const toNumber = (value) => {
    const parsed = parseFloat(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
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

  const totalInvested = useMemo(
    () => investments.reduce((sum, inv) => sum + toNumber(inv.fiatAmount), 0),
    [investments],
  );

  const totalValue = useMemo(
    () =>
      investments.reduce(
        (sum, inv) =>
          sum + toNumber(inv.fiatAmount) * getExpectedGrowthMultiplier(inv),
        0,
      ),
    [investments],
  );

  const totalReturns = totalValue - totalInvested;
  const returnPercentage =
    totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;

  const activeProperties = useMemo(
    () => new Set(investments.map((inv) => inv.propertyId)).size,
    [investments],
  );

  const claimableEth = toNumber(revenueData?.totalClaimable || 0);

  const recentInvestments = useMemo(
    () => investments.slice(0, 5),
    [investments],
  );

  const allocationByType = useMemo(() => {
    const totals = new Map();

    for (const inv of investments) {
      const type = inv?.property?.propertyType || "uncategorized";
      const amount = toNumber(inv.fiatAmount);
      totals.set(type, (totals.get(type) || 0) + amount);
    }

    const rows = Array.from(totals.entries()).map(([type, value]) => ({
      type,
      value,
      percentage: totalInvested > 0 ? (value / totalInvested) * 100 : 0,
    }));

    return rows.sort((a, b) => b.value - a.value);
  }, [investments, totalInvested]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background theme-transition">
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-lg font-medium text-muted-foreground">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background theme-transition p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="border-destructive/30 bg-destructive/10">
            <CardContent className="p-6 text-center">
              <p className="font-medium text-destructive">
                Failed to load dashboard data
              </p>
              <p className="text-sm text-destructive/90 mt-2">{error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const stats = [
    {
      title: "Total Portfolio Value",
      value: `$${totalValue.toLocaleString()}`,
      change: `${investments.length} investment${investments.length === 1 ? "" : "s"}`,
      icon: Wallet,
      color: "bg-primary",
      bgColor: "bg-primary/10",
      textColor: "text-primary"
    },
    {
      title: "Total Invested",
      value: `$${totalInvested.toLocaleString()}`,
      change: "Backed by portfolio records",
      icon: DollarSign,
      color: "bg-green-500",
      bgColor: "bg-green-50 dark:bg-green-900/20",
      textColor: "text-green-600 dark:text-green-400"
    },
    {
      title: "Net Return",
      value: `${totalReturns >= 0 ? "+" : "-"}$${Math.abs(totalReturns).toLocaleString()}`,
      change: `${returnPercentage >= 0 ? "+" : ""}${returnPercentage.toFixed(1)}%`,
      icon: TrendingUp,
      color: "bg-amber-500",
      bgColor: "bg-amber-50 dark:bg-amber-900/20",
      textColor:
        totalReturns >= 0
          ? "text-amber-600 dark:text-amber-400"
          : "text-destructive"
    },
    {
      title: "Claimable Revenue",
      value: revenueLoading ? "—" : `${claimableEth.toFixed(6)} ETH`,
      change: `${activeProperties} active propert${activeProperties === 1 ? "y" : "ies"}`,
      icon: Activity,
      color: "bg-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-900/20",
      textColor: "text-orange-600 dark:text-orange-400"
    },
  ];

  return (
    <div className="p-4 sm:p-6 bg-background min-h-screen theme-transition">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Welcome back, {user?.firstName}! 👋
              </h1>
              <p className="text-muted-foreground">
                Here's what's happening with your real estate investments today.
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex items-center space-x-3">
              <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-600 dark:text-green-400 font-medium">Live</span>
              </div>
              <Button size="sm" className="bg-gradient-primary text-primary-foreground hover:opacity-95">
                <Plus className="w-4 h-4 mr-2" />
                Invest Now
              </Button>
            </div>
          </div>
        </div>

        {/* KYC Status Banner */}
        {user?.kycStatus !== 'approved' && (
          <div className="mb-6">
            <Card className="border-0 shadow-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">KYC Verification Required</h3>
                      <p className="text-sm text-orange-100">Complete your verification to access all features</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" asChild className="bg-white text-orange-600 hover:bg-orange-50 w-full sm:w-auto">
                    <Link to="/kyc">Verify Now</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Wallet Connection Card */}
        <div className="mb-8">
          <WalletConnectionCard />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="relative overflow-hidden border border-border shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 theme-transition">
                <div className={`absolute inset-0 ${stat.bgColor}`}></div>
                <CardContent className="relative p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center shadow-lg`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <Badge variant="secondary" className="bg-card/90 text-muted-foreground border-0">
                      {stat.change}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      {stat.title}
                    </p>
                    <p className={`text-2xl font-bold ${stat.textColor}`}>
                      {stat.value}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Portfolio Performance */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-semibold text-foreground">
                    Portfolio Performance
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-primary rounded-full"></div>
                      <span className="text-sm text-muted-foreground">Value</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                      <span className="text-sm text-muted-foreground">Returns</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gradient-to-r from-primary/10 to-amber-500/10 rounded-xl flex items-center justify-center theme-transition">
                  <div className="text-center">
                    <TrendingUp className="w-12 h-12 text-primary mx-auto mb-3" />
                    <p className="text-muted-foreground">Interactive chart coming soon</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-primary to-gold-700 text-primary-foreground">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Zap className="w-8 h-8" />
                  <Badge className="bg-white/20 text-white border-0">New</Badge>
                </div>
                <h3 className="text-lg font-semibold mb-2">Quick Invest</h3>
                <p className="text-primary-foreground/85 text-sm mb-4">
                  Discover trending properties with high returns
                </p>
                <Button variant="secondary" size="sm" className="w-full bg-white text-primary hover:bg-amber-50">
                  Explore Now
                </Button>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-foreground">
                  Asset Allocation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {allocationByType.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No allocation data yet
                    </p>
                  ) : (
                    allocationByType.map((allocation) => (
                      <div
                        key={allocation.type}
                        className="space-y-3"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground capitalize">
                            {allocation.type.replace(/[_-]/g, " ")}
                          </span>
                          <span className="font-medium text-foreground">
                            {allocation.percentage.toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={allocation.percentage} className="h-2" />
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Investments */}
        <div className="mt-8">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold text-foreground">
                  Recent Investments
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/portfolio" className="text-primary hover:text-primary/80">
                    View All
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentInvestments.length === 0 ? (
                  <div className="rounded-xl bg-muted/50 p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      No investments yet
                    </p>
                  </div>
                ) : (
                  recentInvestments.map((investment) => {
                    const investedAmount = toNumber(investment.fiatAmount);
                    const currentValue =
                      investedAmount * getExpectedGrowthMultiplier(investment);
                    const changePercent =
                      investedAmount > 0
                        ? ((currentValue - investedAmount) / investedAmount) * 100
                        : 0;
                    const tokenCount = toNumber(
                      investment.fractionalTokensReceived,
                    );

                    return (
                      <div
                        key={investment.id}
                        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-primary to-gold-700 rounded-xl flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">
                              {investment?.property?.title ||
                                `Property #${investment.propertyId}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(investment.investedAt).toLocaleDateString()} • {tokenCount.toFixed(2)} tokens
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-foreground">
                            {investment.paymentCurrency || "USD"} {investedAmount.toLocaleString()}
                          </p>
                          <p
                            className={`text-sm ${
                              changePercent >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-destructive"
                            }`}
                          >
                            {changePercent >= 0 ? "+" : ""}
                            {changePercent.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Footer */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-primary/15 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Explore Properties</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Discover new investment opportunities
              </p>
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link to="/marketplace">Browse Marketplace</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">View Portfolio</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Manage your investments and track performance
              </p>
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link to="/portfolio">Go to Portfolio</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Activity className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Complete KYC</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Verify your identity to unlock all features
              </p>
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link to="/kyc">Start Verification</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}