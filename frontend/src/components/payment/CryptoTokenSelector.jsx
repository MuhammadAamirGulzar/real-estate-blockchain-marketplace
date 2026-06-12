import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Check, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useBalance } from "wagmi";

/**
 * Crypto Token Selector Component
 * Allows users to select payment token (RWAP, ETH, USDC, USDT) with wallet balance display
 */

const SUPPORTED_TOKENS = [
  {
    id: "ETH",
    name: "Ethereum",
    symbol: "ETH",
    icon: "⟠",
    description: "Native blockchain token",
    isNative: true,
    decimals: 18,
  },
  {
    id: "RWAP",
    name: "RWA Platform Token",
    symbol: "RWAP",
    icon: "🪙",
    description: "Platform native token",
    isNative: false,
    decimals: 18,
    address: process.env.VITE_RWAP_TOKEN_ADDRESS,
  },
  {
    id: "USDC",
    name: "USD Coin",
    symbol: "USDC",
    icon: "💵",
    description: "Stablecoin pegged to USD",
    isNative: false,
    decimals: 6,
    address: process.env.VITE_USDC_TOKEN_ADDRESS,
  },
  {
    id: "USDT",
    name: "Tether",
    symbol: "USDT",
    icon: "💲",
    description: "Stablecoin pegged to USD",
    isNative: false,
    decimals: 6,
    address: process.env.VITE_USDT_TOKEN_ADDRESS,
  },
];

const TokenCard = ({ token, selected, onSelect, balance, requiredAmount }) => {
  const hasEnoughBalance =
    balance !== null && requiredAmount
      ? parseFloat(balance) >= parseFloat(requiredAmount)
      : true;

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        selected
          ? "border-primary ring-2 ring-primary ring-offset-2"
          : "border-muted hover:border-primary/50"
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{token.icon}</span>
            <div>
              <div className="font-semibold text-base">{token.symbol}</div>
              <div className="text-xs text-muted-foreground">{token.name}</div>
            </div>
          </div>
          {selected && (
            <Check className="w-5 h-5 text-primary" strokeWidth={3} />
          )}
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          {token.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Wallet className="w-3 h-3" />
            <span>Balance:</span>
          </div>
          <div className="text-sm font-medium">
            {balance !== null ? (
              <span className={!hasEnoughBalance ? "text-destructive" : ""}>
                {parseFloat(balance).toFixed(4)} {token.symbol}
              </span>
            ) : (
              <span className="text-muted-foreground">Loading...</span>
            )}
          </div>
        </div>

        {!hasEnoughBalance && requiredAmount && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-3 w-3" />
            <AlertDescription className="text-xs">
              Insufficient balance. Need {requiredAmount} {token.symbol}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

const CryptoTokenSelector = ({
  value,
  onChange,
  requiredAmount = null,
  disabled = false,
  className = "",
}) => {
  const { address, isConnected } = useAccount();
  const [balances, setBalances] = useState({});

  // Fetch ETH balance
  const { data: ethBalance } = useBalance({
    address: address,
    enabled: isConnected,
  });

  useEffect(() => {
    if (ethBalance) {
      setBalances((prev) => ({
        ...prev,
        ETH: formatUnits(ethBalance.value, ethBalance.decimals),
      }));
    }
  }, [ethBalance]);

  // TODO: Fetch ERC-20 token balances (RWAP, USDC, USDT)
  // This would require token contract ABIs and useReadContract from wagmi

  if (!isConnected) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please connect your wallet to select a payment token.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <Label className="text-base font-semibold">Select Payment Token</Label>
      <Tabs value={value} onValueChange={onChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {SUPPORTED_TOKENS.map((token) => (
            <TabsTrigger key={token.id} value={token.id} disabled={disabled}>
              <span className="mr-1">{token.icon}</span>
              {token.symbol}
            </TabsTrigger>
          ))}
        </TabsList>

        {SUPPORTED_TOKENS.map((token) => (
          <TabsContent key={token.id} value={token.id} className="mt-4">
            <TokenCard
              token={token}
              selected={value === token.id}
              onSelect={() => onChange(token.id)}
              balance={balances[token.id] || null}
              requiredAmount={requiredAmount}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default CryptoTokenSelector;
export { SUPPORTED_TOKENS };
