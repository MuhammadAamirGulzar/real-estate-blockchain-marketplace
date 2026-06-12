import { Button } from "@/components/ui/button";
import {
  Building2,
  Coins,
  DollarSign,
  FileText,
  Lock,
  Shield,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

export default function HowItWorksPage() {
  const steps = [
    {
      icon: UserCheck,
      title: "1. Complete KYC Verification",
      description:
        "Verify your identity securely to comply with regulations and start investing.",
      features: [
        "Government ID verification",
        "Address proof",
        "Accredited investor status",
      ],
    },
    {
      icon: Building2,
      title: "2. Browse Properties",
      description:
        "Explore our curated selection of tokenized real estate opportunities.",
      features: [
        "Detailed property information",
        "Financial projections",
        "Virtual tours",
      ],
    },
    {
      icon: Coins,
      title: "3. Purchase Tokens",
      description:
        "Invest in fractional ownership starting from as little as $100.",
      features: [
        "Secure blockchain transactions",
        "Instant ownership confirmation",
        "Wallet integration",
      ],
    },
    {
      icon: TrendingUp,
      title: "4. Earn Returns",
      description:
        "Receive rental income and benefit from property appreciation.",
      features: [
        "Automatic dividend distribution",
        "Real-time portfolio tracking",
        "Secondary market liquidity",
      ],
    },
  ];

  const benefits = [
    {
      icon: DollarSign,
      title: "Low Entry Barrier",
      description:
        "Start investing with as little as $100, making real estate accessible to everyone.",
    },
    {
      icon: Shield,
      title: "Secure & Transparent",
      description:
        "Blockchain technology ensures transparency and immutable ownership records.",
    },
    {
      icon: Lock,
      title: "Regulatory Compliant",
      description:
        "Fully compliant with securities laws and real estate regulations.",
    },
    {
      icon: FileText,
      title: "Professional Management",
      description:
        "Properties are professionally managed, so you can invest passively.",
    },
  ];

  return (
    <main className="flex-1 bg-background">
      <section className="py-20 bg-gradient-to-b from-primary/5 to-background dark:from-primary/10">
        <div className="container-max">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="mb-6 text-4xl font-bold md:text-5xl text-foreground dark:text-foreground">
              How RWA Tokenization Works
            </h1>
            <p className="text-xl text-muted-foreground dark:text-muted-foreground">
              Invest in real estate through blockchain technology in four simple
              steps
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container-max">
          <div className="space-y-16">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`grid items-center gap-8 md:grid-cols-2 ${
                  index % 2 === 1 ? "md:flex-row-reverse" : ""
                }`}
              >
                <div className={index % 2 === 1 ? "md:order-2" : ""}>
                  <div className="p-8 rounded-xl card-base hover-lift dark:bg-card dark:border-border">
                    <step.icon className="w-12 h-12 mb-4 text-primary" />
                    <h3 className="mb-4 text-2xl font-bold text-foreground dark:text-foreground">
                      {step.title}
                    </h3>
                    <p className="mb-6 text-muted-foreground dark:text-muted-foreground">
                      {step.description}
                    </p>
                    <ul className="space-y-2">
                      {step.features.map((feature, idx) => (
                        <li
                          key={idx}
                          className="flex items-center gap-2 text-foreground dark:text-foreground"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className={index % 2 === 1 ? "md:order-1" : ""}>
                  <div className="flex items-center justify-center w-full h-64 rounded-lg bg-primary/10 dark:bg-primary/20">
                    <step.icon className="w-32 h-32 text-primary/30" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-muted/30 dark:bg-card/50">
        <div className="container-max">
          <h2 className="mb-12 text-3xl font-bold text-center text-foreground dark:text-foreground">
            Why Choose RWA Platform?
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="p-6 text-center rounded-xl card-base hover-lift dark:bg-card dark:border-border"
              >
                <benefit.icon className="w-12 h-12 mx-auto mb-4 text-gold-400" />
                <h3 className="mb-3 text-xl font-semibold text-foreground dark:text-foreground">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground dark:text-muted-foreground">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="text-center container-max">
          <div className="max-w-3xl p-12 mx-auto rounded-xl card-base dark:bg-card dark:border-border">
            <h2 className="mb-4 text-3xl font-bold text-foreground dark:text-foreground">
              Ready to Get Started?
            </h2>
            <p className="mb-8 text-lg text-muted-foreground dark:text-muted-foreground">
              Join thousands of investors building wealth through tokenized real
              estate
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/signup">
                <Button className="px-6 py-3 btn-primary">
                  Create Account
                </Button>
              </Link>
              <Link to="/marketplace">
                <Button variant="outline" className="px-6 py-3">
                  Browse Properties
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
