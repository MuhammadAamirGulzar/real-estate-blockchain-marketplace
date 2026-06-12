import { ethers } from "ethers";
import {
  CheckCircle,
  FileText,
  RefreshCw,
  Shield,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { config } from "../../config/environment";
import { useAuth } from "../../contexts/AuthContext";
import { useWallet } from "../../contexts/WalletContext";
import KYCRegistryABI from "../../contracts/abi/KYCRegistry.json";
import api from "../../services/api";

export default function AdminKycReviewPage() {
  const { user } = useAuth();
  const { isConnected, signer, account } = useWallet();
  const [kycRequests, setKycRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending"); // pending | all | approved | rejected

  useEffect(() => {
    fetchKycRequests();
  }, []);

  const fetchKycRequests = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/admin/kyc-requests");
      setKycRequests(data.data || []);
    } catch (error) {
      console.error("Error fetching KYC requests:", error);
      toast.error("Failed to load KYC requests");
    } finally {
      setLoading(false);
    }
  };

  const reconcileKYCStatus = async (kycId) => {
    try {
      const toastId = toast.loading("Syncing with blockchain...");
      const kycRecord = kycRequests.find((k) => k.id === kycId);
      if (!kycRecord) {
        toast.dismiss(toastId);
        toast.error("KYC record not found");
        return;
      }
      const response = await api.post(
        `/admin/kyc/${kycRecord.userId}/reconcile`,
      );
      toast.dismiss(toastId);
      if (response.data.success) {
        toast.success(`Synced! Status: ${response.data.data?.currentStatus}`);
        fetchKycRequests();
      } else {
        toast.error(response.data.message || "Sync failed");
      }
    } catch (error) {
      console.error("Reconciliation error:", error);
      toast.error(
        error.response?.data?.message || "Failed to sync with blockchain",
      );
    }
  };

  const handleKycAction = async (kycId, action, targetWallet) => {
    if (!isConnected || !signer) {
      toast.error("Please connect your wallet first");
      return;
    }

    const toastId = toast.loading(`Processing ${action} on blockchain...`);
    try {
      const contract = new ethers.Contract(
        config.contracts.kycRegistry,
        KYCRegistryABI.abi,
        signer,
      );

      let txHash = null;
      try {
        const tx =
          action === "approve"
            ? await contract.approveKYC(targetWallet)
            : await contract.rejectKYC(targetWallet);
        await tx.wait();
        txHash = tx.hash;
        toast.success(`KYC ${action}d on blockchain!`, { id: toastId });
      } catch (contractError) {
        toast.dismiss(toastId);
        const isNotPending =
          contractError.reason === "KYC not pending" ||
          contractError.message?.includes("KYC not pending");

        if (isNotPending) {
          try {
            const isApprovedOnChain =
              await contract.isKYCApproved(targetWallet);
            toast.error(
              isApprovedOnChain
                ? "Database out of sync: KYC already approved on-chain. Click Sync."
                : "KYC not found on blockchain. User may not have submitted on-chain.",
            );
          } catch (_) {
            toast.error("Failed to check blockchain status.");
          }
          return;
        } else if (contractError.code === "ACTION_REJECTED") {
          toast.error("Transaction rejected.");
          return;
        } else {
          throw contractError;
        }
      }

      // Sync to backend
      const message = `Action: ${action}_kyc\nTarget ID: ${kycId}\nTimestamp: ${Date.now()}`;
      const signature = await signer.signMessage(message);
      await api.post(`/admin/kyc/${kycId}/${action}`, {
        walletAddress: account,
        signature,
        message,
        txHash,
      });

      toast.success("Database updated");
      fetchKycRequests();
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(error.reason || error.message || "Transaction failed");
    }
  };

  const filteredRequests =
    filter === "all"
      ? kycRequests
      : kycRequests.filter((k) => k.status === filter);

  const counts = {
    pending: kycRequests.filter((k) => k.status === "pending").length,
    approved: kycRequests.filter((k) => k.status === "approved").length,
    rejected: kycRequests.filter((k) => k.status === "rejected").length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-xl">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">KYC Review</h1>
            <p className="text-muted-foreground">
              Review and process identity verification requests
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchKycRequests} disabled={loading}>
          <RefreshCw
            className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Pending",
            count: counts.pending,
            color: "text-warning",
            bg: "bg-warning/10",
            value: "pending",
          },
          {
            label: "Approved",
            count: counts.approved,
            color: "text-success",
            bg: "bg-success/10",
            value: "approved",
          },
          {
            label: "Rejected",
            count: counts.rejected,
            color: "text-destructive",
            bg: "bg-destructive/10",
            value: "rejected",
          },
        ].map((item) => (
          <button
            key={item.value}
            onClick={() =>
              setFilter(filter === item.value ? "all" : item.value)
            }
            className={`p-4 rounded-xl border transition-all text-left ${
              filter === item.value
                ? `${item.bg} border-current/30`
                : "bg-card hover:bg-muted/40"
            }`}
          >
            <p className={`text-2xl font-bold ${item.color}`}>{item.count}</p>
            <p className="text-sm text-muted-foreground">{item.label}</p>
          </button>
        ))}
      </div>

      {/* Wallet warning */}
      {!isConnected && (
        <div className="p-4 rounded-lg bg-warning/10 border border-warning/30 text-sm text-warning">
          ⚠️ Connect your wallet to approve or reject KYC requests on-chain.
        </div>
      )}

      {/* Requests List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            KYC Submissions
            <Badge variant="secondary">{filteredRequests.length}</Badge>
          </CardTitle>
          <div className="flex gap-2">
            {["all", "pending", "approved", "rejected"].map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
                className="capitalize"
              >
                {f}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              Loading...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No {filter === "all" ? "" : filter} KYC requests found
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((kyc) => (
                <div
                  key={kyc.id}
                  className="p-6 space-y-4 border rounded-xl hover:border-primary/40 transition-colors"
                >
                  {/* Row 1: Identity + Actions */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-lg font-semibold">
                        {kyc.firstName} {kyc.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {kyc.email}
                      </p>
                      {kyc.walletAddress && (
                        <p className="font-mono text-xs text-muted-foreground">
                          {kyc.walletAddress.slice(0, 8)}...
                          {kyc.walletAddress.slice(-6)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Submitted:{" "}
                        {kyc.submittedAt
                          ? new Date(kyc.submittedAt).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )
                          : "Unknown"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {kyc.status === "pending" ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() =>
                              handleKycAction(
                                kyc.id,
                                "approve",
                                kyc.walletAddress,
                              )
                            }
                            className="bg-success hover:bg-success/90 text-success-foreground"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              handleKycAction(
                                kyc.id,
                                "reject",
                                kyc.walletAddress,
                              )
                            }
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reconcileKYCStatus(kyc.id)}
                            title="Sync with blockchain"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Badge
                            variant={
                              kyc.status === "approved"
                                ? "success"
                                : "destructive"
                            }
                          >
                            {kyc.status}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => reconcileKYCStatus(kyc.id)}
                            title="Verify blockchain status"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Documents */}
                  {kyc.documents && kyc.documents.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-3 flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        Documents ({kyc.documents.length})
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {kyc.documents.map((doc) => (
                          <a
                            key={doc.id}
                            href={doc.ipfsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-3 border rounded-lg hover:border-primary/50 hover:bg-accent transition-colors"
                          >
                            <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate uppercase">
                                {doc.documentType?.replace(/_/g, " ")}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {doc.fileName}
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
