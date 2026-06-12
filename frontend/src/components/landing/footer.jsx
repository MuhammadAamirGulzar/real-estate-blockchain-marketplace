import { Facebook, Linkedin, Mail, MapPin, Phone, Twitter } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  const currentYear = new Date().getFullYear();

  const links = {
    product: [
      { name: "Marketplace", href: "/marketplace" },
      { name: "How It Works", href: "/how-it-works" },
      { name: "Documentation", href: "/documentation" },
      { name: "Pricing", href: "/marketplace" },
    ],
    company: [
      { name: "About", href: "/about" },
      { name: "Blog", href: "/documentation" },
      { name: "Careers", href: "/contact" },
      { name: "Contact", href: "/contact" },
    ],
    legal: [
      { name: "Privacy Policy", href: "/privacy-policy" },
      { name: "Terms of Service", href: "/terms-of-service" },
      { name: "Cookie Policy", href: "/privacy-policy" },
      { name: "Compliance", href: "/documentation" },
    ],
  };

  const socials = [
    { icon: Facebook, href: "https://www.facebook.com", label: "Facebook" },
    { icon: Twitter, href: "https://x.com", label: "Twitter" },
    { icon: Linkedin, href: "https://www.linkedin.com", label: "LinkedIn" },
    { icon: Mail, href: "mailto:support@rwaplatform.com", label: "Email" },
  ];

  return (
    <footer className="border-t border-border bg-background theme-transition">
      {/* Main Footer Content */}
      <div className="py-12 container-max md:py-16">
        <div className="grid grid-cols-1 gap-8 mb-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand Section */}
          <div className="lg:col-span-1">
            <Link to="/" className="inline-flex items-center mb-4 group">
              <img
                src="/logo3.png"
                alt="RWAChain logo"
                className="w-16 h-16 rounded-lg object-cover ring-1 ring-border/60 transition-shadow group-hover:shadow-lg"
              />
            </Link>
            <p className="mb-4 text-sm text-muted-foreground">
              Tokenized real estate investment platform powered by blockchain
              technology.
            </p>
            <div className="flex gap-4">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target={social.href.startsWith("http") ? "_blank" : undefined}
                  rel={
                    social.href.startsWith("http")
                      ? "noopener noreferrer"
                      : undefined
                  }
                  aria-label={social.label}
                  className="flex items-center justify-center transition-colors rounded-lg w-9 h-9 bg-muted hover:bg-primary hover:text-primary-foreground"
                >
                  <social.icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="mb-4 text-sm font-semibold tracking-wider uppercase text-foreground">
              Product
            </h3>
            <ul className="space-y-3">
              {links.product.map((link) => (
                <li key={`${link.name}-${link.href}`}>
                  <Link
                    to={link.href}
                    className="text-sm transition-colors text-muted-foreground hover:text-primary"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="mb-4 text-sm font-semibold tracking-wider uppercase text-foreground">
              Company
            </h3>
            <ul className="space-y-3">
              {links.company.map((link) => (
                <li key={`${link.name}-${link.href}`}>
                  <Link
                    to={link.href}
                    className="text-sm transition-colors text-muted-foreground hover:text-primary"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="mb-4 text-sm font-semibold tracking-wider uppercase text-foreground">
              Legal
            </h3>
            <ul className="space-y-3">
              {links.legal.map((link) => (
                <li key={`${link.name}-${link.href}`}>
                  <Link
                    to={link.href}
                    className="text-sm transition-colors text-muted-foreground hover:text-primary"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="mb-4 text-sm font-semibold tracking-wider uppercase text-foreground">
              Contact
            </h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail size={16} className="flex-shrink-0 text-primary" />
                <a
                  href="mailto:support@rwaplatform.com"
                  className="transition-colors hover:text-primary"
                >
                  support@rwaplatform.com
                </a>
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone size={16} className="flex-shrink-0 text-primary" />
                <a
                  href="tel:+15551234567"
                  className="transition-colors hover:text-primary"
                >
                  +1 (555) 123-4567
                </a>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin
                  size={16}
                  className="text-primary flex-shrink-0 mt-0.5"
                />
                <span>123 Blockchain St, Crypto City, CC 12345</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="pt-8 border-t border-border">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              &copy; {currentYear} RWA Platform. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link
                to="/privacy-policy"
                className="text-sm transition-colors text-muted-foreground hover:text-primary"
              >
                Privacy
              </Link>
              <Link
                to="/terms-of-service"
                className="text-sm transition-colors text-muted-foreground hover:text-primary"
              >
                Terms
              </Link>
              <Link
                to="/privacy-policy"
                className="text-sm transition-colors text-muted-foreground hover:text-primary"
              >
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
