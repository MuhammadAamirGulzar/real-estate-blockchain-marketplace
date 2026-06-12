import { Footer } from "@/components/landing/footer";
import { Header } from "@/components/navigation/header";

export default function PrivacyPolicyPage() {
  const sections = [
    {
      title: "Information We Collect",
      content:
        "We collect information you provide directly to us, including personal information, KYC documentation, and transaction data necessary to facilitate real estate investments.",
    },
    {
      title: "How We Use Your Information",
      content:
        "Your information is used to verify identity, process transactions, comply with legal requirements, and improve our services.",
    },
    {
      title: "Data Security",
      content:
        "We implement industry-standard security measures to protect your personal information and financial data.",
    },
    {
      title: "Your Rights",
      content:
        "You have the right to access, correct, or delete your personal information. Contact us to exercise these rights.",
    },
  ];

  return (
    <>
      <Header />
      <main className="flex-1 py-12 bg-background">
        <div className="container-max">
          <div className="max-w-4xl mx-auto">
            <h1 className="mb-4 text-4xl font-bold text-foreground">
              Privacy Policy
            </h1>
            <p className="mb-8 text-muted-foreground">
              Last updated: November 2024
            </p>

            <div className="space-y-8 text-foreground">
              {sections.map((section, index) => {
                return (
                  <section key={index}>
                    <h2 className="mb-4 text-2xl font-semibold">
                      {section.title}
                    </h2>
                    <p className="leading-relaxed text-muted-foreground">
                      {section.content}
                    </p>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
