import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import * as api from "@/services/api";
import { verificationService } from "@/services/verification.service";
import {
  AlertCircle,
  Building2,
  CheckCircle,
  CheckSquare,
  Clock,
  FileText,
  Loader2,
  MapPin,
  Shield,
  Square,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const STATUS_CONFIG = {
  verified: {
    label: "Verified",
    cls: "bg-green-500/15 text-green-400 border-green-500/25",
  },
  rejected: {
    label: "Rejected",
    cls: "bg-red-500/15   text-red-400   border-red-500/25",
  },
  verification_pending: {
    label: "In Review",
    cls: "bg-blue-500/15  text-blue-400  border-blue-500/25",
  },
  pending_assignment: {
    label: "Pending",
    cls: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  },
};

const CHECKLIST = [
  "Title deed matches declared ownership",
  "Property photos are current and authentic",
  "Declared area / sqft is consistent with floor plan",
  "Financial figures are realistic for the market",
  "No known encumbrances, liens, or mortgage conflicts",
];

export default function VerifierDashboard() {
  const { logout } = useAuth();
  const { account, signer, connectWallet } = useWallet();

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [checks, setChecks] = useState([]);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [stats, setStats] = useState({
    pending: 0,
    verified: 0,
    rejected: 0,
    total: 0,
  });

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    setLoading(true);
    try {
      const data = await api.getVerifierProperties();
      const raw = Array.isArray(data)
        ? data
        : data?.properties || data?.data || [];
      // Backend wraps property fields under a `property` key:
      // { id, status(assignment), assignedAt, property: { title, location, ... } }
      // Flatten so the rest of the UI can access p.title, p.status, etc. directly.
      const list = raw.map((item) => {
        if (item.property && typeof item.property === "object") {
          return {
            ...item.property, // spread all property fields (title, location, etc.)
            assignmentId: item.id, // keep assignment id accessible
            assignmentStatus: item.status, // assignment-level status (e.g. "assigned")
            assignedAt: item.assignedAt,
          };
        }
        return item; // already flat (legacy shape)
      });
      setProperties(list);
      setStats({
        pending: list.filter((p) => p.status === "verification_pending").length,
        verified: list.filter((p) => p.status === "verified").length,
        rejected: list.filter((p) => p.status === "rejected").length,
        total: list.length,
      });
    } catch {
      toast.error("Failed to load assigned properties");
    } finally {
      setLoading(false);
    }
  };

  const selected = properties.find((p) => p.id === selectedId);
  const allChecked = checks.length === CHECKLIST.length;

  const toggleCheck = (i) =>
    setChecks((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
    );

  const handleVerify = async (approve) => {
    if (approve && !allChecked) {
      toast.error("Complete all checklist items before approving");
      return;
    }
    if (!approve && !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    if (!signer || !account) {
      toast.error("Please connect your wallet before verifying a property");
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading(
      approve ? "Submitting verification..." : "Submitting rejection...",
    );
    try {
      // Step 1: Update database via backend
      const msg = approve
        ? "I verify property #" + selected.id + ": " + selected.title
        : "I reject property #" + selected.id + ": " + rejectionReason;
      const signature = await signer.signMessage(msg);

      let backendRes;
      if (approve) {
        backendRes = await api.verifyProperty(selected.id, {
          verificationSignature: signature,
          message: msg,
        });
      } else {
        backendRes = await api.rejectPropertyVerification(selected.id, {
          reason: rejectionReason,
          verificationSignature: signature,
          message: msg,
        });
      }

      // Step 2: Call blockchain from verifier's own wallet
      // assetRegistryId comes from the backend response or the property object
      const onChainId =
        backendRes?.assetRegistryId ??
        selected.assetRegistryId ??
        selected.assetRegistryId?.toString();

      if (!onChainId) {
        toast.warning(
          "Database updated but property has no blockchain ID — blockchain step skipped.",
          { id: loadingToast, duration: 5000 },
        );
      } else {
        toast.loading("Confirming on blockchain — approve in MetaMask...", {
          id: loadingToast,
        });
        if (approve) {
          await verificationService.verifyProperty(onChainId, signer);
        } else {
          await verificationService.rejectProperty(
            onChainId,
            rejectionReason,
            signer,
          );
        }
        toast.success(
          approve
            ? "Property verified on blockchain!"
            : "Property rejected on blockchain.",
          { id: loadingToast },
        );
      }

      setSelectedId(null);
      setChecks([]);
      setRejectionReason("");
      setShowRejectInput(false);
      await loadProperties();
    } catch (err) {
      const msg =
        err.code === 4001 || err.code === "ACTION_REJECTED"
          ? "MetaMask signature rejected"
          : err.response?.data?.message || err.message || "Action failed";
      toast.error(msg, { id: loadingToast });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectProperty = (id) => {
    setSelectedId(id);
    setChecks([]);
    setRejectionReason("");
    setShowRejectInput(false);
  };

  const getDocumentUrl = (doc) => {
    const candidate = doc?.fileUrl || doc?.ipfsUrl || doc?.filePath;
    if (!candidate) return null;
    if (/^https?:\/\//i.test(candidate)) return candidate;
    if (candidate.startsWith("ipfs://")) {
      const hash = candidate.replace("ipfs://", "");
      return `https://gateway.pinata.cloud/ipfs/${hash}`;
    }
    if (candidate.startsWith("/")) {
      const apiBase = import.meta.env.VITE_API_URL || "";
      const host = apiBase.replace(/\/api\/?$/, "");
      return host ? `${host}${candidate}` : candidate;
    }
    return candidate;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-navy-500 bg-navy-900">
        <div className="container-max py-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                Verifier Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Review and verify assigned property submissions
              </p>
            </div>
              <div className="flex items-center gap-2 flex-wrap">
                {account ? (
                  <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1.5">
                    <CheckCircle className="w-3 h-3" />
                    {account.slice(0, 6)}…{account.slice(-4)}
                  </div>
                ) : (
                  <button
                    onClick={connectWallet}
                    className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5 hover:bg-amber-500/20 hover:border-amber-500/40 transition-colors cursor-pointer"
                  >
                    <AlertCircle className="w-3 h-3" />
                    Connect Wallet
                  </button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={logout}
                  className="border-navy-400 text-foreground hover:bg-navy-700"
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>

      <div className="container-max py-8 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total Assigned",
              value: stats.total,
              icon: Building2,
              cls: "text-foreground",
            },
            {
              label: "Pending Review",
              value: stats.pending,
              icon: Clock,
              cls: "text-amber-400",
            },
            {
              label: "Verified",
              value: stats.verified,
              icon: CheckCircle,
              cls: "text-green-400",
            },
            {
              label: "Rejected",
              value: stats.rejected,
              icon: XCircle,
              cls: "text-red-400",
            },
          ].map((s, i) => (
            <Card key={i} className="bg-navy-700 border-navy-500">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {s.label}
                  </p>
                  <s.icon className={`w-4 h-4 ${s.cls}`} />
                </div>
                <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">
                Assigned Properties
              </h2>
              <Badge
                variant="outline"
                className="text-xs border-navy-400 text-muted-foreground"
              >
                {stats.pending} pending
              </Badge>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-gold-400" />
              </div>
            ) : properties.length === 0 ? (
              <Card className="bg-navy-700 border-navy-500">
                <CardContent className="py-12 text-center">
                  <Building2 className="w-12 h-12 text-navy-400 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No properties assigned yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
                {properties.map((p) => {
                  const sc = STATUS_CONFIG[p.status] || {
                    label: p.status,
                    cls: "bg-navy-600 text-muted-foreground border-navy-400",
                  };
                  const isSel = selectedId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => selectProperty(p.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        isSel
                          ? "border-gold-500/60 bg-gold-400/5"
                          : "border-navy-500 bg-navy-700 hover:border-navy-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold text-foreground line-clamp-1">
                          {p.title}
                        </p>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0 ${sc.cls}`}
                        >
                          {sc.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {p.location || p.city || "—"}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>
                          $
                          {Number(
                            p.propertyValue || p.price || 0,
                          ).toLocaleString()}
                        </span>
                        <span>·</span>
                        <span>
                          {new Date(p.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-3">
            {!selected ? (
              <Card className="bg-navy-700 border-navy-500 min-h-[300px]">
                <CardContent className="flex items-center justify-center h-80">
                  <div className="text-center space-y-3">
                    <Shield className="w-14 h-14 text-navy-400 mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      Select a property from the queue to begin review
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card className="bg-navy-700 border-navy-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-lg text-foreground">
                          {selected.title}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {selected.location ||
                            [selected.city, selected.state, selected.country]
                              .filter(Boolean)
                              .join(", ")}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedId(null)}
                        className="text-muted-foreground hover:text-foreground p-1 flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {[
                        {
                          label: "Type",
                          val:
                            (selected.propertyType || "").replace(/_/g, " ") ||
                            "—",
                          cls: "text-foreground capitalize",
                        },
                        {
                          label: "Value",
                          val:
                            "$" +
                            Number(
                              selected.propertyValue || 0,
                            ).toLocaleString(),
                          cls: "text-foreground",
                        },
                        {
                          label: "ROI",
                          val:
                            (selected.projectedRoi ||
                              selected.expectedReturn ||
                              "—") + "%",
                          cls: "text-green-400",
                        },
                        {
                          label: "Submitted",
                          val: new Date(
                            selected.createdAt,
                          ).toLocaleDateString(),
                          cls: "text-foreground",
                        },
                      ].map(({ label, val, cls }) => (
                        <div key={label}>
                          <p className="text-xs text-muted-foreground">
                            {label}
                          </p>
                          <p className={"font-medium " + cls}>{val}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {selected.description && (
                  <Card className="bg-navy-700 border-navy-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-foreground">
                        Description
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {selected.description}
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Card className="bg-navy-700 border-navy-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-foreground flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gold-400" />
                      Submitted Documents
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {Array.isArray(selected.documents) &&
                    selected.documents.length > 0 ? (
                      selected.documents.map((doc, i) => {
                        const docUrl = getDocumentUrl(doc);
                        return (
                          <div
                            key={doc.id || `${doc.documentType || "doc"}-${i}`}
                            className="flex items-center justify-between p-3 bg-navy-800 border border-navy-500 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm text-foreground font-medium">
                                  {doc.documentType || `Document ${i + 1}`}
                                </p>
                                {(doc.fileName || doc.originalName) && (
                                  <p className="text-xs text-muted-foreground">
                                    {doc.fileName || doc.originalName}
                                  </p>
                                )}
                              </div>
                            </div>
                            {docUrl ? (
                              <a
                                href={docUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs border-navy-400 hover:bg-navy-600 h-7"
                                >
                                  View
                                </Button>
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                No file URL
                              </span>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 bg-navy-800 border border-navy-500 rounded-lg text-sm text-muted-foreground">
                        No documents attached to this property.
                      </div>
                    )}
                  </CardContent>
                </Card>

                {selected.status === "verification_pending" && (
                  <>
                    <Card className="bg-navy-700 border-navy-500">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm text-foreground flex items-center gap-2">
                          <CheckSquare className="w-4 h-4 text-gold-400" />
                          Verification Checklist
                          <span className="ml-auto text-xs text-muted-foreground font-normal">
                            {checks.length}/{CHECKLIST.length} completed
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-2">
                        {CHECKLIST.map((item, i) => (
                          <button
                            key={i}
                            onClick={() => toggleCheck(i)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                              checks.includes(i)
                                ? "bg-green-500/10 border border-green-500/20"
                                : "bg-navy-800 border border-navy-500 hover:border-navy-300"
                            }`}
                          >
                            {checks.includes(i) ? (
                              <CheckSquare className="w-4 h-4 text-green-400 flex-shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <span
                              className={
                                "text-sm " +
                                (checks.includes(i)
                                  ? "text-green-400"
                                  : "text-muted-foreground")
                              }
                            >
                              {item}
                            </span>
                          </button>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="bg-navy-700 border-navy-500">
                      <CardContent className="pt-5 space-y-4">
                        {showRejectInput && (
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-foreground">
                              Rejection Reason{" "}
                              <span className="text-gold-400">*</span>
                            </label>
                            <textarea
                              value={rejectionReason}
                              onChange={(e) =>
                                setRejectionReason(e.target.value)
                              }
                              placeholder="Provide a clear, detailed reason for rejection..."
                              rows={3}
                              className="w-full bg-navy-800 border border-navy-500 text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 resize-none"
                            />
                          </div>
                        )}
                        <div className="flex gap-3">
                          {showRejectInput ? (
                            <>
                              <Button
                                onClick={() => setShowRejectInput(false)}
                                variant="outline"
                                className="flex-1 border-navy-400 text-foreground hover:bg-navy-600"
                                disabled={isSubmitting}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => handleVerify(false)}
                                disabled={
                                  isSubmitting || !rejectionReason.trim()
                                }
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white border-0"
                              >
                                {isSubmitting ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                  <XCircle className="w-4 h-4 mr-2" />
                                )}
                                Confirm Rejection
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                onClick={() => setShowRejectInput(true)}
                                variant="outline"
                                className="flex-1 border-red-500/40 text-red-400 hover:bg-red-500/10"
                                disabled={isSubmitting}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject
                              </Button>
                              <Button
                                onClick={() => handleVerify(true)}
                                disabled={isSubmitting || !allChecked}
                                className="flex-1 text-navy-900 font-semibold"
                                style={{
                                  background:
                                    "linear-gradient(135deg,#D4AF37 0%,#8C7020 100%)",
                                }}
                              >
                                {isSubmitting ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                )}
                                Approve Verification
                              </Button>
                            </>
                          )}
                        </div>
                        {!allChecked && (
                          <p className="text-xs text-center text-amber-400">
                            Complete all {CHECKLIST.length} checklist items
                            before approving.
                          </p>
                        )}
                        {!account && (
                          <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-semibold mb-1">
                                Wallet required for verification
                              </p>
                              <p className="mb-2">
                                You must connect your MetaMask wallet to verify
                                or reject a property on-chain.
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-400 border-red-500/40 hover:bg-red-500/10 h-7 text-xs"
                                onClick={connectWallet}
                              >
                                Connect Wallet
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}

                {(selected.status === "verified" ||
                  selected.status === "rejected") && (
                  <Card className="bg-navy-700 border-navy-500">
                    <CardContent className="pt-5">
                      {selected.status === "verified" ? (
                        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400">
                          <CheckCircle className="w-5 h-5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-sm">
                              Property Verified
                            </p>
                            {selected.verifiedAt && (
                              <p className="text-xs text-green-400/70 mt-0.5">
                                Verified on{" "}
                                {new Date(
                                  selected.verifiedAt,
                                ).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                          <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-sm">
                              Property Rejected
                            </p>
                            {selected.rejectionReason && (
                              <p className="text-xs text-red-400/70 mt-1">
                                Reason: {selected.rejectionReason}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
