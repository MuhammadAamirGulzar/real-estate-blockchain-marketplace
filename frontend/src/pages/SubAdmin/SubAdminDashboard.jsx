import { ethers } from "ethers";
import {
  Building2,
  CheckCircle,
  LogOut,
  Settings,
  Shield,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const SubAdminDashboard = () => {
  const { user, logout } = useAuth();
  const { account, isConnected, connectWallet, signer } = useWallet();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    kyc: { pending: 0 },
    properties: { active: 0 },
    totalVerifiers: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kycRequests, setKycRequests] = useState([]);
  const [properties, setProperties] = useState([]);
  const [verifiers, setVerifiers] = useState([]);

  useEffect(() => {
    fetchDashboardStats();
    fetchKycRequests();
    fetchProperties();
    fetchVerifiers();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const { data } = await api.get("/admin/dashboard-stats");
      setStats({
        totalUsers: data.totalUsers || 0,
        kyc: { pending: data.pendingKYC || 0 },
        properties: { active: data.totalProperties || 0 },
        totalVerifiers: data.activeVerifiers || 0,
      });
      setRecentActivity(data.recentActivity || []);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      toast.error("Failed to fetch dashboard stats");
    } finally {
      setLoading(false);
    }
  };

  const fetchKycRequests = async () => {
    try {
      const { data } = await api.get("/admin/kyc-requests");
      const validRequests = (data.data || []).filter(
        (req) => req.walletAddress,
      );
      setKycRequests(validRequests);
    } catch (error) {
      console.error("Error fetching KYC requests:", error);
    }
  };

  const fetchProperties = async () => {
    try {
      const { data } = await api.get("/admin/properties");
      setProperties(data.properties || []);
    } catch (error) {
      console.error("Error fetching properties:", error);
    }
  };

  const fetchVerifiers = async () => {
    try {
      const { data } = await api.get("/admin/verifiers");
      setVerifiers(data.data || []);
    } catch (error) {
      console.error("Error fetching verifiers:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Signed out");
      navigate("/login");
    } catch (error) {
      console.error("Logout failed", error);
      toast.error("Logout failed");
    }
  };

  const handleKycAction = async (kycId, action, targetWallet) => {
    if (!isConnected || !signer) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      // 1. Perform On-Chain Action
      const contract = new ethers.Contract(
        config.contracts.kycRegistry,
        KYCRegistryABI.abi,
        signer,
      );

      let txHash = null;
      try {
        let tx;
        if (action === "approve") {
          tx = await contract.approveKYC(targetWallet);
        } else if (action === "reject") {
          tx = await contract.rejectKYC(targetWallet);
        }

        toast.loading(`Processing ${action} on blockchain...`, {
          id: "kyc-action",
        });
        await tx.wait();
        txHash = tx.hash;
        toast.success(`KYC ${action}d on blockchain!`, { id: "kyc-action" });
      } catch (contractError) {
        console.error("Contract Error:", contractError);

        const isNotPending =
          contractError.reason === "KYC not pending" ||
          contractError.message.includes("KYC not pending") ||
          contractError.data?.includes("f4b59432");

        if (isNotPending) {
          if (action === "reject") {
            // Allow rejecting in DB even if not on chain
            toast("User not on-chain. Rejecting in database...", {
              icon: "⚠️",
            });
            txHash = "OFFCHAIN_REJECTION";
          } else {
            toast.error("Cannot Approve: User has not submitted KYC on-chain.");
            return;
          }
        } else if (contractError.code === "ACTION_REJECTED") {
          toast.error("Transaction rejected by subadmin.");
          return;
        } else {
          throw contractError;
        }
      }

      // 2. Sync with Backend
      const message = `Action: ${action}_kyc\nTarget ID: ${kycId}\nTimestamp: ${Date.now()}`;
      const signature = await signer.signMessage(message);

      await api.post(`/admin/kyc/${kycId}/${action}`, {
        walletAddress: account,
        signature,
        message,
        txHash: txHash,
      });

      toast.success(`Database updated successfully`);
      fetchKycRequests();
      fetchDashboardStats();
    } catch (error) {
      console.error(error);
      toast.error(
        `Error: ${error.reason || error.message || "Transaction failed"}`,
      );
    }
  };

  const handleAssignVerifier = async (propertyId, verifierId) => {
    if (!isConnected || !signer) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      const message = `Action: assign_verifier\nTarget ID: ${propertyId}\nTimestamp: ${Date.now()}`;
      const signature = await signer.signMessage(message);

      await api.post(`/admin/property/${propertyId}/assign-verifier`, {
        verifierId,
        walletAddress: account,
        signature,
        message,
      });

      toast.success("Verifier assigned successfully");
      fetchProperties();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Error assigning verifier");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 border-4 rounded-full border-primary border-t-transparent animate-spin"></div>
          <p className="text-lg font-medium text-foreground">
            Loading subadmin dashboard...
          </p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Users",
      value: stats?.totalUsers || 0,
      change: "+12%",
      icon: Users,
    },
    {
      title: "Pending KYC",
      value: stats?.kyc?.pending || 0,
      change: "-5%",
      icon: UserCheck,
    },
    {
      title: "Active Properties",
      value: stats?.properties?.active || 0,
      change: "+8%",
      icon: Building2,
    },
    {
      title: "Total Verifiers",
      value: stats?.totalVerifiers || 0,
      change: "+3%",
      icon: Shield,
    },
  ];

  return (
    <main className="py-8 space-y-8 container-max animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-secondary rounded-xl">
              <Settings className="w-6 h-6 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-headline">SubAdmin Dashboard</h1>
              <p className="text-muted-foreground">
                Welcome back, {user?.firstName}! Help manage platform
                operations.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Badge variant="success" className="px-4 py-2">
            <div className="w-2 h-2 mr-2 rounded-full bg-success animate-pulse"></div>
            System Online
          </Badge>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </div>

      {!isConnected && (
        <Card className="card-gradient border-warning/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-warning/20 rounded-xl">
                  <Wallet className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="font-semibold text-warning">Wallet Required</p>
                  <p className="text-sm text-warning/80">
                    Connect your wallet to perform subadmin actions
                  </p>
                </div>
              </div>
              <Button onClick={connectWallet} variant="warning">
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          const iconColors = [
            {
              bg: "bg-primary/10",
              border: "border-primary/20",
              text: "text-primary",
            },
            {
              bg: "bg-secondary/10",
              border: "border-secondary/20",
              text: "text-secondary",
            },
            {
              bg: "bg-accent/10",
              border: "border-accent/20",
              text: "text-accent",
            },
            {
              bg: "bg-success/10",
              border: "border-success/20",
              text: "text-success",
            },
          ];
          const colorSet = iconColors[index % iconColors.length];
          return (
            <Card
              key={index}
              className="card-interactive group animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div
                    className={`w-14 h-14 ${colorSet.bg} rounded-2xl flex items-center justify-center group-hover:scale-110 smooth-transition border ${colorSet.border}`}
                  >
                    <Icon className={`w-7 h-7 ${colorSet.text}`} />
                  </div>
                  <Badge variant="success" className="px-3 py-1">
                    {stat.change}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-bold text-foreground group-hover:text-primary smooth-transition">
                    {stat.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="kyc" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 gap-2 p-2 border bg-card rounded-xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="verifiers">Verifiers</TabsTrigger>
          <TabsTrigger value="kyc">KYC</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <span>Recent Activity</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity, index) => (
                      <div
                        key={index}
                        className={`flex items-center p-3 space-x-3 rounded-lg ${
                          activity.type === "kyc_approved"
                            ? "bg-secondary/10"
                            : "bg-primary/10"
                        }`}
                      >
                        {activity.type === "kyc_approved" ? (
                          <CheckCircle className="w-5 h-5 text-secondary" />
                        ) : (
                          <Building2 className="w-5 h-5 text-primary" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {activity.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activity.description} -{" "}
                            {new Date(activity.timestamp).toLocaleString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "numeric",
                              },
                            )}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="py-8 text-sm text-center text-muted-foreground">
                      No recent activity
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-secondary text-secondary-foreground">
              <CardHeader>
                <CardTitle>SubAdmin Responsibilities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg bg-secondary-foreground/10">
                  <p className="text-sm font-medium">✓ Review KYC Requests</p>
                  <p className="text-xs opacity-80">
                    Approve or reject pending KYC submissions
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-secondary-foreground/10">
                  <p className="text-sm font-medium">✓ Manage Properties</p>
                  <p className="text-xs opacity-80">
                    Assign verifiers and oversee property verification
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-secondary-foreground/10">
                  <p className="text-sm font-medium">✓ Monitor Verifiers</p>
                  <p className="text-xs opacity-80">
                    View verifier status and activity
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="verifiers">
          <Card>
            <CardHeader>
              <CardTitle>Active Verifiers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {verifiers.map((verifier) => (
                  <div
                    key={verifier.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {verifier.firstName} {verifier.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {verifier.email}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {verifier.walletAddress}
                      </p>
                    </div>
                    <Badge variant="success">Active</Badge>
                  </div>
                ))}
                {verifiers.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">
                    No verifiers found
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kyc">
          <Card>
            <CardHeader>
              <CardTitle>KYC Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {kycRequests.map((kyc) => (
                  <div
                    key={kyc.id}
                    className="p-6 space-y-4 transition-colors border rounded-lg hover:border-primary/50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <p className="text-lg font-semibold">
                          {kyc.firstName} {kyc.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {kyc.email}
                        </p>
                        {kyc.walletAddress && (
                          <p className="font-mono text-xs text-muted-foreground">
                            Wallet: {kyc.walletAddress.slice(0, 6)}...
                            {kyc.walletAddress.slice(-4)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Submitted:{" "}
                          {new Date(kyc.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {kyc.status === "pending" && (
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
                              className="bg-green-600 hover:bg-green-700"
                            >
                              ✓ Approve
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
                              ✗ Reject
                            </Button>
                          </>
                        )}
                        {kyc.status !== "pending" && (
                          <Badge
                            variant={
                              kyc.status === "approved" ? "success" : "error"
                            }
                          >
                            {kyc.status}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {kyc.documents && kyc.documents.length > 0 && (
                      <div className="pt-4 border-t">
                        <p className="mb-3 text-sm font-medium">
                          Submitted Documents:
                        </p>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          {kyc.documents.map((doc) => (
                            <a
                              key={doc.id}
                              href={doc.ipfsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-3 transition-colors border rounded-lg hover:border-primary/50 hover:bg-accent"
                            >
                              <svg
                                className="w-5 h-5 text-primary"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                />
                              </svg>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {doc.documentType
                                    .replace(/_/g, " ")
                                    .toUpperCase()}
                                </p>
                                <p className="text-xs truncate text-muted-foreground">
                                  {doc.fileName}
                                </p>
                              </div>
                              <svg
                                className="w-4 h-4 text-muted-foreground"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                              </svg>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {kycRequests.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">
                    No KYC requests found
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="properties">
          <Card>
            <CardHeader>
              <CardTitle>Property Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {properties.map((property) => (
                  <div
                    key={property.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{property.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {property.location}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Owner: {property.owner?.firstName}{" "}
                        {property.owner?.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Value: ${property.value?.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {property.assignedVerifier ? (
                        <span className="text-sm text-muted-foreground">
                          Verifier: {property.assignedVerifier.firstName}{" "}
                          {property.assignedVerifier.lastName}
                        </span>
                      ) : (
                        <select
                          onChange={(e) =>
                            handleAssignVerifier(property.id, e.target.value)
                          }
                          className="text-sm input-base"
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Assign Verifier
                          </option>
                          {verifiers.map((verifier) => (
                            <option key={verifier.id} value={verifier.id}>
                              {verifier.firstName} {verifier.lastName}
                            </option>
                          ))}
                        </select>
                      )}
                      <Badge
                        variant={
                          property.status === "pending" ? "warning" : "success"
                        }
                      >
                        {property.status}
                      </Badge>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
                {properties.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">
                    No properties found
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-primary" />
                <span>SubAdmin Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="p-4 border rounded-lg bg-muted/50">
                  <h3 className="mb-2 font-semibold">Profile Settings</h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Manage your subadmin profile and notification preferences.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/profile")}
                  >
                    View Profile
                  </Button>
                </div>

                <div className="p-4 border rounded-lg bg-muted/50">
                  <h3 className="mb-2 font-semibold">Wallet Connection</h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {isConnected
                      ? `Connected: ${account?.slice(0, 6)}...${account?.slice(-4)}`
                      : "Connect your wallet to perform blockchain actions"}
                  </p>
                  {isConnected ? (
                    <Badge variant="success">Connected</Badge>
                  ) : (
                    <Button variant="outline" onClick={connectWallet}>
                      <Wallet className="w-4 h-4 mr-2" />
                      Connect Wallet
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
};

export default SubAdminDashboard;
