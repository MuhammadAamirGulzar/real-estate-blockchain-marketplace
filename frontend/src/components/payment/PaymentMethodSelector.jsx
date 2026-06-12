import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Building2, Clock, Wallet, Zap } from "lucide-react";

/**
 * Payment Method Selector Component
 * Allows users to choose between crypto payment and bank transfer
 */

const PAYMENT_METHODS = [
  {
    id: "crypto",
    name: "Cryptocurrency",
    description: "Instant payment with crypto wallets",
    icon: Wallet,
    features: [
      { icon: Zap, text: "Instant settlement" },
      { icon: Wallet, text: "ETH, USDC, USDT, RWAP" },
    ],
    recommended: true,
  },
  {
    id: "bank_transfer",
    name: "Bank Transfer",
    description: "Pay via bank transfer with proof upload",
    icon: Building2,
    features: [
      { icon: Clock, text: "1-3 days verification" },
      { icon: Building2, text: "USD, PKR, AED, EUR, GBP" },
    ],
    recommended: false,
  },
];

const PaymentMethodSelector = ({
  value,
  onChange,
  disabled = false,
  className = "",
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      <Label className="text-base font-semibold">Payment Method</Label>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {PAYMENT_METHODS.map((method) => {
          const Icon = method.icon;
          const isSelected = value === method.id;

          return (
            <Card
              key={method.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected
                  ? "border-primary ring-2 ring-primary ring-offset-2"
                  : "border-muted hover:border-primary/50"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => !disabled && onChange(method.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <RadioGroupItem value={method.id} id={method.id} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-5 h-5 text-primary" />
                      <Label
                        htmlFor={method.id}
                        className="text-base font-semibold cursor-pointer"
                      >
                        {method.name}
                      </Label>
                      {method.recommended && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {method.description}
                    </p>
                    <div className="space-y-2">
                      {method.features.map((feature, idx) => {
                        const FeatureIcon = feature.icon;
                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-xs text-muted-foreground"
                          >
                            <FeatureIcon className="w-4 h-4" />
                            <span>{feature.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </RadioGroup>
    </div>
  );
};

export default PaymentMethodSelector;
export { PAYMENT_METHODS };
