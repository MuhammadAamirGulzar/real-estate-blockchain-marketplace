import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle,
  Coins,
  Globe,
  Lock,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PropertyNFTCard } from "../components/properties/PropertyNFTCard";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { useProperties } from "../hooks/useProperties";

function Counter({ target, suffix = "", prefix = "" }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const step = Math.ceil(target / 60);
    const t = setInterval(
      () =>
        setVal((v) => {
          if (v >= target) {
            clearInterval(t);
            return target;
          }
          return Math.min(v + step, target);
        }),
      25,
    );
    return () => clearInterval(t);
  }, [target]);
  return (
    <span>
      {prefix}
      {val.toLocaleString()}
      {suffix}
    </span>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Create Account & Verify",
    desc: "Register with your email, complete KYC identity verification, and connect your blockchain wallet — takes under 10 minutes.",
    icon: Shield,
  },
  {
    n: "02",
    title: "Browse & Select Property",
    desc: "Explore our curated portfolio of tokenized real estate. Filter by location, type, ROI, and price to find your ideal investment.",
    icon: Building2,
  },
  {
    n: "03",
    title: "Invest & Earn",
    desc: "Purchase fractional tokens from as little as $500. Earn rental income distributed monthly directly to your wallet.",
    icon: Coins,
  },
];

const TRUST = [
  {
    icon: Lock,
    title: "Bank-Grade Security",
    desc: "Multi-layer encryption, cold wallet custody, and smart contract audits protect every asset.",
  },
  {
    icon: Shield,
    title: "Regulatory Compliant",
    desc: "Full KYC/AML verification and legally-backed real-world property ownership on every listing.",
  },
  {
    icon: CheckCircle,
    title: "Blockchain Verified",
    desc: "Every asset and transaction is recorded on-chain with transparent, immutable ownership records.",
  },
  {
    icon: Globe,
    title: "24/7 Liquid Market",
    desc: "Buy and sell property tokens any time of day on our live secondary marketplace — no lock-in.",
  },
];

export default function HomePage() {
  const { properties: featured } = useProperties("tokenized");
  const top3 = featured.slice(0, 3);

  return (
    <div className="bg-background min-h-screen overflow-x-hidden theme-transition">
      {/* HERO */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden theme-transition">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-amber-50/60 dark:from-[#020911] dark:via-[#050D1F] dark:to-[#0A1828] transition-colors duration-500" />
        <div className="absolute inset-0 bg-[url('/hero7.png')] bg-cover bg-center opacity-20 dark:opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(212,175,55,0.16),transparent)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(212,175,55,0.10),transparent)]" />
        <div className="absolute top-1/4 -right-32 w-[600px] h-[600px] rounded-full bg-gold-400/10 dark:bg-gold-400/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 -left-32 w-[400px] h-[400px] rounded-full bg-amber-300/20 dark:bg-blue-500/5 blur-[100px] pointer-events-none" />

        <div className="container-max relative z-10 py-20">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full glass-gold theme-transition">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-semibold text-primary tracking-widest uppercase">
                Real World Asset Tokenization Platform
              </span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold text-foreground leading-tight">
              Own Real Estate,{" "}
              <span className="text-gradient">Powered by Blockchain</span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              RWAChain lets you invest in premium, verified real estate through
              fractional ownership tokens — starting from{" "}
              <span className="text-foreground font-semibold">$500</span>. Earn
              monthly rental income. Trade 24/7.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <Link to="/signup">
                <Button
                  size="lg"
                  className="px-8 py-6 text-base font-bold bg-gradient-primary text-primary-foreground hover:opacity-95 shadow-premium"
                >
                  Start Investing
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/marketplace">
                <Button
                  variant="outline"
                  size="lg"
                  className="px-8 py-6 text-base font-semibold border-border text-foreground hover:bg-primary/10 hover:border-primary/40"
                >
                  Explore Properties
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 pt-4">
              {[
                "Bank-Level Security",
                "Regulatory Compliant",
                "Fully Audited",
                "KYC Verified",
              ].map((t) => (
                <div
                  key={t}
                  className="flex items-center gap-2 text-sm text-foreground/80"
                >
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px gold-line" />
      </section>

      {/* STATS BAR */}
      <section className="py-12 bg-navy-800/70 border-y border-border theme-transition">
        <div className="container-max">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              {
                label: "Properties Listed",
                target: 150,
                suffix: "+",
                icon: Building2,
                color: "text-gold-400",
              },
              {
                label: "Total Value Locked",
                target: 50,
                suffix: "M+",
                icon: BarChart3,
                color: "text-blue-400",
                prefix: "$",
              },
              {
                label: "Verified Investors",
                target: 2500,
                suffix: "+",
                icon: Users,
                color: "text-green-400",
              },
              {
                label: "Avg Annual ROI",
                target: 12,
                suffix: "%",
                icon: TrendingUp,
                color: "text-amber-400",
              },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <s.icon className={`w-5 h-5 mx-auto mb-2 ${s.color}`} />
                <div className="text-3xl font-bold text-foreground">
                  <Counter
                    target={s.target}
                    suffix={s.suffix}
                    prefix={s.prefix || ""}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-1 font-medium">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED PROPERTIES */}
      {top3.length > 0 && (
        <section className="py-20 theme-transition">
          <div className="container-max">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-6 rounded-full bg-gold-400" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-gold-400">
                    Live Portfolio
                  </span>
                </div>
                <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
                  Featured Properties
                </h2>
                <p className="text-muted-foreground">
                  Actively funded, blockchain-verified real estate assets open
                  for investment.
                </p>
              </div>
              <Link to="/marketplace">
                <Button
                  variant="outline"
                  className="border-border text-foreground hover:bg-primary/10 hover:border-primary/40 gap-2"
                >
                  View All <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {top3.map((p) => (
                <PropertyNFTCard key={p.id} property={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      <section className="py-20 bg-navy-900 theme-transition">
        <div className="container-max">
          <div className="text-center mb-14 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-gold-400">
              Simple Process
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
              Invest in Real Estate in 3 Steps
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              From signup to earning rental income — the entire process takes
              less than 24 hours.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div
                key={i}
                className="bg-navy-700 border border-navy-500 rounded-2xl p-8 space-y-4 hover:border-gold-500/40 transition-colors theme-transition"
              >
                <div className="flex items-center gap-4">
                  <span className="font-display text-5xl font-bold text-gold-500/30">
                    {s.n}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/30 flex items-center justify-center">
                    <s.icon className="w-5 h-5 text-gold-400" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-foreground">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY RWACHAIN */}
      <section className="py-20 theme-transition">
        <div className="container-max">
          <div className="text-center mb-14 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-gold-400">
              Platform Advantages
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
              Why Choose RWAChain
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Built for serious investors who demand institutional-grade
              security and transparency.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {TRUST.map((t, i) => (
              <Card
                key={i}
                className="bg-navy-700 border-navy-500 hover:border-gold-400/40 transition-colors group theme-transition"
              >
                <CardContent className="pt-8 pb-6 space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center group-hover:bg-gold-400/15 transition-colors">
                    <t.icon className="w-6 h-6 text-gold-400" />
                  </div>
                  <h3 className="font-semibold text-foreground">{t.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* TOKENIZATION INFO */}
      <section className="py-20 bg-navy-900 border-y border-navy-500 theme-transition">
        <div className="container-max">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 rounded-full bg-gold-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-gold-400">
                  Tokenization Explained
                </span>
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
                What is Real Estate Tokenization?
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Real estate tokenization converts physical property ownership
                into digital tokens on a blockchain. Each token represents a
                fractional share of the property.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                For example, a $1,000,000 property divided into 1,000,000 tokens
                means each token is worth $1. Owning 10,000 tokens gives you 1%
                ownership — and 1% of all rental income.
              </p>
              <Link to="/how-it-works">
                <Button
                  variant="outline"
                  className="border-gold-500/50 text-gold-500 dark:text-gold-400 hover:bg-gold-400/10 gap-2 mt-2"
                >
                  Learn More <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  label: "Starting From",
                  value: "$500",
                  sub: "Minimum investment",
                },
                {
                  label: "Avg Annual ROI",
                  value: "8–16%",
                  sub: "Net rental + appreciation",
                },
                {
                  label: "Lock-in Period",
                  value: "None",
                  sub: "Trade tokens anytime",
                },
                {
                  label: "Asset Backing",
                  value: "100%",
                  sub: "Real property ownership",
                },
              ].map((s, i) => (
                <div
                  key={i}
                  className="bg-navy-700 border border-navy-500 rounded-xl p-5 space-y-1 theme-transition"
                >
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    {s.label}
                  </div>
                  <div className="text-2xl font-bold text-gold-400">
                    {s.value}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 theme-transition">
        <div className="container-max">
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-gold-200/40 via-white to-navy-800 dark:from-gold-700/20 dark:via-navy-700 dark:to-navy-800 transition-colors duration-500" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(212,175,55,0.15),transparent_60%)]" />
            <div className="relative z-10 py-16 px-8 text-center space-y-6">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
                Ready to Build Real Estate Wealth?
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto text-lg">
                Join thousands of investors earning passive income from
                tokenized properties on the blockchain — with full transparency
                and security.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/signup">
                  <Button
                    size="lg"
                    className="px-10 py-6 text-base font-bold bg-gradient-primary text-primary-foreground hover:opacity-95 shadow-premium"
                  >
                    Create Free Account
                  </Button>
                </Link>
                <Link to="/marketplace">
                  <Button
                    size="lg"
                    variant="outline"
                    className="px-10 py-6 text-base font-semibold border-border hover:bg-primary/10 hover:border-primary/40"
                  >
                    Browse Properties
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
