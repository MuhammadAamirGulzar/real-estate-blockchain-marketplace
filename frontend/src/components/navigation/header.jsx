import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { address } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
      setMobileMenuOpen(false);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const publicLinks = [
    { name: "Home", href: "/" },
    { name: "Marketplace", href: "/marketplace" },
    { name: "How It Works", href: "/how-it-works" },
    { name: "About", href: "/about" },
    { name: "Contact", href: "/contact" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 dark:bg-slate-900/95 dark:border-slate-700 theme-transition">
      <nav className="container-max">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center flex-shrink-0 group"
          >
            <img
              src="/logo3.png"
              alt="RWAChain logo"
              className="w-16 h-16 rounded-lg object-cover ring-1 ring-border/60 transition-shadow group-hover:shadow-lg"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex lg:items-center lg:gap-8">
            {publicLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? "text-primary dark:text-blue-400"
                    : "text-foreground dark:text-slate-300 hover:text-primary dark:hover:text-blue-400"
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Wallet Connect - SINGLE INSTANCE */}
            <div className="hidden sm:block">
              <ConnectWallet />
            </div>

            {/* Auth Buttons */}
            {user ? (
              <div className="items-center hidden gap-2 lg:flex">
                <Button
                  onClick={() => navigate("/dashboard")}
                  variant="outline"
                  size="sm"
                  className="dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Dashboard
                </Button>
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  size="sm"
                  className="dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Logout
                </Button>
              </div>
            ) : (
              <div className="items-center hidden gap-2 lg:flex">
                <Button
                  onClick={() => navigate("/login")}
                  variant="ghost"
                  size="sm"
                  className="dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Login
                </Button>
                <Button
                  onClick={() => navigate("/signup")}
                  className="btn-primary dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white"
                  size="sm"
                >
                  Sign Up
                </Button>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 transition-colors rounded-lg lg:hidden text-foreground dark:text-slate-300 hover:bg-muted dark:hover:bg-slate-800"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="py-4 border-t lg:hidden border-border dark:border-slate-700 animate-fade-in bg-card dark:bg-slate-900">
            <div className="flex flex-col gap-4">
              {/* Mobile Wallet */}
              <div className="px-3 sm:hidden">
                <ConnectWallet />
              </div>

              {/* Mobile Navigation Links */}
              {publicLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive(link.href)
                      ? "bg-primary/10 dark:bg-blue-500/20 text-primary dark:text-blue-400"
                      : "text-foreground dark:text-slate-300 hover:bg-muted dark:hover:bg-slate-800"
                  }`}
                >
                  {link.name}
                </Link>
              ))}

              {/* Mobile Auth Buttons */}
              <div className="pt-4 mt-4 space-y-2 border-t border-border dark:border-slate-700">
                {user ? (
                  <>
                    <Button
                      onClick={() => {
                        navigate("/dashboard");
                        setMobileMenuOpen(false);
                      }}
                      variant="outline"
                      className="w-full dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      Dashboard
                    </Button>
                    <Button
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      variant="ghost"
                      className="w-full dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => {
                        navigate("/login");
                        setMobileMenuOpen(false);
                      }}
                      variant="outline"
                      className="w-full dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      Login
                    </Button>
                    <Button
                      onClick={() => {
                        navigate("/signup");
                        setMobileMenuOpen(false);
                      }}
                      className="w-full btn-primary dark:bg-blue-600 dark:hover:bg-blue-700"
                    >
                      Sign Up
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
