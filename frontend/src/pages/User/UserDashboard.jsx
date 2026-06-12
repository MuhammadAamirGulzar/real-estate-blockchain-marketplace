import { config } from "@/config/environment";
import AssetRegistryABI from "@/contracts/abi/AssetRegistry.json";
import KYCRegistryABI from "@/contracts/abi/KYCRegistry.json";
import api from "@/services/api";
import { ethers } from "ethers";
import {
  Clock,
  File,
  FileText,
  Shield,
  Upload,
  User,
  X
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Header from "../../components/layout/Header";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { useAuth } from "../../contexts/AuthContext";
import { useWallet } from "../../contexts/WalletContext";

// Simple tabs implementation
const Tabs = ({ defaultValue, className, children }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);
  return (
    <div className={className}>
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { activeTab, setActiveTab }),
      )}
    </div>
  );
};

const TabsList = ({ className, children, activeTab, setActiveTab }) => (
  <div className={`flex ${className}`}>
    {React.Children.map(children, (child) =>
      React.cloneElement(child, { activeTab, setActiveTab }),
    )}
  </div>
);

const TabsTrigger = ({ value, children, activeTab, setActiveTab }) => (
  <button
    className={`px-4 py-2 rounded-lg transition-colors ${
      activeTab === value
        ? "bg-primary text-primary-foreground"
        : "bg-muted text-muted-foreground hover:bg-muted/80"
    }`}
    onClick={() => setActiveTab(value)}
  >
    {children}
  </button>
);

const TabsContent = ({ value, children, activeTab }) => {
  if (activeTab !== value) return null;
  return <div>{children}</div>;
};

// File Upload Component with Preview
const FileUploadBox = ({
  label,
  accept,
  onChange,
  file,
  onRemove,
  required = false,
  description,
}) => {
  const fileInputRef = React.useRef(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      onChange(selectedFile);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="space-y-2">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      <div
        className="p-6 text-center transition-colors border-2 border-dashed rounded-lg cursor-pointer border-border hover:border-primary"
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          required={required}
        />

        {file ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3 p-3 rounded-lg bg-primary/10">
              <File className="flex-shrink-0 w-8 h-8 text-primary" />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium truncate text-foreground">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="p-1 transition-colors rounded-full hover:bg-destructive/10"
              >
                <X className="w-4 h-4 text-destructive" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Click to change file
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Click to upload or drag and drop
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {accept
                  ? `Accepted formats: ${accept}`
                  : "All file types accepted"}
              </p>
              <p className="text-xs text-muted-foreground">
                Maximum file size: 10MB
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function UserDashboard() {
  const { user } = useAuth();
  const wallet = useWallet();
  const { account, walletAddress, isConnected, connectWallet, signer } =
    wallet;
  const navigate = useNavigate();

  // Verifier Form State
  const [verifierForm, setVerifierForm] = useState({
    experience: "",
    qualifications: "",
    specialization: "",
    documents: null,
  });

  // Property Form State
  const [propertyForm, setPropertyForm] = useState({
    title: "",
    description: "",
    location: "",
    value: "",
    propertyType: "",
    documents: null,
  });

  const [loading, setLoading] = useState(false);
  const [userStats, setUserStats] = useState({
    kycStatus: "unknown",
    verifierStatus: "none",
    properties: 0,
    investments: 0,
  });
  const [userProperties, setUserProperties] = useState([]);

  useEffect(() => {
    fetchUserStats();
    fetchUserProperties();
  }, []);

  const fetchUserProperties = async () => {
    try {
      const res = await api.get("/user/properties");
      const rows = res?.data?.data || [];
      setUserProperties(rows);
    } catch (err) {
      console.warn("Could not load user properties:", err.message);
    }
  };

  const fetchUserStats = async () => {
    try {
      console.log("📤 Fetching user stats via API client...");
      const res = await api.get("/user/stats");
      // Backend returns { success, data: { ... } }
      const payload = res?.data?.data || {};
      setUserStats({
        kycStatus:
          typeof payload.kycStatus === "string" ? payload.kycStatus : "unknown",
        verifierStatus:
          typeof payload.verifierStatus === "string"
            ? payload.verifierStatus
            : "none",
        properties: Number.isFinite(payload.properties)
          ? payload.properties
          : 0,
        investments: Number.isFinite(payload.investments)
          ? payload.investments
          : 0,
      });
      console.log("✅ Stats received:", payload);
    } catch (error) {
      console.error("❌ Error fetching user stats:", error);
      const message =
        error?.response?.data?.message || "Failed to load dashboard data";
      toast.error(message);
      // keep safe defaults
      setUserStats((prev) => ({
        ...prev,
        kycStatus: prev.kycStatus || "unknown",
      }));
    }
  };

  // Handle Verifier Application
  const handleVerifierApplication = async (e) => {
    e.preventDefault();

    console.log("\n🎯 handleVerifierApplication called");
    console.log("Wallet state:", { isConnected, hasSigner: !!signer, account });

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

    if (!verifierForm.documents) {
      toast.error("Please upload supporting documents");
      return;
    }

    console.log("✅ Starting verifier application submission");
    setLoading(true);
    const loadingToast = toast.loading(
      "Uploading documents to IPFS and submitting application...",
    );

    try {
      const token = localStorage.getItem("authToken");

      if (!token) {
        toast.error("Please log in again", { id: loadingToast });
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("experience", verifierForm.experience);
      formData.append("qualifications", verifierForm.qualifications);
      formData.append("specialization", verifierForm.specialization);
      formData.append("walletAddress", account);
      formData.append("documents", verifierForm.documents);

      console.log("📤 Step 1: Uploading documents to backend/IPFS...");

      // Step 1: Submit to backend (uploads to IPFS and stores in DB)
      const response = await api.post("/user/apply-verifier", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("📥 Backend response:", response.data);

      if (!response.data.success) {
        console.error("❌ Backend submission failed:", response.data);
        toast.error(response.data.message || "Failed to submit application", {
          id: loadingToast,
        });
        setLoading(false);
        return;
      }

      const { documentsHash, data: appData } = response.data;
      console.log("✅ Documents uploaded, IPFS hash:", documentsHash);
      console.log("📋 Application data:", appData);

      // Step 2: Submit to blockchain
      console.log("⛓️ Step 2: Submitting to blockchain...");
      toast.loading("Please sign the transaction...", {
        id: loadingToast,
      });

      // Validate contract address
      const kycRegistryAddress = config.contracts.kycRegistry;
      console.log("Contract address:", kycRegistryAddress);

      if (!kycRegistryAddress || kycRegistryAddress === "") {
        throw new Error(
          "KYC Registry contract address not configured. Please deploy contracts first.",
        );
      }

      // Validate address format
      let validAddress;
      try {
        validAddress = ethers.getAddress(kycRegistryAddress);
      } catch (error) {
        throw new Error(
          `Invalid KYC Registry contract address: ${kycRegistryAddress}`,
        );
      }

      console.log("Using KYC Registry at:", validAddress);

      const kycContract = new ethers.Contract(
        validAddress,
        KYCRegistryABI.abi,
        signer,
      );

      console.log(
        "📝 Calling contract.applyForVerifier with hash:",
        documentsHash,
      );
      const tx = await kycContract.applyForVerifier(documentsHash);
      console.log("✅ Transaction sent:", tx.hash);

      toast.loading("Waiting for blockchain confirmation...", {
        id: loadingToast,
      });

      console.log("⏳ Waiting for transaction confirmation...");
      const receipt = await tx.wait();
      console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

      // Step 3: Update backend with transaction hash
      console.log("📤 Step 3: Updating backend with transaction hash...");
      await api.post("/user/update-verifier-tx", {
        applicationId: appData.applicationId,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });
      console.log("✅ Backend updated successfully");

      toast.success(
        "Verifier application submitted successfully! Pending admin approval.",
        { id: loadingToast },
      );

      // Reset form
      setVerifierForm({
        experience: "",
        qualifications: "",
        specialization: "",
        documents: null,
      });

      // Refresh stats
      fetchUserStats();
      fetchUserProperties();
    } catch (error) {
      console.error("❌ Error submitting verifier application:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        response: error.response?.data,
      });

      // Cleanup database if blockchain transaction failed
      try {
        console.log("🧹 Cleaning up failed submission...");
        await api.post("/user/verifier-tx-failed", {
          reason: error.message || "Transaction reverted",
        });
      } catch (cleanupError) {
        console.error("Failed to cleanup verifier application:", cleanupError);
      }

      // Handle specific blockchain errors
      if (error.code === "ACTION_REJECTED" || error.code === 4001) {
        toast.error("Transaction rejected by user", { id: loadingToast });
      } else if (error.message?.includes("already applied")) {
        toast.error("Verifier application already submitted on-chain", {
          id: loadingToast,
        });
      } else {
        toast.error(
          error.response?.data?.message ||
            error.message ||
            "Error submitting application",
          { id: loadingToast },
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Property Submission
  const handlePropertySubmission = async (e) => {
    e.preventDefault();

    console.log("\n🎯 handlePropertySubmission called");
    console.log("Wallet state:", { isConnected, hasSigner: !!signer, account });
    console.log("KYC Status:", userStats.kycStatus);

    // Check KYC status first
    if (userStats.kycStatus !== "approved") {
      console.error("❌ KYC check failed - status:", userStats.kycStatus);
      toast.error(
        "You must complete and have your KYC approved before submitting properties",
      );
      return;
    }

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

    if (!propertyForm.documents) {
      toast.error("Please upload property documents");
      return;
    }

    console.log("✅ Starting property submission");
    setLoading(true);
    const loadingToast = toast.loading(
      "Uploading documents to IPFS and submitting property...",
    );

    try {
      const token = localStorage.getItem("authToken");

      if (!token) {
        toast.error("Please log in again", { id: loadingToast });
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("title", propertyForm.title);
      formData.append("description", propertyForm.description);
      formData.append("location", propertyForm.location);
      formData.append("value", propertyForm.value);
      formData.append("propertyType", propertyForm.propertyType);
      formData.append("walletAddress", account);
      formData.append("documents", propertyForm.documents);

      console.log("📤 Step 1: Uploading documents to backend/IPFS...");
      console.log(
        "📎 File:",
        propertyForm.documents.name,
        propertyForm.documents.size,
      );

      // Step 1: Submit to backend (uploads to IPFS and stores in DB)
      const response = await api.post("/user/submit-property", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("📥 Backend response:", response.data);

      if (!response.data.success) {
        console.error("❌ Backend submission failed:", response.data);
        toast.error(response.data.message || "Failed to submit property", {
          id: loadingToast,
        });
        setLoading(false);
        return;
      }

      const { metadataHash, data: propData } = response.data;
      console.log("✅ Documents uploaded, IPFS metadata hash:", metadataHash);
      console.log("📋 Property data:", propData);

      // Step 2: Submit to blockchain
      console.log("⛓️ Step 2: Submitting to blockchain...");
      toast.loading("Please sign the transaction...", {
        id: loadingToast,
      });

      // Validate contract address
      const assetRegistryAddress = config.contracts.assetRegistry;
      console.log("Contract address:", assetRegistryAddress);

      if (!assetRegistryAddress || assetRegistryAddress === "") {
        throw new Error(
          "AssetRegistry contract address not configured. Please deploy contracts first.",
        );
      }

      // Validate address format
      let validAddress;
      try {
        validAddress = ethers.getAddress(assetRegistryAddress);
      } catch (error) {
        throw new Error(
          `Invalid AssetRegistry contract address: ${assetRegistryAddress}`,
        );
      }

      console.log("Using AssetRegistry at:", validAddress);

      const assetRegistryContract = new ethers.Contract(
        validAddress,
        AssetRegistryABI.abi,
        signer,
      );

      console.log("📝 Calling contract.listProperty with hash:", metadataHash);
      const tx = await assetRegistryContract.listProperty(metadataHash);
      console.log("✅ Transaction sent:", tx.hash);

      toast.loading("Waiting for blockchain confirmation...", {
        id: loadingToast,
      });

      console.log("⏳ Waiting for transaction confirmation...");
      const receipt = await tx.wait();
      console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

      // Extract propertyId from PropertyListed event
      let assetRegistryId = null;
      try {
        const propertyListedEvent = receipt.logs.find((log) => {
          try {
            const parsed = assetRegistryContract.interface.parseLog(log);
            return parsed && parsed.name === "PropertyListed";
          } catch (e) {
            return false;
          }
        });

        if (propertyListedEvent) {
          const parsed =
            assetRegistryContract.interface.parseLog(propertyListedEvent);
          assetRegistryId = parsed.args.propertyId
            ? Number(parsed.args.propertyId)
            : null;
          console.log(
            "✅ Property registered on blockchain with ID:",
            assetRegistryId,
          );
        }
      } catch (eventError) {
        console.warn(
          "⚠️ Could not extract property ID from event:",
          eventError,
        );
      }

      // Step 3: Update backend with transaction hash
      console.log("📤 Step 3: Updating backend with transaction hash...");
      await api.post("/user/update-property-tx", {
        propertyId: propData.propertyId,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        assetRegistryId: assetRegistryId,
      });
      console.log("✅ Backend updated successfully");

      toast.success(
        "Property submitted successfully! Awaiting admin to assign a verifier.",
        {
          id: loadingToast,
        },
      );

      // Reset form
      setPropertyForm({
        title: "",
        description: "",
        location: "",
        value: "",
        propertyType: "",
        documents: null,
      });

      // Refresh stats
      fetchUserStats();
      fetchUserProperties();
    } catch (error) {
      console.error("❌ Error submitting property:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        data: error.data,
        response: error.response?.data,
      });

      // Cleanup database if blockchain transaction failed
      try {
        console.log("🧹 Cleaning up failed submission...");
        await api.post("/user/property-tx-failed", {
          reason: error.message || "Transaction reverted",
        });
      } catch (cleanupError) {
        console.error("Failed to cleanup property submission:", cleanupError);
      }

      // Handle specific blockchain errors
      if (error.code === "ACTION_REJECTED" || error.code === 4001) {
        toast.error("Transaction rejected by user", { id: loadingToast });
      } else if (
        error.data === "0x83855724" ||
        error.message?.includes("0x83855724")
      ) {
        toast.error(
          "This property has already been submitted. Each property can only be listed once.",
          { id: loadingToast },
        );
      } else if (
        error.message?.includes("KYCRequired") ||
        error.message?.includes("KYC")
      ) {
        toast.error(
          "You must have approved KYC before submitting properties. Please complete KYC first.",
          { id: loadingToast },
        );
      } else {
        toast.error(
          error.response?.data?.message ||
            error.message ||
            "Error submitting property",
          { id: loadingToast },
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Safely normalize a status-like value
  const normalizeStatus = (val, fallback = "unknown") => {
    if (typeof val === "string" && val.trim()) return val.trim().toLowerCase();
    return fallback;
  };

  const toTitle = (val, fallback = "Unknown") => {
    if (typeof val !== "string") return fallback;
    const s = val.trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : fallback;
  };

  // Replace your existing getStatusBadge with this safe version
  const getStatusBadge = (statusInput) => {
    const status = normalizeStatus(statusInput);
    const label = toTitle(status);

    const colorMap = {
      // positive
      approved: "green",
      verified: "green",
      active: "green",
      tokenized: "green",
      completed: "green",
      // in-progress
      pending: "yellow",
      pending_assignment: "yellow",
      awaiting_blockchain: "yellow",
      verification_pending: "yellow",
      under_review: "yellow",
      // negative
      rejected: "red",
      failed: "red",
      // neutral
      none: "gray",
      unknown: "gray",
      not_submitted: "gray",
    };
    const color = colorMap[status] || "gray";

    return <span className={`badge badge-${color}`}>{label}</span>;
  };

  const linkedWalletAddress = account || walletAddress || user?.walletAddress;
  const walletReady = Boolean(linkedWalletAddress);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-4 py-8 mx-auto space-y-8 animate-fade-in">
        {!walletReady && (
          <div className="alert alert-warning">
            Connect your wallet to link it with your account.
            <button
              className="btn btn-primary btn-sm"
              onClick={() => wallet.connectWallet(true)}
            >
              Connect Wallet
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <Card className="transition-shadow hover:shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">KYC Status</p>
                  <div className="mt-2">
                    {getStatusBadge(userStats.kycStatus)}
                  </div>
                </div>
                <FileText className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="transition-shadow hover:shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Verifier Status
                  </p>
                  <div className="mt-2">
                    {getStatusBadge(userStats.verifierStatus)}
                  </div>
                </div>
                <Shield className="w-8 h-8 text-secondary" />
              </div>
            </CardContent>
          </Card>

          <Card className="transition-shadow hover:shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Properties</p>
                  <p className="text-2xl font-bold text-foreground">
                    {userStats.properties}
                  </p>
                </div>
                <FileText className="w-8 h-8 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card className="transition-shadow hover:shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Investments</p>
                  <p className="text-2xl font-bold text-foreground">
                    {userStats.investments}
                  </p>
                </div>
                <User className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 gap-2 p-2 border rounded-lg bg-card">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="verifier">Become Verifier</TabsTrigger>
            <TabsTrigger value="properties">Submit Property</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Account Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label>Email</Label>
                    <p className="text-foreground">{user?.email}</p>
                  </div>
                  <div>
                    <Label>Wallet Address</Label>
                    <p className="font-mono text-sm text-foreground">
                      {linkedWalletAddress || "Not connected"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verifier" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Verifier Application Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-3">
                  {getStatusBadge(userStats.verifierStatus)}
                  <span className="text-sm text-muted-foreground">
                    {userStats.verifierStatus === "approved" &&
                      "You are now a verified property verifier"}
                    {userStats.verifierStatus === "pending" &&
                      "Your application is under review"}
                    {userStats.verifierStatus === "rejected" &&
                      "Please resubmit your application"}
                    {userStats.verifierStatus === "none" &&
                      "Submit your application to become a verifier"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {userStats.verifierStatus !== "approved" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Apply to Become a Verifier
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={handleVerifierApplication}
                    className="space-y-6"
                  >
                    <div>
                      <Label htmlFor="specialization">
                        Area of Specialization *
                      </Label>
                      <select
                        id="specialization"
                        value={verifierForm.specialization}
                        onChange={(e) =>
                          setVerifierForm((prev) => ({
                            ...prev,
                            specialization: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 mt-1 border rounded-md border-input focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                      >
                        <option value="">Select specialization</option>
                        <option value="Residential Properties">
                          Residential Properties
                        </option>
                        <option value="Commercial Real Estate">
                          Commercial Real Estate
                        </option>
                        <option value="Property Valuation">
                          Property Valuation
                        </option>
                        <option value="Industrial Properties">
                          Industrial Properties
                        </option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="experience">
                        Professional Experience *
                      </Label>
                      <Textarea
                        id="experience"
                        placeholder="Describe your relevant experience in real estate, property valuation, or related fields..."
                        value={verifierForm.experience}
                        onChange={(e) =>
                          setVerifierForm((prev) => ({
                            ...prev,
                            experience: e.target.value,
                          }))
                        }
                        required
                        rows={4}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="qualifications">
                        Qualifications & Certifications *
                      </Label>
                      <Textarea
                        id="qualifications"
                        placeholder="List your relevant qualifications, certifications, and educational background..."
                        value={verifierForm.qualifications}
                        onChange={(e) =>
                          setVerifierForm((prev) => ({
                            ...prev,
                            qualifications: e.target.value,
                          }))
                        }
                        required
                        rows={3}
                        className="mt-1"
                      />
                    </div>

                    <FileUploadBox
                      label="Supporting Documents"
                      description="Upload certificates, CV, or other supporting documents (PDF, DOC, DOCX, JPG, PNG - Max 10MB)"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      file={verifierForm.documents}
                      onChange={(file) =>
                        setVerifierForm((prev) => ({
                          ...prev,
                          documents: file,
                        }))
                      }
                      onRemove={() =>
                        setVerifierForm((prev) => ({
                          ...prev,
                          documents: null,
                        }))
                      }
                      required
                    />

                    <Button
                      type="submit"
                      disabled={loading || !isConnected}
                      className="w-full"
                    >
                      {loading ? (
                        <>
                          <Clock className="w-4 h-4 mr-2 animate-spin" />
                          Submitting Application...
                        </>
                      ) : (
                        <>
                          <Shield className="w-4 h-4 mr-2" />
                          Submit Verifier Application
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="properties" className="space-y-6">
            {/* Submit button */}
            <Card>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="font-semibold text-foreground">
                    List a New Property
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Submit a property for on-chain tokenization
                  </p>
                </div>
                <Button
                  onClick={() => navigate("/user/property-submission")}
                  className="flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Submit New Property
                </Button>
              </CardContent>
            </Card>

            {/* Submissions list */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  My Submissions ({userProperties.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {userProperties.length === 0 ? (
                  <div className="py-10 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No properties submitted yet.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Use the button above to list your first property.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {userProperties.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between py-4"
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="font-medium truncate text-foreground">
                            {p.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.city || p.location || "—"} &bull;{" "}
                            {p.propertyType || "Property"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Submitted:{" "}
                            {new Date(p.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {p.propertyValue && (
                            <span className="text-sm font-semibold text-foreground">
                              ${Number(p.propertyValue).toLocaleString()}
                            </span>
                          )}
                          {getStatusBadge(p.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card style={{ display: "none" }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Submit New Property
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePropertySubmission} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <Label htmlFor="title">Property Title *</Label>
                      <Input
                        id="title"
                        placeholder="e.g., Luxury Villa in Miami"
                        value={propertyForm.title}
                        onChange={(e) =>
                          setPropertyForm((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                        required
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="propertyType">Property Type *</Label>
                      <select
                        id="propertyType"
                        value={propertyForm.propertyType}
                        onChange={(e) =>
                          setPropertyForm((prev) => ({
                            ...prev,
                            propertyType: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 mt-1 border rounded-md border-input focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                      >
                        <option value="">Select type</option>
                        <option value="Residential">Residential</option>
                        <option value="Commercial">Commercial</option>
                        <option value="Industrial">Industrial</option>
                        <option value="Land">Land</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="location">Location *</Label>
                    <Input
                      id="location"
                      placeholder="e.g., 123 Main St, Miami, FL 33101"
                      value={propertyForm.location}
                      onChange={(e) =>
                        setPropertyForm((prev) => ({
                          ...prev,
                          location: e.target.value,
                        }))
                      }
                      required
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="value">Property Value (USD) *</Label>
                    <Input
                      id="value"
                      type="number"
                      placeholder="e.g., 500000"
                      value={propertyForm.value}
                      onChange={(e) =>
                        setPropertyForm((prev) => ({
                          ...prev,
                          value: e.target.value,
                        }))
                      }
                      required
                      min="0"
                      step="0.01"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Property Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="Provide detailed description of the property, including size, amenities, condition, etc..."
                      value={propertyForm.description}
                      onChange={(e) =>
                        setPropertyForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      required
                      rows={4}
                      className="mt-1"
                    />
                  </div>

                  <FileUploadBox
                    label="Property Documents"
                    description="Upload title deed, survey reports, photographs, or other relevant documents (PDF, DOC, DOCX, JPG, PNG - Max 10MB)"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    file={propertyForm.documents}
                    onChange={(file) =>
                      setPropertyForm((prev) => ({ ...prev, documents: file }))
                    }
                    onRemove={() =>
                      setPropertyForm((prev) => ({ ...prev, documents: null }))
                    }
                    required
                  />

                  <Button
                    type="submit"
                    disabled={loading || !isConnected}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Submitting Property...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Submit Property for Tokenization
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default UserDashboard;
