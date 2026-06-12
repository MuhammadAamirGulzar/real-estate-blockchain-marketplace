import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";

/**
 * Currency Selector Component
 * Supports both fiat (USD, PKR, AED, EUR, GBP) and crypto (RWAP, ETH, USDC, USDT)
 */

const CURRENCY_CONFIG = {
  // Fiat currencies
  USD: { name: "US Dollar", symbol: "$", flag: "🇺🇸", type: "fiat" },
  PKR: { name: "Pakistani Rupee", symbol: "₨", flag: "🇵🇰", type: "fiat" },
  AED: { name: "UAE Dirham", symbol: "د.إ", flag: "🇦🇪", type: "fiat" },
  EUR: { name: "Euro", symbol: "€", flag: "🇪🇺", type: "fiat" },
  GBP: { name: "British Pound", symbol: "£", flag: "🇬🇧", type: "fiat" },

  // Crypto currencies
  RWAP: { name: "RWA Token", symbol: "RWAP", icon: "🪙", type: "crypto" },
  ETH: { name: "Ethereum", symbol: "ETH", icon: "⟠", type: "crypto" },
  USDC: { name: "USD Coin", symbol: "USDC", icon: "💵", type: "crypto" },
  USDT: { name: "Tether", symbol: "USDT", icon: "💲", type: "crypto" },
};

const CurrencySelector = ({
  value,
  onChange,
  type = "all", // 'all', 'fiat', 'crypto'
  disabled = false,
  label = "Select Currency",
  className = "",
}) => {
  const [currencies, setCurrencies] = useState([]);

  useEffect(() => {
    // Filter currencies based on type
    const filtered = Object.entries(CURRENCY_CONFIG).filter(([_, config]) => {
      if (type === "all") return true;
      return config.type === type;
    });

    setCurrencies(filtered);
  }, [type]);

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label htmlFor="currency-selector" className="text-sm font-medium">
          {label}
        </Label>
      )}
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        id="currency-selector"
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select currency">
            {value && (
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {CURRENCY_CONFIG[value]?.flag || CURRENCY_CONFIG[value]?.icon}
                </span>
                <span className="font-medium">{value}</span>
                <span className="text-muted-foreground text-sm">
                  {CURRENCY_CONFIG[value]?.name}
                </span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {currencies.map(([code, config]) => (
            <SelectItem key={code} value={code}>
              <div className="flex items-center gap-3 py-1">
                <span className="text-2xl">{config.flag || config.icon}</span>
                <div className="flex flex-col">
                  <span className="font-semibold">{code}</span>
                  <span className="text-xs text-muted-foreground">
                    {config.name}
                  </span>
                </div>
                <span className="ml-auto text-muted-foreground text-sm">
                  {config.symbol}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default CurrencySelector;
export { CURRENCY_CONFIG };
