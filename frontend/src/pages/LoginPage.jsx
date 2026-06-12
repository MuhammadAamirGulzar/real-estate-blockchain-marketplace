import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { AlertCircle, ArrowLeft, CheckCircle, Eye, EyeOff, Loader2, Wallet } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function LoginPage() {
  const { login, error, isLoading, clearError } = useAuth();
  const { connectWallet, walletAddress, isConnected } = useWallet();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [localError, setLocalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [user, setUser] = useState(null);
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e) => {
    setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
    if (localError) setLocalError("");
    if (error) clearError();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!formData.email.trim()) { setLocalError("Email is required"); return; }
    if (!formData.password) { setLocalError("Password is required"); return; }
    setIsSubmitting(true);
    setLocalError("");
    try {
      const res = await login(formData.email, formData.password);
      setUser(res.user);
      const role = res.user?.role;
      if (role === "admin") navigate("/admin");
      else if (role === "subadmin") navigate("/subadmin");
      else if (role === "verifier") navigate("/verifier/dashboard");
      else navigate("/user/dashboard");
    } catch (err) {
      setLocalError(err.response?.data?.message || err.message || "Invalid credentials");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWalletConnect = async () => {
    setIsSubmitting(true);
    try {
      const result = await connectWallet();
      if (result.success) navigate(user?.role === "admin" ? "/admin" : "/user/dashboard");
      else setLocalError(result.error || "Failed to connect wallet");
    } catch (err) {
      setLocalError(err.message || "Failed to connect wallet");
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || error;
  const loading = isLoading || isSubmitting;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] relative overflow-hidden bg-navy-900 p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(212,175,55,0.10),transparent_60%)]" />
        <div className="absolute top-1/2 -right-32 w-[400px] h-[400px] rounded-full bg-gold-400/5 blur-[100px]" />

        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center">
            <img
              src="/logo3.png"
              alt="RWAChain logo"
              className="w-16 h-16 rounded-xl object-cover ring-1 ring-gold-400/30"
            />
          </Link>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 rounded-full bg-gold-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-gold-400">Investor Portal</span>
            </div>
            <h2 className="font-display text-3xl font-bold text-foreground">Welcome Back to Real Estate Investing</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">Access your tokenized property portfolio, track rental income, and trade on the secondary market.</p>
          </div>
          <div className="space-y-3">
            {[
              "Blockchain-backed fractional ownership",
              "Monthly rental income distribution",
              "24/7 secondary marketplace access",
              "Full KYC/AML compliance",
            ].map(t => (
              <div key={t} className="flex items-center gap-3 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-gold-400 flex-shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 border-t border-navy-500 pt-6">
          <p className="text-xs text-muted-foreground">
            Protected by bank-grade encryption. Your assets and data are secured at all times.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center">
            <Link to="/" className="inline-flex items-center">
              <img
                src="/logo3.png"
                alt="RWAChain logo"
                className="w-14 h-14 rounded-lg object-cover ring-1 ring-gold-400/30"
              />
            </Link>
          </div>

          {step === 1 && (
            <div className="space-y-8">
              <div className="space-y-2">
                <h1 className="font-display text-2xl font-bold text-foreground">Sign In</h1>
                <p className="text-muted-foreground text-sm">Enter your credentials to access your account.</p>
              </div>

              {displayError && (
                <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {displayError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground text-sm font-medium">Email Address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="bg-navy-700 border-navy-500 text-foreground placeholder:text-muted-foreground h-11 focus:border-gold-500 focus:ring-gold-500/20"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="password" className="text-foreground text-sm font-medium">Password</Label>
                    <Link to="/forgot-password" className="text-xs text-gold-400 hover:text-gold-300 transition-colors">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPass ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      className="bg-navy-700 border-navy-500 text-foreground placeholder:text-muted-foreground h-11 pr-10 focus:border-gold-500 focus:ring-gold-500/20"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 text-sm font-bold text-navy-900"
                  style={{ background: "linear-gradient(135deg,#D4AF37 0%,#8C7020 100%)" }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {loading ? "Signing In..." : "Sign In to Account"}
                </Button>
              </form>

              <div className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/signup" className="text-gold-400 hover:text-gold-300 font-medium transition-colors">
                  Create Account
                </Link>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8">
              <div className="space-y-2">
                <h1 className="font-display text-2xl font-bold text-foreground">Connect Your Wallet</h1>
                <p className="text-muted-foreground text-sm">
                  Link your crypto wallet to access blockchain features and manage your property tokens.
                </p>
              </div>

              <div className="p-6 bg-navy-700 border border-navy-500 rounded-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-gold-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">MetaMask</p>
                    <p className="text-xs text-muted-foreground">Connect your browser wallet</p>
                  </div>
                </div>
                {isConnected && walletAddress && (
                  <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Connected: {walletAddress.slice(0,6)}…{walletAddress.slice(-4)}
                  </div>
                )}
                <Button
                  onClick={handleWalletConnect}
                  disabled={loading}
                  className="w-full h-11 border-navy-400 text-foreground hover:bg-navy-600"
                  variant="outline"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wallet className="w-4 h-4 mr-2" />}
                  {isConnected ? "Continue with Wallet" : "Connect MetaMask"}
                </Button>
              </div>

              <Button
                variant="ghost"
                onClick={() => navigate("/user/dashboard")}
                className="w-full text-muted-foreground hover:text-foreground text-sm"
              >
                Skip for now — continue without wallet
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
