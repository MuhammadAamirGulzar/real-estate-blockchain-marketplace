import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { CURRENCY_CONFIG } from "./CurrencySelector";

/**
 * Multi-Currency Price Display Component
 * Shows property price in all supported currencies
 */

const CURRENCY_GROUPS = {
  fiat: ["USD", "PKR", "AED", "EUR", "GBP"],
  crypto: ["ETH", "USDC", "USDT"],
};

const PriceCard = ({ currency, amount, config, trending }) => {
  const TrendIcon =
    trending > 0 ? TrendingUp : trending < 0 ? TrendingDown : null;

  return (
    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{config.flag || config.icon}</span>
        <div>
          <div className="font-semibold">{currency}</div>
          <div className="text-xs text-muted-foreground">{config.name}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-bold text-lg">
          {config.symbol}
          {amount
            ? new Intl.NumberFormat(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: config.type === "crypto" ? 6 : 2,
              }).format(amount)
            : "--"}
        </div>
        {TrendIcon && (
          <div
            className={`flex items-center gap-1 text-xs ${
              trending > 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            <TrendIcon className="w-3 h-3" />
            <span>{Math.abs(trending).toFixed(2)}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

const MultiCurrencyPriceDisplay = ({
  propertyId,
  basePrice,
  baseCurrency = "USD",
  showTrending = false,
  autoRefresh = false,
  refreshInterval = 300000, // 5 minutes
  className = "",
}) => {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeTab, setActiveTab] = useState("fiat");

  const fetchMultiCurrencyPrices = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/oracle/multi-currency/${propertyId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch prices");
      }

      setPrices(data.prices);
      setLastUpdate(new Date(data.lastUpdated));
    } catch (error) {
      console.error("Error fetching multi-currency prices:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (propertyId) {
      fetchMultiCurrencyPrices();

      if (autoRefresh) {
        const interval = setInterval(fetchMultiCurrencyPrices, refreshInterval);
        return () => clearInterval(interval);
      }
    }
  }, [propertyId, autoRefresh, refreshInterval]);

  if (loading && !prices.USD) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Property Price
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Property Price
            </CardTitle>
            <div className="flex items-center gap-2">
              {lastUpdate && (
                <span className="text-xs text-muted-foreground">
                  Updated: {lastUpdate.toLocaleTimeString()}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchMultiCurrencyPrices}
                disabled={loading}
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              {error}
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="fiat">Fiat Currencies</TabsTrigger>
                <TabsTrigger value="crypto">Cryptocurrencies</TabsTrigger>
              </TabsList>

              <TabsContent value="fiat" className="space-y-3 mt-4">
                {CURRENCY_GROUPS.fiat.map((currency) => (
                  <PriceCard
                    key={currency}
                    currency={currency}
                    amount={prices[currency]?.amount}
                    config={CURRENCY_CONFIG[currency]}
                    trending={showTrending ? Math.random() * 10 - 5 : null}
                  />
                ))}
              </TabsContent>

              <TabsContent value="crypto" className="space-y-3 mt-4">
                {CURRENCY_GROUPS.crypto.map((currency) => (
                  <PriceCard
                    key={currency}
                    currency={currency}
                    amount={prices[currency]?.amount}
                    config={CURRENCY_CONFIG[currency]}
                    trending={showTrending ? Math.random() * 10 - 5 : null}
                  />
                ))}
              </TabsContent>
            </Tabs>
          )}

          {/* Base Price Display */}
          {basePrice && baseCurrency && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Base Price</span>
                <Badge variant="secondary">
                  {CURRENCY_CONFIG[baseCurrency]?.symbol}
                  {new Intl.NumberFormat(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(basePrice)}{" "}
                  {baseCurrency}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MultiCurrencyPriceDisplay;
