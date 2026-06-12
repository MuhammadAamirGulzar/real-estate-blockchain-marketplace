import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  CheckCircle,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Admin: Pending Bank Transfers Component
 * Dashboard for verifying bank transfer payment proofs
 */

const PendingBankTransfers = ({ className = "" }) => {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [selectedTransfers, setSelectedTransfers] = useState([]);
  const [batchVerifying, setBatchVerifying] = useState(false);

  const fetchPendingTransfers = async () => {
    setLoading(true);
    try {
      const token =
        localStorage.getItem("authToken") || localStorage.getItem("token");
      const params = new URLSearchParams();
      if (filterCurrency !== "all") {
        params.append("currency", filterCurrency);
      }

      const response = await fetch(
        `/api/payments/pending-bank-transfers?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const data = await response.json();
      if (response.ok) {
        const normalized = (data.transfers || []).map((entry) => {
          const proof = entry.paymentProof || entry.proof || entry;
          const investment = entry.investment || {};

          return {
            ...proof,
            investmentId: proof.investmentId ?? investment.id,
            amount: proof.amount ?? investment.fiatAmount ?? 0,
            currency: proof.currency ?? investment.paymentCurrency,
            uploadedAt: proof.uploadedAt ?? investment.investedAt,
            ipfsUrl: proof.documentUrl || proof.ipfsUrl,
            user: entry.user || null,
          };
        });

        setTransfers(normalized);
      }
    } catch (error) {
      console.error("Error fetching transfers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingTransfers();
  }, [filterCurrency]);

  const handleVerify = async (approved) => {
    if (!selectedTransfer) return;

    setVerifying(true);
    try {
      const token =
        localStorage.getItem("authToken") || localStorage.getItem("token");
      const response = await fetch(
        `/api/payments/verify/${selectedTransfer.id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            approved,
            verificationNotes,
          }),
        },
      );

      const data = await response.json();
      if (response.ok) {
        setSelectedTransfer(null);
        setVerificationNotes("");
        fetchPendingTransfers();
      } else {
        alert(data.error || "Verification failed");
      }
    } catch (error) {
      console.error("Verification error:", error);
      alert("Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleBatchVerify = async (approved) => {
    if (selectedTransfers.length === 0) return;

    setBatchVerifying(true);
    try {
      const token =
        localStorage.getItem("authToken") || localStorage.getItem("token");
      const verifications = selectedTransfers.map((id) => ({
        paymentProofId: id,
        approved,
        notes: `Batch ${approved ? "approved" : "rejected"}`,
      }));

      const response = await fetch("/api/payments/batch-verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ verifications }),
      });

      const data = await response.json();
      if (response.ok) {
        setSelectedTransfers([]);
        fetchPendingTransfers();
      } else {
        alert(data.error || "Batch verification failed");
      }
    } catch (error) {
      console.error("Batch verification error:", error);
      alert("Batch verification failed");
    } finally {
      setBatchVerifying(false);
    }
  };

  const toggleSelectTransfer = (id) => {
    setSelectedTransfers((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getDaysRemaining = (expiresAt) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pending Bank Transfers</CardTitle>
              <CardDescription>
                Review and verify bank transfer payment proofs
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterCurrency} onValueChange={setFilterCurrency}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Currencies</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="PKR">PKR</SelectItem>
                  <SelectItem value="AED">AED</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchPendingTransfers}
              >
                <Download className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedTransfers.length > 0 && (
            <Alert className="mb-4">
              <AlertDescription className="flex items-center justify-between">
                <span>{selectedTransfers.length} transfers selected</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleBatchVerify(true)}
                    disabled={batchVerifying}
                  >
                    {batchVerifying ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve All
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleBatchVerify(false)}
                    disabled={batchVerifying}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject All
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending transfers
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedTransfers.length === transfers.length}
                      onCheckedChange={(checked) =>
                        setSelectedTransfers(
                          checked ? transfers.map((t) => t.id) : [],
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => {
                  const daysRemaining = getDaysRemaining(transfer.expiresAt);
                  return (
                    <TableRow key={transfer.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedTransfers.includes(transfer.id)}
                          onCheckedChange={() =>
                            toggleSelectTransfer(transfer.id)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {transfer.bankReference}
                      </TableCell>
                      <TableCell>{transfer.user?.email || "Unknown"}</TableCell>
                      <TableCell className="font-semibold">
                        {transfer.amount} {transfer.currency}
                      </TableCell>
                      <TableCell>{formatDate(transfer.uploadedAt)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            daysRemaining <= 1 ? "destructive" : "secondary"
                          }
                        >
                          {daysRemaining}d
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            window.open(transfer.ipfsUrl, "_blank")
                          }
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedTransfer(transfer)}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Verification Dialog */}
      <Dialog
        open={!!selectedTransfer}
        onOpenChange={() => setSelectedTransfer(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Verify Bank Transfer</DialogTitle>
            <DialogDescription>
              Review payment proof and approve or reject the transfer
            </DialogDescription>
          </DialogHeader>

          {selectedTransfer && (
            <div className="space-y-4">
              {/* Transfer Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label>Payment Reference</Label>
                  <div className="font-mono">
                    {selectedTransfer.bankReference}
                  </div>
                </div>
                <div>
                  <Label>Amount</Label>
                  <div className="font-semibold">
                    {selectedTransfer.amount} {selectedTransfer.currency}
                  </div>
                </div>
                <div>
                  <Label>User</Label>
                  <div>{selectedTransfer.user?.email}</div>
                </div>
                <div>
                  <Label>Investment ID</Label>
                  <div>#{selectedTransfer.investmentId}</div>
                </div>
                {selectedTransfer.transactionReference && (
                  <div className="col-span-2">
                    <Label>Bank Transaction Reference</Label>
                    <div className="font-mono">
                      {selectedTransfer.transactionReference}
                    </div>
                  </div>
                )}
              </div>

              {/* Document Preview */}
              <div>
                <Label>Payment Proof</Label>
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() =>
                    window.open(selectedTransfer.ipfsUrl, "_blank")
                  }
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Document in New Tab
                </Button>
              </div>

              {/* Verification Notes */}
              <div>
                <Label htmlFor="verification-notes">Verification Notes</Label>
                <Textarea
                  id="verification-notes"
                  placeholder="Add notes about this verification..."
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedTransfer(null)}
              disabled={verifying}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleVerify(false)}
              disabled={verifying}
            >
              {verifying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </>
              )}
            </Button>
            <Button onClick={() => handleVerify(true)} disabled={verifying}>
              {verifying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PendingBankTransfers;
