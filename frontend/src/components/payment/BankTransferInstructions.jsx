import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Building2, Check, Clock, Copy, Hash } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Bank Transfer Instructions Component
 * Displays bank account details and payment reference for fiat payments
 */

const BankTransferInstructions = ({
  investmentId,
  paymentReference,
  currency,
  amount,
  bankInstructions,
  expiresAt,
  onUploadProof,
  className = "",
}) => {
  const [copied, setCopied] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(null);

  useEffect(() => {
    if (expiresAt) {
      const updateTimer = () => {
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diff = expiry - now;

        if (diff <= 0) {
          setTimeRemaining("Expired");
        } else {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor(
            (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
          );
          setTimeRemaining(`${days}d ${hours}h remaining`);
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 60000); // Update every minute

      return () => clearInterval(interval);
    }
  }, [expiresAt]);

  const copyToClipboard = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied((prev) => ({ ...prev, [field]: true }));
      setTimeout(() => {
        setCopied((prev) => ({ ...prev, [field]: false }));
      }, 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const CopyButton = ({ text, field }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => copyToClipboard(text, field)}
      className="ml-2"
    >
      {copied[field] ? (
        <Check className="w-4 h-4 text-green-600" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </Button>
  );

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Bank Transfer Instructions
            </CardTitle>
            {timeRemaining && (
              <Badge
                variant={
                  timeRemaining === "Expired" ? "destructive" : "secondary"
                }
              >
                <Clock className="w-3 h-3 mr-1" />
                {timeRemaining}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Important Notice */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> You must include the payment reference
              in your bank transfer. Without it, we cannot verify your payment.
            </AlertDescription>
          </Alert>

          {/* Payment Reference */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Payment Reference (Required)
              </span>
              <CopyButton text={paymentReference} field="reference" />
            </div>
            <div className="font-mono text-lg font-bold text-primary break-all">
              {paymentReference}
            </div>
          </div>

          <Separator />

          {/* Amount */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">
              Amount to Send
            </div>
            <div className="text-2xl font-bold">
              {currency === "USD" && "$"}
              {currency === "PKR" && "₨"}
              {currency === "AED" && "د.إ"}
              {currency === "EUR" && "€"}
              {currency === "GBP" && "£"}
              {parseFloat(amount).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              <span className="text-base ml-2 text-muted-foreground">
                {currency}
              </span>
            </div>
          </div>

          <Separator />

          {/* Bank Details */}
          {bankInstructions && (
            <div className="space-y-3">
              <div className="font-semibold text-base">
                Bank Account Details
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Bank Name
                  </div>
                  <div className="font-medium flex items-center justify-between">
                    {bankInstructions.bankName}
                    <CopyButton
                      text={bankInstructions.bankName}
                      field="bankName"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Account Name
                  </div>
                  <div className="font-medium flex items-center justify-between">
                    {bankInstructions.accountName}
                    <CopyButton
                      text={bankInstructions.accountName}
                      field="accountName"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Account Number
                  </div>
                  <div className="font-mono text-sm font-medium flex items-center justify-between">
                    {bankInstructions.accountNumber}
                    <CopyButton
                      text={bankInstructions.accountNumber}
                      field="accountNumber"
                    />
                  </div>
                </div>

                {bankInstructions.swiftCode && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      SWIFT/BIC Code
                    </div>
                    <div className="font-mono text-sm font-medium flex items-center justify-between">
                      {bankInstructions.swiftCode}
                      <CopyButton
                        text={bankInstructions.swiftCode}
                        field="swiftCode"
                      />
                    </div>
                  </div>
                )}

                {bankInstructions.iban && (
                  <div className="md:col-span-2">
                    <div className="text-xs text-muted-foreground mb-1">
                      IBAN
                    </div>
                    <div className="font-mono text-sm font-medium flex items-center justify-between">
                      {bankInstructions.iban}
                      <CopyButton text={bankInstructions.iban} field="iban" />
                    </div>
                  </div>
                )}

                {bankInstructions.routingNumber && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Routing Number
                    </div>
                    <div className="font-mono text-sm font-medium flex items-center justify-between">
                      {bankInstructions.routingNumber}
                      <CopyButton
                        text={bankInstructions.routingNumber}
                        field="routingNumber"
                      />
                    </div>
                  </div>
                )}
              </div>

              {bankInstructions.additionalInfo && (
                <Alert>
                  <AlertDescription className="text-sm">
                    {bankInstructions.additionalInfo}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <Separator />

          {/* Next Steps */}
          <div className="space-y-2">
            <div className="font-semibold text-sm">Next Steps:</div>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Transfer the exact amount to the bank account above</li>
              <li>
                Include the payment reference{" "}
                <strong>{paymentReference}</strong> in the transfer description
              </li>
              <li>Upload your payment proof (bank receipt/screenshot)</li>
              <li>Wait for admin verification (typically 1-3 business days)</li>
            </ol>
          </div>

          {/* Upload Proof Button */}
          <Button
            onClick={onUploadProof}
            size="lg"
            className="w-full"
            disabled={timeRemaining === "Expired"}
          >
            Upload Payment Proof
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default BankTransferInstructions;
