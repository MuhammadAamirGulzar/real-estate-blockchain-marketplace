import { Card, CardContent } from "@/components/ui/card";
import { Award, FileCheck, Lock, Shield } from "lucide-react";
import { useMemo } from "react";

// Constants
const TRUST_FEATURES = [
  {
    id: "compliance",
    icon: Shield,
    title: "Bank-Grade Security",
    description:
      "Your investments are protected with enterprise-level encryption",
  },
  {
    id: "security",
    icon: Lock,
    title: "Blockchain Verified",
    description: "All transactions are immutable and transparent on-chain",
  },
  {
    id: "verification",
    icon: FileCheck,
    title: "Regulatory Compliant",
    description: "Fully compliant with securities and real estate regulations",
  },
  {
    id: "community",
    icon: Award,
    title: "Vetted Properties",
    description: "Every property is professionally audited before listing",
  },
];

const SECTION_CONTENT = {
  heading: "Why",
  headingHighlight: "Trust",
  headingEnd: "RWAchain?",
  description:
    "Security, compliance, and transparency are at the core of everything we do",
};

/**
 * Section Header Component
 * Displays title and description for trust section
 */
const SectionHeader = () => (
  <div className="mb-12 text-center sm:mb-16">
    <h2 className="mb-4 text-3xl font-bold sm:text-4xl lg:text-5xl text-balance text-foreground">
      {SECTION_CONTENT.heading}{" "}
      <span className="text-transparent bg-gradient-to-r from-primary to-secondary bg-clip-text">
        {SECTION_CONTENT.headingHighlight}
      </span>{" "}
      {SECTION_CONTENT.headingEnd}
    </h2>
    <p className="max-w-2xl mx-auto text-base leading-relaxed sm:text-lg lg:text-lg text-muted-foreground text-balance">
      {SECTION_CONTENT.description}
    </p>
  </div>
);

/**
 * Feature Icon Container Component
 * Displays icon with gradient background
 */
const FeatureIconContainer = ({ Icon }) => (
  <div className="flex justify-center mb-4">
    <div className="flex items-center justify-center w-16 h-16 transition-all duration-300 border rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/10 group-hover:bg-gradient-to-br group-hover:from-primary/20 group-hover:to-secondary/20">
      <Icon className="w-8 h-8 text-primary" />
    </div>
  </div>
);

/**
 * Feature Content Component
 * Displays feature title and description
 */
const FeatureContent = ({ title, description }) => (
  <div className="text-center">
    <h3 className="mb-3 text-lg font-semibold sm:text-xl text-foreground">
      {title}
    </h3>
    <p className="text-sm leading-relaxed sm:text-base text-muted-foreground">
      {description}
    </p>
  </div>
);

/**
 * Trust Feature Card Component
 * Individual feature card with icon, title, and description
 */
const TrustFeatureCard = ({ feature }) => (
  <Card className="relative overflow-hidden transition-all duration-300 group border-border bg-card hover:shadow-xl hover:border-primary/20">
    {/* Background gradient on hover */}
    <div className="absolute inset-0 transition-opacity duration-300 opacity-0 bg-gradient-to-br from-primary/5 to-secondary/5 group-hover:opacity-100" />

    {/* Content */}
    <CardContent className="relative p-6 space-y-4 sm:p-8">
      <FeatureIconContainer Icon={feature.icon} />
      <FeatureContent title={feature.title} description={feature.description} />
    </CardContent>
  </Card>
);

/**
 * Trust Features Grid Component
 * Renders grid of trust features
 */
const TrustFeaturesGrid = ({ features }) => (
  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 sm:gap-8">
    {features.map((feature) => (
      <TrustFeatureCard key={feature.id} feature={feature} />
    ))}
  </div>
);

/**
 * TrustSection Component
 * Landing page section highlighting platform trustworthiness.
 * Showcases compliance, security, verification, and community features.
 * Responsive design with smooth animations and professional styling.
 */
export function TrustSection() {
  // Memoize features to prevent recalculation
  const features = useMemo(() => TRUST_FEATURES, []);

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-muted/20">
      <div className="container px-4 mx-auto sm:px-6 lg:px-8">
        {/* Section Header */}
        <SectionHeader />

        {/* Trust Features Grid */}
        <TrustFeaturesGrid features={features} />
      </div>
    </section>
  );
}

export default TrustSection;
