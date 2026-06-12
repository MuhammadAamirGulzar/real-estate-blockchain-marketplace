import { Button } from "@/components/ui/button";
import { Building2, Shield, TrendingUp, Users } from "lucide-react";
import { Link } from "react-router-dom";

export default function AboutPage() {
  const team = [
    { name: "Hassan Murtaza", role: "CEO & Co-Founder" },
    { name: "Ammar Ahmed", role: "Co-Founder" },
  ];

  const values = [
    {
      icon: Building2,
      title: "Transparency",
      description: "Full visibility into property ownership and transactions",
    },
    {
      icon: Users,
      title: "Accessibility",
      description: "Making real estate investment available to everyone",
    },
    {
      icon: TrendingUp,
      title: "Innovation",
      description: "Leveraging blockchain technology for secure transactions",
    },
    {
      icon: Shield,
      title: "Security",
      description: "Bank-grade security and regulatory compliance",
    },
  ];

  return (
    <>
      <main className="flex-1 bg-background">
        {/* Hero Section */}
        <section className="py-20 bg-gradient-to-b from-primary/5 to-background dark:from-primary/10">
          <div className="container-max">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="mb-6 text-4xl font-bold text-foreground dark:text-foreground md:text-5xl">
                About RWA Platform
              </h1>
              <p className="text-xl text-muted-foreground dark:text-muted-foreground">
                We're democratizing real estate investment through blockchain
                technology, making property ownership accessible to everyone.
              </p>
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section className="py-16">
          <div className="container-max">
            <div className="max-w-4xl mx-auto">
              <h2 className="mb-6 text-3xl font-bold text-center text-foreground dark:text-foreground">
                Our Mission
              </h2>
              <p className="mb-8 text-lg text-center text-muted-foreground dark:text-muted-foreground">
                Our mission is to revolutionize real estate investment by
                leveraging blockchain technology to create a transparent,
                accessible, and efficient marketplace for fractional property
                ownership.
              </p>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-16 bg-muted/30 dark:bg-card/50">
          <div className="container-max">
            <h2 className="mb-12 text-3xl font-bold text-center text-foreground dark:text-foreground">
              Our Values
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
              {values.map((value, index) => (
                <div
                  key={index}
                  className="p-6 text-center rounded-xl card-base hover-lift dark:bg-card dark:border-border"
                >
                  <value.icon className="w-12 h-12 mx-auto mb-4 text-primary" />
                  <h3 className="mb-3 text-xl font-semibold text-foreground dark:text-foreground">
                    {value.title}
                  </h3>
                  <p className="text-muted-foreground dark:text-muted-foreground">
                    {value.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="py-16">
          <div className="container-max">
            <h2 className="mb-12 text-3xl font-bold text-center text-foreground dark:text-foreground">
              Our Team
            </h2>
            <div className="grid max-w-3xl grid-cols-1 gap-8 mx-auto md:grid-cols-2">
              {team.map((member, index) => (
                <div
                  key={index}
                  className="p-6 text-center rounded-xl card-base hover-lift dark:bg-card dark:border-border"
                >
                  <div className="flex items-center justify-center w-32 h-32 mx-auto mb-4 rounded-full bg-primary/10">
                    <Users className="w-16 h-16 text-primary" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-foreground dark:text-foreground">
                    {member.name}
                  </h3>
                  <p className="text-muted-foreground dark:text-muted-foreground">
                    {member.role}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-gradient-to-b from-background to-primary/5 dark:from-background dark:to-primary/10">
          <div className="text-center container-max">
            <h2 className="mb-6 text-3xl font-bold text-foreground dark:text-foreground">
              Ready to Start Investing?
            </h2>
            <p className="max-w-2xl mx-auto mb-8 text-lg text-muted-foreground dark:text-muted-foreground">
              Join thousands of investors who are already building wealth
              through fractional real estate ownership.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/signup">
                <Button className="px-6 py-3 btn-primary">Get Started</Button>
              </Link>
              <Link to="/marketplace">
                <Button variant="outline" className="px-6 py-3">
                  View Properties
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
