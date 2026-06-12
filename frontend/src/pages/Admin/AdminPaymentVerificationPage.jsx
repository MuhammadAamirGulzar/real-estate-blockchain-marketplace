import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const AdminPaymentVerificationPage = () => {
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [verificationAction, setVerificationAction] = useState(""); // "approve" or "reject"
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    fetchPendingPayments();
  }, []);

  const fetchPendingPayments = async () => {
    setLoading(true);
    try {
      const token =
        localStorage.getItem("authToken") || localStorage.getItem("token");
      const response = await fetch("/api/admin/payments/pending", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setPayments(data.data || []);
      } else {
        toast.error(data.message || "Failed to fetch pending payments");
      }
    } catch (error) {
      console.error("Error fetching pending payments:", error);
      toast.error("Failed to load pending payment verifications");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenVerifyDialog = (payment, action) => {
    setSelectedPayment(payment);
    setVerificationAction(action);
    setRejectionReason("");
    setShowVerifyDialog(true);
  };

  const handleVerifyPayment = async () => {
    if (!selectedPayment) return;

    if (verificationAction === "reject" && !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setVerifying(true);

    try {
      const token =
        localStorage.getItem("authToken") || localStorage.getItem("token");
      const response = await fetch(
        `/api/admin/payments/${selectedPayment.investmentId}/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            approved: verificationAction === "approve",
            rejectionReason:
              verificationAction === "reject" ? rejectionReason : undefined,
            verificationNotes:
              verificationAction === "reject" ? rejectionReason : "",
          }),
        },
      );

      const data = await response.json();

      if (data.success) {
        toast.success(
          verificationAction === "approve"
            ? "Payment approved successfully!"
            : "Payment rejected",
        );
        setShowVerifyDialog(false);
        fetchPendingPayments(); // Refresh list
      } else {
        toast.error(data.message || "Failed to verify payment");
      }
    } catch (error) {
      console.error("Error verifying payment:", error);
      toast.error("Failed to verify payment");
    } finally {
      setVerifying(false);
    }
  };

  const formatNumber = (value) => {
    if (!value && value !== 0) return "N/A";
    return Number(value).toLocaleString();
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate("/admin/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-foreground">
            Payment Verification
          </h1>
          <p className="text-muted-foreground mt-2">
            Review and verify bank transfer payment proofs
          </p>
        </div>
        <Button onClick={fetchPendingPayments} variant="outline">
          <Loader2
            className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Verifications
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payments.length}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting admin review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Amount Pending
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${" "}
              {formatNumber(
                payments.reduce(
                  (sum, p) => sum + (parseFloat(p.proofAmount) || 0),
                  0,
                ),
              )}
            </div>
            <p className="text-xs text-muted-foreground">Across all payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Unique Investors
            </CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(payments.map((p) => p.userId)).size}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting verification
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Payment Verifications</CardTitle>
          <CardDescription>
            Review payment proofs and approve or reject investments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-muted-foreground">
                No pending payment verifications
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                All payments have been reviewed
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Investor</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Proof</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.investmentId}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {payment.userFirstName} {payment.userLastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {payment.userEmail}
                          </div>
                          {payment.userWallet && (
                            <div className="text-xs text-muted-foreground font-mono">
                              {payment.userWallet.substring(0, 10)}...
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {payment.propertyTitle ||
                              `Property #${payment.propertyId}`}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {payment.propertyLocation}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-semibold">
                            {payment.proofCurrency}{" "}
                            {formatNumber(payment.proofAmount)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Ref:{" "}
                            {payment.bankReference ||
                              payment.transactionReference ||
                              "N/A"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {payment.paymentMethod || payment.proofType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {payment.documentUrl ? (
                          <a
                            href={payment.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 flex items-center text-sm"
                          >
                            View Proof
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            No document
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDate(payment.uploadedAt || payment.investedAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="min-h-9 whitespace-nowrap"
                            onClick={() =>
                              handleOpenVerifyDialog(payment, "approve")
                            }
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="min-h-9 whitespace-nowrap"
                            onClick={() =>
                              handleOpenVerifyDialog(payment, "reject")
                            }
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verify Payment Dialog */}
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {verificationAction === "approve"
                ? "Approve Payment"
                : "Reject Payment"}
            </DialogTitle>
            <DialogDescription>
              {verificationAction === "approve"
                ? "Confirm that you have verified this payment proof"
                : "Provide a reason for rejecting this payment"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Payment Details */}
            <div className="p-4 bg-muted/40 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-foreground">
                  Investor:
                </span>
                <span className="text-sm font-semibold">
                  {selectedPayment?.userFirstName}{" "}
                  {selectedPayment?.userLastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-foreground">
                  Property:
                </span>
                <span className="text-sm font-semibold">
                  {selectedPayment?.propertyTitle ||
                    `Property #${selectedPayment?.propertyId}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-foreground">
                  Amount:
                </span>
                <span className="text-sm font-semibold">
                  {selectedPayment?.proofCurrency}{" "}
                  {formatNumber(selectedPayment?.proofAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-foreground">
                  Reference:
                </span>
                <span className="text-sm font-mono">
                  {selectedPayment?.bankReference ||
                    selectedPayment?.transactionReference ||
                    "N/A"}
                </span>
              </div>
            </div>

            {/* Payment Proof Link */}
            {selectedPayment?.documentUrl && (
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm font-medium text-foreground mb-2">
                  Payment Proof Document
                </p>
                <a
                  href={selectedPayment.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 flex items-center text-sm font-medium"
                >
                  Open Document in New Tab
                  <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              </div>
            )}

            {/* Rejection Reason (only for reject action) */}
            {verificationAction === "reject" && (
              <div>
                <Label htmlFor="rejectionReason">Rejection Reason *</Label>
                <Textarea
                  id="rejectionReason"
                  placeholder="Explain why this payment proof is being rejected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This reason will be sent to the investor
                </p>
              </div>
            )}

            {/* Warning for approve */}
            {verificationAction === "approve" && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-sm text-foreground">
                  <CheckCircle2 className="w-4 h-4 inline mr-2" />
                  Approving this payment will mark the investment as verified
                  and proceed with the investment process.
                </p>
              </div>
            )}

            {/* Warning for reject */}
            {verificationAction === "reject" && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                <p className="text-sm text-foreground">
                  <XCircle className="w-4 h-4 inline mr-2" />
                  Rejecting this payment will mark the investment as failed and
                  notify the investor.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowVerifyDialog(false)}
              disabled={verifying}
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerifyPayment}
              disabled={verifying}
              variant={
                verificationAction === "approve" ? "default" : "destructive"
              }
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : verificationAction === "approve" ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve Payment
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPaymentVerificationPage;
