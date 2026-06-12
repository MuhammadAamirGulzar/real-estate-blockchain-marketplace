import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, CheckCircle, Download, Home } from "lucide-react";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Success Header Component
 * Displays success icon and confirmation message
 */
const SuccessHeader = () => (
  <div className="flex flex-col items-center justify-center py-8">
    <div className="h-20 w-20 rounded-full bg-secondary/20 flex items-center justify-center mb-4 animate-in fade-in zoom-in duration-500">
      <CheckCircle className="h-12 w-12 text-secondary" />
    </div>
    <h2 className="text-2xl font-bold text-center text-foreground">
      Investment Successful!
    </h2>
    <p className="text-muted-foreground text-center mt-2">
      Your investment has been processed successfully
    </p>
  </div>
);

/**
 * Transaction Details Card Component
 * Displays investment and payment information
 */
const TransactionDetailsCard = ({
  property,
  shares,
  amount,
  transactionData,
}) => {
  const txHash =
    transactionData?.txHash ||
    transactionData?.transactionHash ||
    transactionData?.paymentReference ||
    "";

  const shortTxHash = txHash
    ? `${txHash.substring(0, 10)}...${txHash.substring(Math.max(0, txHash.length - 8))}`
    : "Pending indexing";

  const timestampValue = transactionData?.timestamp || new Date().toISOString();
  const timestamp = new Date(timestampValue);
  const formattedTimestamp = Number.isNaN(timestamp.getTime())
    ? "Just now"
    : timestamp.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

  return (
    <Card className="p-5 border-border bg-card space-y-4">
      <h3 className="font-semibold text-foreground">Transaction Details</h3>
      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Property:</span>
          <span className="font-medium text-foreground">{property.name}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Shares Purchased:</span>
          <span className="font-medium text-foreground">
            {shares.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Investment Amount:</span>
          <span className="font-bold text-primary">
            ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Payment Method:</span>
          <span className="font-medium text-foreground capitalize">
            {transactionData.method === "wallet"
              ? "Crypto Wallet"
              : "Credit Card"}
            {transactionData.last4 && ` (...${transactionData.last4})`}
          </span>
        </div>
        <div className="flex justify-between items-start">
          <span className="text-muted-foreground">Transaction ID:</span>
          <span className="font-mono text-xs text-foreground text-right max-w-xs break-all">
            {shortTxHash}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Date & Time:</span>
          <span className="font-medium text-foreground">
            {formattedTimestamp}
          </span>
        </div>
      </div>
    </Card>
  );
};

/**
 * Expected Returns Card Component
 * Displays projected annual and monthly returns
 */
const ExpectedReturnsCard = ({ property, estimatedReturn }) => (
  <Card className="p-5 border-secondary/30 bg-secondary/5 space-y-4">
    <h3 className="font-semibold text-foreground">Expected Returns</h3>
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">
          Annual Return ({property.expectedReturn}%):
        </span>
        <span className="text-lg font-bold text-secondary">
          $
          {estimatedReturn.toLocaleString("en-US", {
            maximumFractionDigits: 2,
          })}
        </span>
      </div>
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Monthly Distribution:</span>
        <span className="font-semibold text-foreground">
          $
          {(estimatedReturn / 12).toLocaleString("en-US", {
            maximumFractionDigits: 2,
          })}
        </span>
      </div>
    </div>
  </Card>
);

/**
 * Next Steps Card Component
 * Displays action items and timeline expectations
 */
const NextStepsCard = () => (
  <Card className="p-5 border-primary/30 bg-primary/5 space-y-4">
    <h4 className="font-semibold text-foreground">What's Next?</h4>
    <ul className="text-sm text-foreground space-y-2.5">
      <li className="flex items-start gap-3">
        <span className="text-primary font-bold">•</span>
        <span className="leading-relaxed">
          Your shares will appear in your portfolio within a few minutes
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className="text-primary font-bold">•</span>
        <span className="leading-relaxed">
          Monthly distributions will be credited to your account automatically
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className="text-primary font-bold">•</span>
        <span className="leading-relaxed">
          You can trade your shares on the secondary market after the lock-up
          period
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className="text-primary font-bold">•</span>
        <span className="leading-relaxed">
          Track your investment performance in real-time from your dashboard
        </span>
      </li>
    </ul>
  </Card>
);

/**
 * Confirmation Notice Component
 * Shows email confirmation message
 */
const ConfirmationNotice = () => (
  <div className="text-center text-xs text-muted-foreground">
    <p>
      A confirmation email has been sent to your registered email address with
      all details
    </p>
  </div>
);

/**
 * InvestmentSuccess Component
 * Displays confirmation screen after successful investment transaction.
 * Shows transaction details, expected returns, and next steps.
 *
 * @param {Object} property - Property details (name, expectedReturn)
 * @param {Object} transactionData - Transaction info (method, txHash, timestamp, last4)
 * @param {number} amount - Investment amount in USD
 * @param {number} shares - Number of shares purchased
 * @param {number} estimatedReturn - Estimated annual return amount
 * @param {Function} onClose - Callback to close modal/dialog
 */
export function InvestmentSuccess({
  property,
  transactionData,
  amount,
  shares,
  estimatedReturn,
  onClose,
}) {
  const navigate = useNavigate();

  // Navigate to portfolio and close modal
  const handleGoToPortfolio = useCallback(() => {
    onClose?.();
    navigate("/portfolio");
  }, [navigate, onClose]);

  // Navigate to dashboard and close modal
  const handleGoToDashboard = useCallback(() => {
    onClose?.();
    navigate("/dashboard");
  }, [navigate, onClose]);

  // Download receipt (placeholder for future implementation)
  const handleDownloadReceipt = useCallback(() => {
    // TODO: Implement receipt download with PDF generation
    // Could use libraries like jsPDF or html2pdf
    // Generate receipt with transaction details and investment summary
    const receiptData = {
      property: property.name,
      shares,
      amount,
      transactionHash: transactionData.txHash,
      timestamp: transactionData.timestamp,
      estimatedReturn,
    };

    // Store data for receipt generation
    sessionStorage.setItem("investmentReceipt", JSON.stringify(receiptData));

    // Placeholder: Log receipt data
    if (import.meta.env.DEV) {
      console.debug("Receipt download initiated:", receiptData);
    }
  }, [property, shares, amount, transactionData, estimatedReturn]);

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Success Header */}
      <SuccessHeader />

      {/* Transaction Details */}
      <TransactionDetailsCard
        property={property}
        shares={shares}
        amount={amount}
        transactionData={transactionData}
      />

      {/* Expected Returns */}
      <ExpectedReturnsCard
        property={property}
        estimatedReturn={estimatedReturn}
      />

      {/* Next Steps */}
      <NextStepsCard />

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          onClick={handleDownloadReceipt}
          variant="outline"
          className="w-full border-border text-foreground hover:bg-muted"
        >
          <Download className="mr-2 h-4 w-4" />
          <span>Download Receipt</span>
        </Button>

        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleGoToDashboard}
            variant="outline"
            className="border-border text-foreground hover:bg-muted"
          >
            <Home className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </Button>
          <Button
            onClick={handleGoToPortfolio}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <span>View Portfolio</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Confirmation Notice */}
      <ConfirmationNotice />
    </div>
  );
}

export default InvestmentSuccess;
