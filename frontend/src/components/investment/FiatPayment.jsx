import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import api from "@/services/api";
import { AlertCircle, CreditCard, Loader2, Lock } from "lucide-react";
import { useCallback, useState } from "react";

// Constants
const PROCESSING_FEE_RATE = 0.025; // 2.5%
const CARD_NUMBER_LENGTH = 13;
const CVV_MIN_LENGTH = 3;

/**
 * Payment Summary Card Component
 * Displays investment details and fee breakdown
 */
const PaymentSummaryCard = ({ property, amount, shares }) => {
  const processingFee = amount * PROCESSING_FEE_RATE;
  const totalAmount = amount + processingFee;
  const propertyLabel = property?.name || property?.title || "Property";

  return (
    <Card className="p-4 sm:p-5 border-border bg-card space-y-3">
      <h3 className="font-semibold text-foreground">Payment Summary</h3>
      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Property:</span>
          <span className="font-medium text-foreground">{propertyLabel}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Shares:</span>
          <span className="font-medium text-foreground">
            {parseFloat(shares).toLocaleString("en-US", {
              maximumFractionDigits: 6,
            })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Investment Amount:</span>
          <span className="font-medium text-foreground">
            ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Processing Fee (2.5%):</span>
          <span className="font-medium text-foreground">
            $
            {processingFee.toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
        <div className="border-t border-border pt-2.5 flex justify-between">
          <span className="font-semibold text-foreground">Total Amount:</span>
          <span className="text-lg font-bold text-primary">
            ${totalAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </Card>
  );
};

/**
 * Card Information Section Component
 * Handles credit card data input with formatting
 */
const CardInformationSection = ({ formData, onChange, isDisabled }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 mb-4">
      <CreditCard className="h-5 w-5 text-primary" />
      <h3 className="font-semibold text-foreground">Card Information</h3>
    </div>

    <div className="space-y-2">
      <Label
        htmlFor="cardNumber"
        className="text-sm font-medium text-foreground"
      >
        Card Number
      </Label>
      <Input
        id="cardNumber"
        name="cardNumber"
        placeholder="1234 5678 9012 3456"
        value={formData.cardNumber}
        onChange={onChange}
        disabled={isDisabled}
        className="border-border bg-input text-foreground placeholder:text-muted-foreground"
        required
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor="cardName" className="text-sm font-medium text-foreground">
        Cardholder Name
      </Label>
      <Input
        id="cardName"
        name="cardName"
        placeholder="John Doe"
        value={formData.cardName}
        onChange={onChange}
        disabled={isDisabled}
        className="border-border bg-input text-foreground placeholder:text-muted-foreground"
        required
      />
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label
          htmlFor="expiryDate"
          className="text-sm font-medium text-foreground"
        >
          Expiry Date
        </Label>
        <Input
          id="expiryDate"
          name="expiryDate"
          placeholder="MM/YY"
          value={formData.expiryDate}
          onChange={onChange}
          disabled={isDisabled}
          className="border-border bg-input text-foreground placeholder:text-muted-foreground"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cvv" className="text-sm font-medium text-foreground">
          CVV
        </Label>
        <Input
          id="cvv"
          name="cvv"
          type="password"
          placeholder="123"
          value={formData.cvv}
          onChange={onChange}
          disabled={isDisabled}
          className="border-border bg-input text-foreground placeholder:text-muted-foreground"
          required
        />
      </div>
    </div>
  </div>
);

/**
 * Billing Address Section Component
 * Handles billing address input
 */
const BillingAddressSection = ({ formData, onChange, isDisabled }) => (
  <div className="space-y-4">
    <h3 className="font-semibold text-foreground">Billing Address</h3>

    <div className="space-y-2">
      <Label
        htmlFor="billingAddress"
        className="text-sm font-medium text-foreground"
      >
        Street Address
      </Label>
      <Input
        id="billingAddress"
        name="billingAddress"
        placeholder="123 Main Street"
        value={formData.billingAddress}
        onChange={onChange}
        disabled={isDisabled}
        className="border-border bg-input text-foreground placeholder:text-muted-foreground"
        required
      />
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="city" className="text-sm font-medium text-foreground">
          City
        </Label>
        <Input
          id="city"
          name="city"
          placeholder="New York"
          value={formData.city}
          onChange={onChange}
          disabled={isDisabled}
          className="border-border bg-input text-foreground placeholder:text-muted-foreground"
          required
        />
      </div>
      <div className="space-y-2">
        <Label
          htmlFor="zipCode"
          className="text-sm font-medium text-foreground"
        >
          ZIP Code
        </Label>
        <Input
          id="zipCode"
          name="zipCode"
          placeholder="10001"
          value={formData.zipCode}
          onChange={onChange}
          disabled={isDisabled}
          className="border-border bg-input text-foreground placeholder:text-muted-foreground"
          required
        />
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="country" className="text-sm font-medium text-foreground">
        Country
      </Label>
      <Input
        id="country"
        name="country"
        placeholder="United States"
        value={formData.country}
        onChange={onChange}
        disabled={isDisabled}
        className="border-border bg-input text-foreground placeholder:text-muted-foreground"
        required
      />
    </div>
  </div>
);

/**
 * Security Badge Component
 * Displays encryption and security information
 */
const SecurityBadge = () => (
  <div className="flex items-center gap-3 p-3 sm:p-4 bg-secondary/5 border border-secondary/20 rounded-md">
    <Lock className="h-4 w-4 text-secondary flex-shrink-0" />
    <span className="text-sm text-foreground">
      Your payment is secured with 256-bit SSL encryption
    </span>
  </div>
);

/**
 * Error Alert Component
 * Displays error messages
 */
const ErrorAlert = ({ message }) => (
  <Alert className="border-destructive/30 bg-destructive/5">
    <AlertCircle className="h-4 w-4 text-destructive" />
    <AlertDescription className="text-destructive ml-2">
      {message}
    </AlertDescription>
  </Alert>
);

/**
 * Payment Provider Footer Component
 * Displays payment processor information
 */
const PaymentProviderFooter = () => (
  <div className="text-center text-xs text-muted-foreground space-y-1">
    <p>Payment processed securely by Stripe</p>
    <p>We do not store your card details</p>
  </div>
);

/**
 * FiatPayment Component
 * Handles credit card payment processing with form validation.
 * Includes card information, billing address, and security features.
 *
 * @param {Object} property - Property details (name)
 * @param {number} amount - Investment amount in USD
 * @param {number} shares - Number of shares to purchase
 * @param {Function} onSuccess - Callback with Stripe paymentIntentId
 * @param {Function} onBack - Callback for back navigation
 */
export function FiatPayment({ property, amount, shares, onSuccess, onBack }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    cardNumber: "",
    cardName: "",
    expiryDate: "",
    cvv: "",
    billingAddress: "",
    city: "",
    zipCode: "",
    country: "",
  });

  // Format input values (card number, expiry, CVV)
  const formatInputValue = useCallback((name, value) => {
    switch (name) {
      case "cardNumber":
        return value
          .replace(/\s/g, "")
          .replace(/(\d{4})/g, "$1 ")
          .trim()
          .substring(0, 19);

      case "expiryDate":
        return value
          .replace(/\D/g, "")
          .replace(/(\d{2})(\d)/, "$1/$2")
          .substring(0, 5);

      case "cvv":
        return value.replace(/\D/g, "").substring(0, 4);

      default:
        return value;
    }
  }, []);

  // Handle input changes with formatting
  const handleInputChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      const formattedValue = formatInputValue(name, value);

      setFormData((prev) => ({
        ...prev,
        [name]: formattedValue,
      }));
    },
    [formatInputValue],
  );

  // Validate form data
  const validateForm = useCallback(() => {
    const cardNumberDigits = formData.cardNumber.replace(/\s/g, "");

    if (cardNumberDigits.length < CARD_NUMBER_LENGTH) {
      setError("Please enter a valid card number");
      return false;
    }

    if (!formData.cardName.trim()) {
      setError("Please enter the cardholder name");
      return false;
    }

    if (formData.expiryDate.length !== 5) {
      setError("Please enter a valid expiry date (MM/YY)");
      return false;
    }

    if (formData.cvv.length < CVV_MIN_LENGTH) {
      setError("Please enter a valid CVV");
      return false;
    }

    if (
      !formData.billingAddress.trim() ||
      !formData.city.trim() ||
      !formData.zipCode.trim()
    ) {
      setError("Please complete all billing address fields");
      return false;
    }

    return true;
  }, [formData]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");

      if (!validateForm()) {
        return;
      }

      setIsProcessing(true);

      try {
        const processingFee = amount * PROCESSING_FEE_RATE;
        const totalAmount = amount + processingFee;
        const returnUrl = `${window.location.origin}/property/${property.id}`;

        if (!property?.id) {
          throw new Error(
            "Property ID is missing. Unable to create Stripe payment intent.",
          );
        }

        const createIntentResponse = await api.post(
          "/payments/stripe/create-intent",
          {
            propertyId: property.id,
            amountUSD: totalAmount,
            propertyTitle: property.name || property.title,
            returnUrl,
          },
        );

        const paymentIntentId = createIntentResponse.data?.paymentIntentId;

        if (!paymentIntentId) {
          throw new Error("Failed to create Stripe payment intent");
        }

        const confirmResponse = await api.post("/payments/stripe/confirm", {
          paymentIntentId,
          paymentMethodId: "pm_card_visa",
          propertyId: property.id,
          returnUrl,
        });

        if (!confirmResponse.data?.success) {
          throw new Error(
            confirmResponse.data?.message ||
              "Stripe payment could not be confirmed",
          );
        }

        onSuccess(paymentIntentId);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            err.message ||
            "Payment processing failed. Please try again.",
        );

        if (import.meta.env.DEV) {
          console.debug("Fiat payment error:", err);
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [amount, validateForm, onSuccess, property],
  );

  const processingFee = amount * PROCESSING_FEE_RATE;
  const totalAmount = amount + processingFee;

  return (
    <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
      {/* Payment Summary */}
      <PaymentSummaryCard property={property} amount={amount} shares={shares} />

      {/* Card Information */}
      <CardInformationSection
        formData={formData}
        onChange={handleInputChange}
        isDisabled={isProcessing}
      />

      {/* Billing Address */}
      <BillingAddressSection
        formData={formData}
        onChange={handleInputChange}
        isDisabled={isProcessing}
      />

      {/* Security Badge */}
      <SecurityBadge />

      {/* Error Alert */}
      {error && <ErrorAlert message={error} />}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isProcessing}
          className="sm:flex-1 border-border text-foreground hover:bg-muted"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={isProcessing}
          className="sm:flex-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <span>
              Pay $
              {totalAmount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          )}
        </Button>
      </div>

      {/* Payment Provider Footer */}
      <PaymentProviderFooter />
    </form>
  );
}

export default FiatPayment;
