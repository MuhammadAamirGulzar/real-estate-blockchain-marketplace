import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { CURRENCY_CONFIG } from "./CurrencySelector";

/**
 * Currency Converter Component
 * Real-time conversion display between currencies
 */

const CurrencyConverter = ({
  fromCurrency = "USD",
  toCurrency = "PKR",
  amount = 1000,
  onAmountChange,
  onFromCurrencyChange,
  onToCurrencyChange,
  showSwap = true,
  className = "",
}) => {
  const [convertedAmount, setConvertedAmount] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchExchangeRate = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/oracle/currency-rate/${fromCurrency}/${toCurrency}?amount=${amount}`,
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch exchange rate");
      }

      setExchangeRate(data.rate);
      setConvertedAmount(data.convertedAmount);
      setLastUpdate(new Date(data.timestamp));
    } catch (error) {
      console.error("Currency conversion error:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fromCurrency && toCurrency && amount > 0) {
      fetchExchangeRate();
    }
  }, [fromCurrency, toCurrency, amount]);

  const handleSwapCurrencies = () => {
    if (onFromCurrencyChange && onToCurrencyChange) {
      onFromCurrencyChange(toCurrency);
      onToCurrencyChange(fromCurrency);
    }
  };

  const formatCurrency = (value, currency) => {
    if (value === null || value === undefined) return "--";

    const config = CURRENCY_CONFIG[currency];
    if (!config) return value.toLocaleString();

    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: config.type === "crypto" ? 6 : 2,
    }).format(value);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Currency Converter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* From Currency */}
          <div className="space-y-2">
            <Label htmlFor="from-amount">From</Label>
            <div className="flex items-center gap-2">
              <Input
                id="from-amount"
                type="number"
                value={amount}
                onChange={(e) => onAmountChange?.(parseFloat(e.target.value))}
                min="0"
                step="0.01"
                className="flex-1"
              />
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md min-w-[100px]">
                <span className="text-lg">
                  {CURRENCY_CONFIG[fromCurrency]?.flag ||
                    CURRENCY_CONFIG[fromCurrency]?.icon}
                </span>
                <span className="font-semibold">{fromCurrency}</span>
              </div>
            </div>
          </div>

          {/* Swap Button */}
          {showSwap && onFromCurrencyChange && onToCurrencyChange && (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSwapCurrencies}
                className="rounded-full"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* To Currency */}
          <div className="space-y-2">
            <Label htmlFor="to-amount">To</Label>
            <div className="flex items-center gap-2">
              <Input
                id="to-amount"
                type="text"
                value={
                  convertedAmount
                    ? formatCurrency(convertedAmount, toCurrency)
                    : ""
                }
                readOnly
                className="flex-1 bg-muted"
                placeholder={loading ? "Converting..." : "--"}
              />
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md min-w-[100px]">
                <span className="text-lg">
                  {CURRENCY_CONFIG[toCurrency]?.flag ||
                    CURRENCY_CONFIG[toCurrency]?.icon}
                </span>
                <span className="font-semibold">{toCurrency}</span>
              </div>
            </div>
          </div>

          {/* Exchange Rate Display */}
          {exchangeRate && !error && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>Exchange Rate</span>
                  {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                </div>
                <div className="font-semibold">
                  1 {fromCurrency} = {formatCurrency(exchangeRate, toCurrency)}{" "}
                  {toCurrency}
                </div>
              </div>
              {lastUpdate && (
                <div className="text-xs text-muted-foreground mt-1">
                  Updated: {lastUpdate.toLocaleTimeString()}
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Conversion Summary */}
          {convertedAmount && !error && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium">
                {CURRENCY_CONFIG[fromCurrency]?.symbol}
                {formatCurrency(amount, fromCurrency)}
              </span>
              <ArrowRight className="w-4 h-4" />
              <span className="font-medium">
                {CURRENCY_CONFIG[toCurrency]?.symbol}
                {formatCurrency(convertedAmount, toCurrency)}
              </span>
            </div>
          )}

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchExchangeRate}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Rate
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CurrencyConverter;
