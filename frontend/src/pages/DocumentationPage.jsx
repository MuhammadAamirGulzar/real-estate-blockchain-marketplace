import { Footer } from "@/components/landing/footer";
import { Header } from "@/components/navigation/header";
import { Book, Code, FileText, HelpCircle } from "lucide-react";

export default function DocumentationPage() {
  const sections = [
    {
      icon: Book,
      title: "Getting Started",
      description: "Learn the basics of investing in tokenized real estate",
      items: [
        "Create an account",
        "Complete KYC verification",
        "Browse properties",
        "Make your first investment",
      ],
    },
    {
      icon: Code,
      title: "Smart Contracts",
      description: "Understand the blockchain technology behind RWA",
      items: [
        "Property tokenization",
        "Investment management",
        "Revenue distribution",
        "Secondary market",
      ],
    },
    {
      icon: FileText,
      title: "Legal & Compliance",
      description: "Important regulatory information",
      items: [
        "Terms of service",
        "Privacy policy",
        "KYC requirements",
        "Tax implications",
      ],
    },
    {
      icon: HelpCircle,
      title: "FAQ",
      description: "Common questions and answers",
      items: [
        "How does tokenization work?",
        "What are the fees?",
        "How do I receive returns?",
        "Can I sell my tokens?",
      ],
    },
  ];

  return (
    <>
      <Header />
      <div className="py-12 bg-background dark:bg-background">
        <div className="container-max">
          <div className="max-w-4xl mx-auto">
            <h1 className="mb-4 text-4xl font-bold text-foreground dark:text-foreground">
              Documentation
            </h1>
            <p className="mb-12 text-xl text-muted-foreground dark:text-muted-foreground">
              Everything you need to know about investing in tokenized real
              estate
            </p>

            <div className="grid gap-8">
              {sections.map((section, index) => (
                <div
                  key={index}
                  className="p-6 card-base dark:bg-card dark:border-border"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10">
                      <section.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h2 className="mb-2 text-2xl font-semibold text-foreground dark:text-foreground">
                        {section.title}
                      </h2>
                      <p className="mb-4 text-muted-foreground dark:text-muted-foreground">
                        {section.description}
                      </p>
                      <ul className="space-y-2">
                        {section.items.map((item, idx) => (
                          <li
                            key={idx}
                            className="flex items-center gap-2 text-foreground dark:text-foreground"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
