import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { AlertCircle, ArrowLeft, CheckCircle, Eye, EyeOff, Loader2, Shield, Wallet } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function SignupPage() {
  const { signup, error, isLoading, clearError } = useAuth();
  const { connectWallet, walletAddress, isConnected } = useWallet();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "",
  });
  const [localError, setLocalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [user, setUser] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = (e) => {
    setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
    if (localError) setLocalError("");
    if (error) clearError();
  };

  const validate = () => {
    if (!formData.firstName.trim()) { setLocalError("First name is required"); return false; }
    if (!formData.lastName.trim())  { setLocalError("Last name is required"); return false; }
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) { setLocalError("Valid email required"); return false; }
    if (!formData.password || formData.password.length < 6) { setLocalError("Password must be at least 6 characters"); return false; }
    if (formData.password !== formData.confirmPassword) { setLocalError("Passwords do not match"); return false; }
    return true;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setLocalError("");
    try {
      const res = await signup(formData.email, formData.password, formData.firstName, formData.lastName);
      setUser(res.user);
      setStep(2);
    } catch (err) {
      setLocalError(err.response?.data?.message || err.message || "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWalletConnect = async () => {
    setIsSubmitting(true);
    try {
      const result = await connectWallet();
      if (result.success) navigate("/kyc");
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
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] relative overflow-hidden bg-navy-900 p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(212,175,55,0.10),transparent_60%)]" />

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
              <span className="text-xs font-semibold uppercase tracking-widest text-gold-400">New Investor Onboarding</span>
            </div>
            <h2 className="font-display text-3xl font-bold text-foreground">Start Investing in Premium Real Estate</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">Create your free account and gain access to tokenized, income-generating properties worldwide.</p>
          </div>

          <div className="space-y-4">
            {[
              { n: "01", title: "Create Account", desc: "Register with your email — takes 2 minutes" },
              { n: "02", title: "Connect Wallet",  desc: "Link your MetaMask for blockchain access" },
              { n: "03", title: "Complete KYC",    desc: "Verify identity for regulatory compliance" },
              { n: "04", title: "Start Investing", desc: "Browse and invest in tokenized properties" },
            ].map(s => (
              <div key={s.n} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-gold-400/15 border border-gold-400/25 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-gold-400">{s.n}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 border-t border-navy-500 pt-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-4 h-4 text-gold-400" />
            All accounts are KYC/AML verified for regulatory compliance.
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center">
            <Link to="/" className="inline-flex items-center">
              <img
                src="/logo3.png"
                alt="RWAChain logo"
                className="w-14 h-14 rounded-lg object-cover ring-1 ring-gold-400/30"
              />
            </Link>
          </div>

          <button
            onClick={() => step > 1 ? setStep(s => s-1) : navigate(-1)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          {/* Step 1: Registration */}
          {step === 1 && (
            <div className="space-y-8">
              <div className="space-y-2">
                <h1 className="font-display text-2xl font-bold text-foreground">Create Your Account</h1>
                <p className="text-muted-foreground text-sm">Join RWAChain and start investing in tokenized real estate.</p>
              </div>

              {displayError && (
                <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {displayError}
                </div>
              )}

              <form onSubmit={handleSignup} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-foreground text-sm font-medium">First Name</Label>
                    <Input
                      name="firstName" placeholder="John"
                      value={formData.firstName} onChange={handleChange}
                      className="bg-navy-700 border-navy-500 text-foreground placeholder:text-muted-foreground h-11 focus:border-gold-500"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground text-sm font-medium">Last Name</Label>
                    <Input
                      name="lastName" placeholder="Smith"
                      value={formData.lastName} onChange={handleChange}
                      className="bg-navy-700 border-navy-500 text-foreground placeholder:text-muted-foreground h-11 focus:border-gold-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground text-sm font-medium">Email Address</Label>
                  <Input
                    name="email" type="email" placeholder="you@example.com"
                    value={formData.email} onChange={handleChange}
                    className="bg-navy-700 border-navy-500 text-foreground placeholder:text-muted-foreground h-11 focus:border-gold-500"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Input
                      name="password" type={showPass ? "text" : "password"} placeholder="Min. 6 characters"
                      value={formData.password} onChange={handleChange}
                      className="bg-navy-700 border-navy-500 text-foreground placeholder:text-muted-foreground h-11 pr-10 focus:border-gold-500"
                      required
                    />
                    <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground text-sm font-medium">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      name="confirmPassword" type={showConfirm ? "text" : "password"} placeholder="Re-enter password"
                      value={formData.confirmPassword} onChange={handleChange}
                      className="bg-navy-700 border-navy-500 text-foreground placeholder:text-muted-foreground h-11 pr-10 focus:border-gold-500"
                      required
                    />
                    <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  By creating an account, you agree to our{" "}
                  <Link to="/terms-of-service" className="text-gold-400 hover:text-gold-300">Terms of Service</Link>{" "}
                  and{" "}
                  <Link to="/privacy-policy" className="text-gold-400 hover:text-gold-300">Privacy Policy</Link>.
                </p>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 text-sm font-bold text-navy-900"
                  style={{ background: "linear-gradient(135deg,#D4AF37 0%,#8C7020 100%)" }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {loading ? "Creating Account..." : "Create Account"}
                </Button>
              </form>

              <div className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-gold-400 hover:text-gold-300 font-medium transition-colors">
                  Sign In
                </Link>
              </div>
            </div>
          )}

          {/* Step 2: Wallet Connection */}
          {step === 2 && (
            <div className="space-y-8">
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center mb-4">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <h1 className="font-display text-2xl font-bold text-foreground">Account Created!</h1>
                <p className="text-muted-foreground text-sm">
                  Welcome, <span className="text-foreground font-medium">{user?.firstName || formData.firstName}</span>!
                  Now connect your wallet to access blockchain features.
                </p>
              </div>

              {displayError && (
                <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {displayError}
                </div>
              )}

              <div className="p-6 bg-navy-700 border border-navy-500 rounded-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-gold-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Connect MetaMask</p>
                    <p className="text-xs text-muted-foreground">Required to invest and receive rental income payouts.</p>
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
                  className="w-full h-11 border-gold-500/40 text-gold-400 hover:bg-gold-400/10 gap-2"
                  variant="outline"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                  {isConnected ? "Continue with Connected Wallet" : "Connect MetaMask"}
                </Button>
              </div>

              <div className="text-center space-y-3">
                <p className="text-xs text-muted-foreground">
                  You will also need to complete{" "}
                  <span className="text-foreground font-medium">KYC identity verification</span>{" "}
                  before you can invest.
                </p>
                <Button
                  variant="ghost"
                  onClick={() => navigate("/kyc")}
                  className="w-full text-muted-foreground hover:text-foreground text-sm"
                >
                  Skip wallet — go to KYC verification
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
