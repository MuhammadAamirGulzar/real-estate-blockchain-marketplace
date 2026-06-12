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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import {
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogOut,
  Settings,
  User,
  Wallet,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "react-toastify";

/**
 * Password visibility toggle button component
 */
const PasswordToggle = ({ isVisible, onToggle }) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
    onClick={onToggle}
    aria-label={isVisible ? "Hide password" : "Show password"}
  >
    {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
  </Button>
);

/**
 * Password input field with toggle visibility
 */
const PasswordInput = ({
  id,
  label,
  value,
  onChange,
  showPassword,
  onToggle,
  required = true,
}) => (
  <div className="space-y-2">
    <Label htmlFor={id} className="text-sm font-medium">
      {label}
    </Label>
    <div className="relative">
      <Input
        id={id}
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        className="pr-10"
        required={required}
        minLength={6}
      />
      <PasswordToggle isVisible={showPassword} onToggle={onToggle} />
    </div>
  </div>
);

/**
 * Badge variant selector based on status
 */
const getBadgeVariant = (status, type = "role") => {
  if (type === "role") {
    return status === "admin"
      ? "destructive"
      : status === "verifier"
      ? "secondary"
      : "default";
  }
  if (type === "kyc") {
    return status === "approved"
      ? "default"
      : status === "pending"
      ? "secondary"
      : "destructive";
  }
  return "outline";
};

/**
 * Format wallet address for display
 */
const formatAddress = (address) => {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * UserSettings Dialog Component
 * Provides account management UI including profile info, wallet connection, and security settings.
 */
export function UserSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    old: false,
    new: false,
    confirm: false,
  });
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const { user, logout, changePassword, isAuthenticated } = useAuth();
  const { walletAddress, networkName, isConnected } = useWallet();

  // Update password form field
  const handlePasswordChange = useCallback((field, value) => {
    setPasswordForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  // Toggle password visibility
  const togglePasswordVisibility = useCallback((field) => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  }, []);

  // Validate and submit password change
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    // Validation checks
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long");
      return;
    }

    if (passwordForm.oldPassword === passwordForm.newPassword) {
      toast.error("New password must be different from current password");
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(passwordForm.oldPassword, passwordForm.newPassword);
      toast.success("Password changed successfully");
      setPasswordForm({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowPasswords({ old: false, new: false, confirm: false });
    } catch (error) {
      // Error handling delegated to AuthContext
      toast.error("Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    setIsOpen(false);
    toast.info("You have been signed out");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline text-sm font-medium">Settings</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background border-border">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Settings className="h-5 w-5 text-primary" />
            <span>Account Settings</span>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Manage your account preferences and security settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!isAuthenticated ? (
            // Not authenticated - show login prompt
            <Alert className="border-accent/30 bg-accent/5">
              <AlertCircle className="h-4 w-4 text-accent" />
              <AlertDescription className="text-foreground ml-2">
                Please log in to access account settings and management
                features.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Profile Information Card */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <User className="h-4 w-4 text-primary" />
                    <span>Profile Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        First Name
                      </Label>
                      <p className="text-sm font-medium text-foreground mt-1">
                        {user?.firstName || "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Last Name
                      </Label>
                      <p className="text-sm font-medium text-foreground mt-1">
                        {user?.lastName || "N/A"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Email Address
                    </Label>
                    <p className="text-sm font-medium text-foreground mt-1">
                      {user?.email}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Role
                      </Label>
                      <Badge
                        variant={getBadgeVariant(user?.role, "role")}
                        className="mt-2"
                      >
                        {user?.role?.charAt(0).toUpperCase() +
                          user?.role?.slice(1) || "User"}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        KYC Status
                      </Label>
                      <Badge
                        variant={getBadgeVariant(user?.kycStatus, "kyc")}
                        className="mt-2"
                      >
                        {user?.kycStatus?.charAt(0).toUpperCase() +
                          user?.kycStatus?.slice(1) || "Not Verified"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Wallet Connection Card */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Wallet className="h-4 w-4 text-primary" />
                    <span>Wallet Connection</span>
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Manage your connected cryptocurrency wallet
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Wallet Address
                      </Label>
                      <p className="text-sm font-mono text-foreground mt-2 break-all">
                        {formatAddress(walletAddress)}
                      </p>
                      {isConnected && networkName && (
                        <div className="flex items-center gap-2 mt-2">
                          <CheckCircle className="h-3 w-3 text-secondary" />
                          <p className="text-xs text-muted-foreground">
                            Network:{" "}
                            <span className="font-medium text-foreground">
                              {networkName}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                    <ConnectWallet variant="outline" size="sm" />
                  </div>
                </CardContent>
              </Card>

              {/* Security Settings Card */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Lock className="h-4 w-4 text-primary" />
                    <span>Security Settings</span>
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Update your password and manage security preferences
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    <PasswordInput
                      id="oldPassword"
                      label="Current Password"
                      value={passwordForm.oldPassword}
                      onChange={(e) =>
                        handlePasswordChange("oldPassword", e.target.value)
                      }
                      showPassword={showPasswords.old}
                      onToggle={() => togglePasswordVisibility("old")}
                      required
                    />

                    <PasswordInput
                      id="newPassword"
                      label="New Password"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        handlePasswordChange("newPassword", e.target.value)
                      }
                      showPassword={showPasswords.new}
                      onToggle={() => togglePasswordVisibility("new")}
                      required
                    />

                    <PasswordInput
                      id="confirmPassword"
                      label="Confirm New Password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        handlePasswordChange("confirmPassword", e.target.value)
                      }
                      showPassword={showPasswords.confirm}
                      onToggle={() => togglePasswordVisibility("confirm")}
                      required
                    />

                    <Button
                      type="submit"
                      disabled={isChangingPassword}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {isChangingPassword ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4 mr-2" />
                          <span>Update Password</span>
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Sign Out Section */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border border-border bg-muted/30">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Sign Out
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sign out of your account on this device
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleLogout}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UserSettings;
