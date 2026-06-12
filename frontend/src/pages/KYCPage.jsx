import { ethers } from "ethers";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Wallet,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import KYCFlow from "../components/kyc/KYCFlow";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { config } from "../config/environment";
import { useAuth } from "../contexts/AuthContext";
import { useWallet } from "../contexts/WalletContext";
import KYCRegistryABI from "../contracts/abi/KYCRegistry.json";
import api from "../services/api";

const KYCPage = () => {
  const { user } = useAuth();
  const { isConnected, connectWallet, signer } = useWallet();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [rejectionReason, setRejectionReason] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStep, setSubmissionStep] = useState("");

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/user/dashboard");
  };

  useEffect(() => {
    fetchKYCStatus();
  }, [user]);

  const fetchKYCStatus = async () => {
    try {
      const response = await api.get("/user/kyc-status");
      if (response.data.success) {
        const kycData = response.data.data;
        const resolvedStatus =
          kycData?.blockchainVerified || kycData?.userStatus === "approved"
            ? "approved"
            : kycData?.status || "not_submitted";

        setStatus(resolvedStatus);
        if (resolvedStatus === "rejected") {
          setRejectionReason(kycData.rejectionReason);
        }
      }
    } catch (error) {
      console.error("Error fetching KYC status:", error);
      setStatus("not_submitted");
    }
  };

  const handleKYCSubmit = async (formData) => {
    console.log("\n🎯 handleKYCSubmit called in KYCPage");
    console.log("Wallet connection status:", {
      isConnected,
      hasSigner: !!signer,
      account: signer ? "present" : "missing",
    });

    if (!isConnected || !signer) {
      console.error(
        "❌ Wallet check failed - isConnected:",
        isConnected,
        "signer:",
        !!signer,
      );
      toast.error("Please connect your wallet first");
      return;
    }

    console.log("✅ Wallet validated, proceeding with KYC submission");
    setIsSubmitting(true);
    try {
      // Step 1: Upload to Backend/IPFS
      setSubmissionStep("uploading");
      console.log("📤 Step 1: Uploading documents to backend/IPFS...");
      toast.loading("Uploading documents...", { id: "kyc-upload" });

      const response = await api.post("/user/submit-kyc", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("📥 Backend response:", response.data);

      if (!response.data.success) {
        throw new Error("Failed to upload KYC documents");
      }

      const { documentHash } = response.data;
      console.log("✅ Documents uploaded, hash:", documentHash);
      toast.success("Documents uploaded!", { id: "kyc-upload" });

      // Step 2: Submit to Blockchain
      setSubmissionStep("signing");
      console.log("⛓️ Step 2: Submitting to blockchain...");
      toast.loading("Please sign the transaction...", { id: "kyc-tx" });

      // Validate contract address
      const kycRegistryAddress = config.contracts.kycRegistry;
      console.log("Contract address:", kycRegistryAddress);
      if (!kycRegistryAddress || kycRegistryAddress === "") {
        throw new Error(
          "KYC Registry contract address not configured. Please deploy contracts first.",
        );
      }

      // Validate address format (checksummed)
      let validAddress;
      try {
        validAddress = ethers.getAddress(kycRegistryAddress);
      } catch (error) {
        throw new Error(
          `Invalid KYC Registry contract address: ${kycRegistryAddress}`,
        );
      }

      console.log("Using KYC Registry at:", validAddress);

      const contract = new ethers.Contract(
        validAddress,
        KYCRegistryABI.abi,
        signer,
      );

      console.log("📝 Calling contract.submitKYC with hash:", documentHash);
      const tx = await contract.submitKYC(documentHash);
      console.log("✅ Transaction sent:", tx.hash);

      setSubmissionStep("confirming");
      toast.loading("Waiting for blockchain confirmation...", {
        id: "kyc-tx",
      });

      console.log("⏳ Waiting for transaction confirmation...");
      const receipt = await tx.wait();
      console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

      // Step 3: Update backend with transaction hash
      console.log("📤 Step 3: Updating backend with transaction hash...");
      await api.post("/user/update-kyc-tx", {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });
      console.log("✅ Backend updated successfully");

      toast.success("KYC Submitted Successfully!", { id: "kyc-tx" });

      // Refresh status
      await fetchKYCStatus();
    } catch (error) {
      console.error("❌ Error submitting KYC:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        response: error.response?.data,
      });

      // Cleanup database if blockchain transaction failed
      try {
        console.log("🧹 Cleaning up failed submission...");
        await api.post("/user/kyc-tx-failed", {
          reason: error.message || "Transaction reverted",
        });
      } catch (cleanupError) {
        console.error("Failed to cleanup KYC submission:", cleanupError);
      }

      // Handle specific blockchain errors
      if (error.code === "ACTION_REJECTED") {
        toast.error("Transaction rejected by user", { id: "kyc-tx" });
      } else if (error.message?.includes("already submitted")) {
        toast.error("KYC already submitted on-chain", { id: "kyc-tx" });
      } else {
        toast.error(
          error.response?.data?.message ||
            error.message ||
            "Failed to submit KYC application",
          { id: "kyc-tx" },
        );
      }
    } finally {
      setIsSubmitting(false);
      setSubmissionStep("");
    }
  };

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl px-4 py-8 mx-auto">
      <Button
        variant="outline"
        onClick={handleBack}
        className="mb-6 inline-flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          Identity Verification
        </h1>
        <p className="mt-2 text-muted-foreground">
          Complete your KYC verification to participate in RWA investment
          opportunities.
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">
              Verification Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {status === "approved" && (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="font-medium text-green-700">Verified</span>
                  </>
                )}
                {status === "pending" && (
                  <>
                    <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
                    <span className="font-medium text-yellow-700">
                      Under Review
                    </span>
                  </>
                )}
                {status === "rejected" && (
                  <>
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="font-medium text-red-700">Rejected</span>
                  </>
                )}
                {status === "not_submitted" && (
                  <>
                    <AlertCircle className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium text-foreground">
                      Not Verified
                    </span>
                  </>
                )}
              </div>
              <Badge
                variant={
                  status === "approved"
                    ? "success"
                    : status === "rejected"
                      ? "destructive"
                      : "secondary"
                }
              >
                {status.toUpperCase()}
              </Badge>
            </div>
            {status === "rejected" && rejectionReason && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="w-4 h-4" />
                <AlertTitle>Rejection Reason</AlertTitle>
                <AlertDescription>{rejectionReason}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {!isConnected || !signer ? (
          <Card className="border-amber-500/30 bg-amber-500/10">
            <CardContent className="pt-6 text-center">
              <Wallet className="w-12 h-12 mx-auto mb-4 text-amber-400" />
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                Wallet Connection Required
              </h3>
              <p className="mb-6 text-muted-foreground">
                Please connect your wallet to proceed with identity
                verification.
              </p>
              <Button onClick={connectWallet}>
                {isConnected && !signer
                  ? "Reconnect Wallet (Signer Missing)"
                  : "Connect Wallet"}
              </Button>
            </CardContent>
          </Card>
        ) : isSubmitting ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
              <h3 className="text-xl font-semibold">Processing Application</h3>
              <p className="mt-2 text-muted-foreground">
                {submissionStep === "uploading" &&
                  "Uploading documents securely..."}
                {submissionStep === "signing" &&
                  "Please sign the transaction in your wallet..."}
                {submissionStep === "confirming" &&
                  "Waiting for blockchain confirmation..."}
              </p>
            </CardContent>
          </Card>
        ) : status === "not_submitted" || status === "rejected" ? (
          <KYCFlow onComplete={handleKYCSubmit} />
        ) : status === "approved" ? (
          <Card>
            <CardContent className="py-12 pt-6 text-center">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-primary/15 rounded-full">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">
                KYC Verified
              </h3>
              <p className="max-w-md mx-auto text-muted-foreground">
                Your identity verification is complete and approved. You can now
                access all KYC-gated platform features.
              </p>
            </CardContent>
          </Card>
        ) : status === "pending" ? (
          <Card>
            <CardContent className="py-12 pt-6 text-center">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-primary/15 rounded-full">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">
                Application Submitted
              </h3>
              <p className="max-w-md mx-auto text-muted-foreground">
                Your KYC application is currently under review. We will notify
                you once the verification process is complete.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 pt-6 text-center">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-primary/15 rounded-full">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">
                Application Submitted
              </h3>
              <p className="max-w-md mx-auto text-muted-foreground">
                Your KYC application is currently under review. We will notify
                you once the verification process is complete.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default KYCPage;
