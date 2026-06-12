import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
// Fix relative paths to contexts
import {
  BarChart3,
  Briefcase,
  Building2,
  ChevronDown,
  Coins,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  Store,
  User,
  Wallet,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useWallet } from "../../contexts/WalletContext";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ThemeToggle } from "../ui/theme-toggle";

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const { account, isConnected, connectWallet, disconnectWallet } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  const handleLogout = async () => {
    try {
      await logout();
      // Do not disconnect wallet mapping in DB on logout
      // WalletContext state will reset via auth changes if needed
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleGoToProfile = () => {
    setShowProfileMenu(false);
    navigate("/profile");
  };

  const getDashboardLink = () => {
    if (!user) return "/";
    switch (user.role) {
      case "admin":
      case "subadmin":
        return "/admin";
      case "verifier":
        return "/verifier/dashboard";
      default:
        return "/user/dashboard";
    }
  };

  const getRoleIcon = () => {
    switch (user?.role) {
      case "admin":
      case "subadmin":
        return <Settings className="w-4 h-4" />;
      case "verifier":
        return <Shield className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getRoleColor = () => {
    switch (user?.role) {
      case "admin":
        return "text-destructive";
      case "subadmin":
        return "text-accent";
      case "verifier":
        return "text-secondary";
      default:
        return "text-primary";
    }
  };

  const getNavigationItems = () => {
    if (!isAuthenticated || !user) {
      return [
        {
          label: "Marketplace",
          path: "/marketplace",
          icon: <Store className="w-4 h-4" />,
        },
        {
          label: "How it Works",
          path: "/how-it-works",
          icon: <FileText className="w-4 h-4" />,
        },
        {
          label: "About",
          path: "/about",
          icon: <Building2 className="w-4 h-4" />,
        },
      ];
    }

    const baseItems = [
      {
        label: "Dashboard",
        path: getDashboardLink(),
        icon: <LayoutDashboard className="w-4 h-4" />,
      },
      {
        label: "Profile",
        path: "/profile",
        icon: <User className="w-4 h-4" />,
      },
    ];

    switch (user.role) {
      case "admin":
      case "subadmin":
        return [
          ...baseItems,
          {
            label: "KYC",
            path: "/admin/kyc-review",
            icon: <Shield className="w-4 h-4" />,
          },
          {
            label: "Tokenization",
            path: "/admin/tokenization",
            icon: <Coins className="w-4 h-4" />,
          },
          {
            label: "Investments",
            path: "/admin/investment-pools",
            icon: <Briefcase className="w-4 h-4" />,
          },
          {
            label: "Payments",
            path: "/admin/payment-verification",
            icon: <CreditCard className="w-4 h-4" />,
          },
          {
            label: "Revenue",
            path: "/admin/revenue",
            icon: <BarChart3 className="w-4 h-4" />,
          },
        ];
      case "verifier":
        return [
          ...baseItems,
          {
            label: "Properties",
            path: "/verifier/dashboard",
            icon: <Building2 className="w-4 h-4" />,
          },
        ];
      default:
        return [
          ...baseItems,
          {
            label: "Marketplace",
            path: "/marketplace",
            icon: <Store className="w-4 h-4" />,
          },
          {
            label: "Portfolio",
            path: "/portfolio",
            icon: <Briefcase className="w-4 h-4" />,
          },
          {
            label: user.kycStatus === "pending" ? "KYC (Under Review)" : "KYC",
            path: "/kyc",
            icon: <Shield className="w-4 h-4" />,
          },
        ];
    }
  };

  const isActiveRoute = (path) => {
    return (
      location.pathname === path || location.pathname.startsWith(path + "/")
    );
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-md shadow-sm">
      <div className="container-max">
        <div className="flex items-center justify-between h-20">
          {/* Professional Logo */}
          <Link to="/" className="flex items-center group">
            <img
              src="/logo3.png"
              alt="RWAChain logo"
              className="w-16 h-16 rounded-lg object-cover ring-1 ring-border/60 group-hover:scale-105 transition-transform duration-200"
            />
          </Link>

          {/* Clean Navigation */}
          <nav className="items-center hidden space-x-1 md:flex">
            {getNavigationItems()
              .slice(isAuthenticated ? 1 : 0)
              .map((item, index) => {
                const isActive = isActiveRoute(item.path);
                return (
                  <Link
                    key={index}
                    to={item.path}
                    className={`
                    flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200
                    ${
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }
                  `}
                  >
                    {item.icon}
                    <span className="text-sm">{item.label}</span>
                  </Link>
                );
              })}
          </nav>

          {/* Actions */}
          <div className="flex items-center space-x-3">
            <ThemeToggle />
            {isAuthenticated ? (
              <>
                {/* Professional Wallet Connection */}
                {user?.walletAddress ? (
                  <div className="hidden md:flex items-center space-x-2 px-4 py-2 bg-success/10 rounded-lg border border-success/20">
                    <Wallet className="w-4 h-4 text-success" />
                    <span className="font-mono text-sm text-success font-medium">
                      {user.walletAddress?.slice(0, 6)}...
                      {user.walletAddress?.slice(-4)}
                    </span>
                    <div className="w-2 h-2 bg-success rounded-full" />
                  </div>
                ) : (
                  <Button
                    onClick={handleGoToProfile}
                    variant="outline"
                    size="sm"
                    className="hidden md:flex border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:border-amber-500"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    Link Wallet
                  </Button>
                )}

                {/* Professional Profile Menu */}
                <div className="relative" ref={profileMenuRef}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center px-3 py-2 space-x-3 hover:bg-muted/60 rounded-lg transition-all duration-200"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 ${getRoleColor()}`}
                    >
                      {getRoleIcon()}
                    </div>
                    <div className="hidden text-left md:block">
                      <span className="block text-sm font-semibold text-foreground">
                        {user?.firstName} {user?.lastName}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-xs px-2 py-0.5 font-medium ${getRoleColor()}`}
                        >
                          {user?.role}
                        </Badge>
                        {isConnected && (
                          <div className="w-1.5 h-1.5 rounded-full bg-success" />
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        showProfileMenu ? "rotate-180" : ""
                      }`}
                    />
                  </Button>

                  {/* Professional Dropdown Menu */}
                  {showProfileMenu && (
                    <div className="absolute right-0 py-2 mt-3 border border-border/60 shadow-xl w-72 bg-card rounded-xl animate-scale-in">
                      {/* Profile Info */}
                      <div className="px-6 py-4 border-b border-border/60">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 ${getRoleColor()}`}
                          >
                            {getRoleIcon()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground truncate">
                              {user?.firstName} {user?.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {user?.email}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Badge
                                variant="outline"
                                className={`text-xs px-2 py-0.5 font-semibold ${getRoleColor()}`}
                              >
                                {user?.role}
                              </Badge>
                              {isConnected && (
                                <span className="text-xs font-medium text-success flex items-center gap-1">
                                  <span
                                    className="w-1.5 h-1.5 rounded-full bg-success"
                                    aria-hidden="true"
                                  />
                                  Connected
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Navigation Items */}
                      <div className="py-2">
                        {getNavigationItems().map((item, index) => {
                          const isActive = isActiveRoute(item.path);
                          return (
                            <Link
                              key={index}
                              to={item.path}
                              className={`
                                flex items-center space-x-3 px-6 py-2.5 text-sm transition-all duration-200 mx-2 rounded-lg
                                ${
                                  isActive
                                    ? "bg-primary/10 text-primary font-semibold"
                                    : "text-foreground hover:bg-muted/60"
                                }
                              `}
                              onClick={() => setShowProfileMenu(false)}
                            >
                              {item.icon}
                              <span className="flex-1">{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>

                      {/* Wallet Info - Show linked wallet status */}
                      {user?.walletAddress ? (
                        <div className="px-6 py-3 border-t border-border/60 bg-success/5 mx-2 my-2 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-success flex items-center gap-1.5">
                              <span
                                className="w-1.5 h-1.5 bg-success rounded-full"
                                aria-hidden="true"
                              />
                              Wallet Linked
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-success" />
                            <p className="text-xs font-mono text-success bg-success/10 px-3 py-1.5 rounded-md border border-success/20 font-medium">
                              {user.walletAddress.slice(0, 8)}
                              ...{user.walletAddress.slice(-6)}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            This wallet is permanently linked to your account
                          </p>
                        </div>
                      ) : (
                        <div className="px-6 py-3 border-t border-border/60 bg-amber-500/5 mx-2 my-2 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                              <Wallet className="w-3 h-3" />
                              No Wallet Linked
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            Link your wallet to access blockchain features
                          </p>
                          <Button
                            onClick={handleGoToProfile}
                            size="sm"
                            variant="outline"
                            className="w-full border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400"
                          >
                            Go to Profile to Link
                          </Button>
                        </div>
                      )}

                      {/* Logout */}
                      <div className="px-2 pt-2 border-t border-border/60">
                        <button
                          onClick={handleLogout}
                          className="flex items-center w-full px-4 py-2.5 space-x-3 text-sm text-left rounded-lg text-destructive hover:bg-destructive/10 transition-all duration-200 font-semibold"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-3">
                <Link to="/login">
                  <Button
                    variant="ghost"
                    className="hover:bg-muted/60 transition-all duration-200 font-medium"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button className="btn-primary font-semibold">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
