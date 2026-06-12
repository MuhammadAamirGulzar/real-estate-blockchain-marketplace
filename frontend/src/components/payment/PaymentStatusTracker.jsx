import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  Circle,
  Clock,
  Coins,
  FileCheck,
  Loader2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Payment Status Tracker Component
 * Displays payment workflow status as a stepper
 */

const PAYMENT_STATUSES = {
  pending: {
    label: "Pending",
    description: "Waiting for payment initiation",
    color: "bg-yellow-500",
    icon: Clock,
  },
  proof_uploaded: {
    label: "Proof Uploaded",
    description: "Payment proof submitted for verification",
    color: "bg-blue-500",
    icon: FileCheck,
  },
  verifying: {
    label: "Verifying",
    description: "Admin is reviewing your payment",
    color: "bg-blue-500",
    icon: Loader2,
  },
  verified: {
    label: "Verified",
    description: "Payment verified, processing tokens",
    color: "bg-green-500",
    icon: CheckCircle2,
  },
  completed: {
    label: "Completed",
    description: "Tokens minted and transferred to your wallet",
    color: "bg-green-600",
    icon: Coins,
  },
  cancelled: {
    label: "Cancelled",
    description: "Payment was cancelled",
    color: "bg-red-500",
    icon: XCircle,
  },
  expired: {
    label: "Expired",
    description: "Payment expired (no proof uploaded within 7 days)",
    color: "bg-gray-500",
    icon: XCircle,
  },
};

const WORKFLOW_STEPS = [
  { id: "initiated", label: "Initiated", status: ["pending"] },
  { id: "proof_uploaded", label: "Proof Uploaded", status: ["proof_uploaded"] },
  {
    id: "verification",
    label: "Verification",
    status: ["verifying", "verified"],
  },
  { id: "completed", label: "Completed", status: ["completed"] },
];

const StepItem = ({ step, currentStatus, isLast }) => {
  const isActive = step.status.includes(currentStatus);
  const isPast =
    currentStatus === "completed" ||
    (currentStatus === "verified" && step.id !== "completed");
  const isCompleted = isPast || (isActive && step.id !== "completed");

  const StatusIcon = isCompleted ? CheckCircle2 : isActive ? Loader2 : Circle;

  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            isActive
              ? "bg-primary text-primary-foreground"
              : isCompleted
                ? "bg-green-500 text-white"
                : "bg-muted text-muted-foreground"
          }`}
        >
          <StatusIcon
            className={`w-5 h-5 ${isActive && step.id === "verification" ? "animate-spin" : ""}`}
          />
        </div>
        {!isLast && (
          <div
            className={`w-0.5 h-12 transition-colors ${
              isCompleted ? "bg-green-500" : "bg-muted"
            }`}
          />
        )}
      </div>
      <div className="flex-1 pb-8">
        <div className="font-semibold">{step.label}</div>
        {isActive && PAYMENT_STATUSES[currentStatus] && (
          <div className="text-sm text-muted-foreground mt-1">
            {PAYMENT_STATUSES[currentStatus].description}
          </div>
        )}
      </div>
    </div>
  );
};

const PaymentStatusTracker = ({
  investmentId,
  initialStatus = "pending",
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
  onStatusChange,
  className = "",
}) => {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [error, setError] = useState(null);

  const fetchPaymentStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const token =
        localStorage.getItem("authToken") || localStorage.getItem("token");
      const response = await fetch(`/api/payments/status/${investmentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch payment status");
      }

      setStatus(data.status.paymentStatus);
      setPaymentDetails(data.status);

      if (onStatusChange && data.status.paymentStatus !== status) {
        onStatusChange(data.status.paymentStatus, data.status);
      }
    } catch (error) {
      console.error("Error fetching payment status:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentStatus();

    if (
      autoRefresh &&
      status !== "completed" &&
      status !== "cancelled" &&
      status !== "expired"
    ) {
      const interval = setInterval(fetchPaymentStatus, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [investmentId, autoRefresh, refreshInterval]);

  const currentStatusConfig = PAYMENT_STATUSES[status];
  const StatusIcon = currentStatusConfig?.icon || Clock;

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <StatusIcon className="w-5 h-5" />
              Payment Status
            </CardTitle>
            {currentStatusConfig && (
              <Badge
                variant="secondary"
                className={`${currentStatusConfig.color} text-white`}
              >
                {currentStatusConfig.label}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Payment Details */}
          {paymentDetails && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Investment ID</div>
                <div className="font-mono font-medium">#{investmentId}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Amount</div>
                <div className="font-semibold">
                  {paymentDetails.amount} {paymentDetails.currency}
                </div>
              </div>
              {paymentDetails.paymentMethod && (
                <div>
                  <div className="text-muted-foreground">Payment Method</div>
                  <div className="font-medium capitalize">
                    {paymentDetails.paymentMethod.replace("_", " ")}
                  </div>
                </div>
              )}
              {paymentDetails.paymentProof?.bankReference && (
                <div>
                  <div className="text-muted-foreground">Reference</div>
                  <div className="font-mono text-xs">
                    {paymentDetails.paymentProof.bankReference}
                  </div>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Workflow Steps */}
          <div className="py-4">
            {WORKFLOW_STEPS.map((step, index) => (
              <StepItem
                key={step.id}
                step={step}
                currentStatus={status}
                isLast={index === WORKFLOW_STEPS.length - 1}
              />
            ))}
          </div>

          {/* Cancelled/Expired Message */}
          {(status === "cancelled" || status === "expired") && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm">
              <div className="font-semibold text-destructive mb-1">
                Payment {status === "cancelled" ? "Cancelled" : "Expired"}
              </div>
              <div className="text-muted-foreground">
                {status === "expired"
                  ? "This payment expired because no proof was uploaded within 7 days."
                  : "This payment was cancelled."}
              </div>
            </div>
          )}

          {/* Refresh Button */}
          {!autoRefresh &&
            status !== "completed" &&
            status !== "cancelled" &&
            status !== "expired" && (
              <Button
                variant="outline"
                onClick={fetchPaymentStatus}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  "Refresh Status"
                )}
              </Button>
            )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentStatusTracker;
export { PAYMENT_STATUSES, WORKFLOW_STEPS };
