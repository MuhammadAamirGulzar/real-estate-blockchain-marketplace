import Header from "@/components/layout/Header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import api from "@/services/api";
import {
  AlertCircle,
  CheckCircle,
  Edit2,
  Link as LinkIcon,
  Mail,
  Save,
  Shield,
  User,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function ProfilePage() {
  const { user, logout, setUser } = useAuth();
  const {
    connectWallet,
    disconnectWallet,
    account,
    isConnected,
    isWalletLocked,
  } = useWallet();
  const [isLinkingWallet, setIsLinkingWallet] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
  });
  const walletAddressToDisplay = profileData?.walletAddress || user?.walletAddress;

  useEffect(() => {
    const fetchProfile = async () => {
      setIsProfileLoading(true);
      try {
        const response = await api.get("/user/profile");
        const profile = response?.data?.data || null;
        setProfileData(profile);

        if (profile) {
          setFormData({
            firstName: profile.firstName || "",
            lastName: profile.lastName || "",
            email: profile.email || "",
          });

          if (user) {
            const mergedUser = {
              ...user,
              firstName: profile.firstName || user.firstName,
              lastName: profile.lastName || user.lastName,
              email: profile.email || user.email,
              walletAddress: profile.walletAddress || user.walletAddress,
              role: profile.role || user.role,
              isWalletConnected:
                typeof profile.isWalletConnected === "boolean"
                  ? profile.isWalletConnected
                  : user.isWalletConnected,
            };
            setUser(mergedUser);
            localStorage.setItem("user", JSON.stringify(mergedUser));
          }
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        toast.error("Failed to load profile settings");
      } finally {
        setIsProfileLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    const firstName = formData.firstName?.trim();
    const lastName = formData.lastName?.trim();

    if (!firstName || !lastName) {
      toast.error("First name and last name are required");
      return;
    }

    setIsSaving(true);
    try {
      await api.put("/user/profile", { firstName, lastName });

      const refreshed = await api.get("/user/profile");
      const updatedProfile = refreshed?.data?.data || null;
      if (updatedProfile) {
        setProfileData(updatedProfile);
        setFormData({
          firstName: updatedProfile.firstName || "",
          lastName: updatedProfile.lastName || "",
          email: updatedProfile.email || "",
        });

        if (user) {
          const mergedUser = {
            ...user,
            firstName: updatedProfile.firstName || user.firstName,
            lastName: updatedProfile.lastName || user.lastName,
            email: updatedProfile.email || user.email,
          };
          setUser(mergedUser);
          localStorage.setItem("user", JSON.stringify(mergedUser));
        }
      }

      setIsEditing(false);
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error(error?.response?.data?.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: profileData?.firstName || user?.firstName || "",
      lastName: profileData?.lastName || user?.lastName || "",
      email: profileData?.email || user?.email || "",
    });
    setIsEditing(false);
  };

  if (isProfileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container-max py-8">
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </main>
      </div>
    );
  }

  const handleLinkWallet = async () => {
    setIsLinkingWallet(true);
    try {
      const result = await connectWallet(true); // true = connect to backend
      if (result.success) {
        toast.success("Wallet linked successfully!");
        // Reload user data
        window.location.reload();
      } else {
        toast.error(result.error || "Failed to link wallet");
      }
    } catch (error) {
      console.error("Wallet linking error:", error);
      toast.error(error.message || "Failed to link wallet");
    } finally {
      setIsLinkingWallet(false);
    }
  };

  const handleDisconnectWallet = async () => {
    try {
      await disconnectWallet();
      toast.success(
        "Wallet disconnected from session (still linked in database)",
      );
    } catch (error) {
      console.error("Wallet disconnect error:", error);
      toast.error(error.message || "Failed to disconnect wallet");
    }
  };

  const handleReconnectWallet = async () => {
    setIsLinkingWallet(true);
    try {
      // For reconnecting an already linked wallet, just establish the connection
      const result = await connectWallet(true);
      if (result.success) {
        toast.success("Wallet reconnected!");
      } else {
        toast.error(result.error || "Failed to reconnect wallet");
      }
    } catch (error) {
      console.error("Wallet reconnect error:", error);
      toast.error(error.message || "Failed to reconnect wallet");
    } finally {
      setIsLinkingWallet(false);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "admin":
        return "bg-red-500";
      case "verifier":
        return "bg-blue-500";
      case "user":
        return "bg-green-500";
      default:
        return "bg-muted-foreground";
    }
  };

  const getKYCColor = (status) => {
    switch (status) {
      case "approved":
        return "bg-green-500";
      case "pending":
        return "bg-yellow-500";
      case "rejected":
        return "bg-red-500";
      default:
        return "bg-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container-max py-8 space-y-8 animate-fade-in theme-transition">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Profile Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your account information and preferences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Info */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Personal Information
                </CardTitle>
                {!isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex space-x-2">
                    <Button size="sm" onClick={handleSave}>
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    {isEditing ? (
                      <Input
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                      />
                    ) : (
                      <p className="p-2 bg-muted rounded-md">
                        {user?.firstName}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    {isEditing ? (
                      <Input
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                      />
                    ) : (
                      <p className="p-2 bg-muted rounded-md">
                        {user?.lastName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <p className="p-2 bg-muted rounded-md flex items-center">
                    <Mail className="w-4 h-4 mr-2 text-muted-foreground" />
                    {formData.email}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Account Status */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Role
                  </span>
                  <Badge className={`${getRoleColor(user?.role)} text-white`}>
                    {profileData?.role || user?.role || "user"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    KYC Status
                  </span>
                  <Badge
                    className={`${getKYCColor(profileData?.kycStatus || user?.kycStatus)} text-white`}
                  >
                    {profileData?.kycStatus || user?.kycStatus || "not_submitted"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Wallet
                  </span>
                  <Badge
                    variant={
                      (typeof profileData?.isWalletConnected === "boolean"
                        ? profileData.isWalletConnected
                        : user?.isWalletConnected)
                        ? "default"
                        : "secondary"
                    }
                  >
                    {(typeof profileData?.isWalletConnected === "boolean"
                      ? profileData.isWalletConnected
                      : user?.isWalletConnected)
                      ? "Connected"
                      : "Not Connected"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Wallet Linking Section */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Wallet className="w-5 h-5 mr-2" />
                  Wallet Linking
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {walletAddressToDisplay ? (
                  // Wallet Already Linked
                  <div className="space-y-4">
                    <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        Your wallet is securely linked to this account
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">
                        Linked Wallet Address
                      </Label>
                      <div className="p-3 bg-muted rounded-md border border-border">
                        <p className="text-sm font-mono break-all">
                          {walletAddressToDisplay}
                        </p>
                      </div>
                    </div>

                    {/* Session Status: Show if wallet is connected in current session */}
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md border border-border">
                      <span className="text-sm font-medium">
                        Session Status
                      </span>
                      <Badge variant={isConnected ? "default" : "secondary"}>
                        {isConnected ? "Connected" : "Disconnected"}
                      </Badge>
                    </div>

                    {/* Admin-only Disconnect/Reconnect Controls */}
                    {user?.role === "admin" && (
                      <div className="space-y-3 pt-2 border-t border-border">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold text-primary">
                            Admin Controls
                          </Label>
                          <Badge variant="outline" className="text-xs">
                            <Shield className="w-3 h-3 mr-1" />
                            Admin Only
                          </Badge>
                        </div>

                        {isConnected ? (
                          <Button
                            onClick={handleDisconnectWallet}
                            variant="outline"
                            className="w-full"
                            size="sm"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Disconnect Wallet (Temporary)
                          </Button>
                        ) : (
                          <Button
                            onClick={handleReconnectWallet}
                            disabled={isLinkingWallet}
                            variant="default"
                            className="w-full"
                            size="sm"
                          >
                            <LinkIcon className="w-4 h-4 mr-2" />
                            {isLinkingWallet
                              ? "Reconnecting..."
                              : "Reconnect Wallet"}
                          </Button>
                        )}

                        <p className="text-xs text-muted-foreground">
                          {isConnected
                            ? "Temporarily disconnect wallet from this session. Wallet remains linked in database."
                            : "Reconnect your linked wallet to this session. No signature required."}
                        </p>
                      </div>
                    )}

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        <strong>Important:</strong> Only this wallet can perform
                        transactions. To permanently change your linked wallet,
                        contact an administrator.
                      </AlertDescription>
                    </Alert>

                    {isWalletLocked && (
                      <Badge
                        className="w-full justify-center py-2"
                        variant="outline"
                      >
                        <Shield className="w-3 h-3 mr-2" />
                        Wallet Locked & Secured
                      </Badge>
                    )}
                  </div>
                ) : (
                  // No Wallet Linked Yet
                  <div className="space-y-4">
                    <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                      <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                        No wallet linked to your account yet
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">
                        Why link a wallet?
                      </Label>
                      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Submit and verify properties on-chain</li>
                        <li>Purchase and trade tokenized assets</li>
                        <li>Receive revenue distributions</li>
                        <li>Access blockchain-verified KYC</li>
                      </ul>
                    </div>

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        <strong>One-time action:</strong> Once linked, your
                        wallet will be permanently associated with this account
                        and cannot be changed without admin assistance.
                      </AlertDescription>
                    </Alert>

                    <Button
                      onClick={handleLinkWallet}
                      disabled={isLinkingWallet}
                      className="w-full"
                      size="lg"
                    >
                      <LinkIcon className="w-4 h-4 mr-2" />
                      {isLinkingWallet
                        ? "Linking Wallet..."
                        : "Link Wallet Now"}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      Make sure you have MetaMask or another Web3 wallet
                      installed
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-red-600">
                  <Shield className="w-5 h-5 mr-2" />
                  Danger Zone
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  onClick={logout}
                  className="w-full"
                >
                  Sign Out
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
