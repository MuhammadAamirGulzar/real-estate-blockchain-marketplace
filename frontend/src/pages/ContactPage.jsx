import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  CheckCircle,
  Clock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
} from "lucide-react";
import { useCallback, useState } from "react";

/**
 * Animation variants for framer-motion
 * Memoized to prevent recreation on every render
 */
const ANIMATION_VARIANTS = Object.freeze({
  container: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.05 },
    },
  },
  item: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  },
  fadeInUp: {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  },
});

/**
 * Contact methods data configuration
 */
const CONTACT_METHODS = Object.freeze([
  {
    icon: Mail,
    title: "Email Us",
    content: "support@rwachain.com",
    description: "We'll respond within 24 hours",
  },
  {
    icon: Phone,
    title: "Call Us",
    content: "+1 (555) 123-4567",
    description: "Mon-Fri, 9am-6pm EST",
  },
  {
    icon: MessageSquare,
    title: "Live Chat",
    content: "Available Now",
    description: "Chat with our support team",
  },
  {
    icon: Clock,
    title: "Office Hours",
    content: "9:00 AM - 6:00 PM EST",
    description: "Monday through Friday",
  },
]);

/**
 * Office locations data configuration
 */
const OFFICES = Object.freeze([
  {
    city: "New York",
    address: "350 5th Avenue, Suite 5000",
    state: "New York, NY 10118",
    phone: "+1 (555) 123-4567",
    email: "newyork@rwachain.com",
  },
  {
    city: "San Francisco",
    address: "100 California Street, Suite 2000",
    state: "San Francisco, CA 94111",
    phone: "+1 (555) 234-5678",
    email: "sanfrancisco@rwachain.com",
  },
  {
    city: "London",
    address: "1 Canada Square, Level 30",
    state: "London, E14 5AB, UK",
    phone: "+44 20 1234 5678",
    email: "london@rwachain.com",
  },
]);

/**
 * FAQ data configuration
 */
const FAQS = Object.freeze([
  {
    question: "How do I get started investing?",
    answer:
      "Create an account, complete KYC verification, and you can start investing with as little as $100.",
  },
  {
    question: "What are the minimum investment requirements?",
    answer:
      "The minimum investment varies by property, but typically starts at $100 (approximately 1-2 tokens).",
  },
  {
    question: "How do I receive returns on my investment?",
    answer:
      "Returns are distributed monthly as dividends directly to your wallet based on your token ownership.",
  },
  {
    question: "Can I sell my tokens?",
    answer:
      "Yes, you can trade your tokens 24/7 on our marketplace with instant settlement.",
  },
]);

/**
 * Initial form state
 */
const INITIAL_FORM_STATE = Object.freeze({
  name: "",
  email: "",
  subject: "",
  message: "",
});

/**
 * ContactMethodCard Component
 */
const ContactMethodCard = ({
  icon: Icon,
  title,
  content,
  description,
  index,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
    >
      <Card className="h-full transition-all duration-300 bg-white border dark:bg-card border-border dark:border-border hover:shadow-lg hover:border-primary/30 dark:hover:shadow-primary/20">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 transition-colors duration-300 rounded-lg bg-primary/10 dark:bg-primary/20 group-hover:bg-primary dark:group-hover:bg-primary/80">
            <Icon className="w-6 h-6 text-primary dark:text-primary" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-foreground dark:text-foreground">
            {title}
          </h3>
          <p className="mb-1 font-medium text-primary dark:text-primary">
            {content}
          </p>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground">
            {description}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
};

/**
 * OfficeCard Component
 */
const OfficeCard = ({ city, address, state, phone, email, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
    >
      <Card className="transition-all duration-300 bg-white border dark:bg-card border-border dark:border-border hover:shadow-lg hover:border-primary/30 dark:hover:shadow-primary/20">
        <CardContent className="p-6">
          <h3 className="mb-4 text-xl font-bold text-foreground dark:text-foreground">
            {city}
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary dark:text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-foreground dark:text-foreground">
                  {address}
                </p>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                  {state}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="flex-shrink-0 w-5 h-5 text-primary dark:text-primary" />
              <p className="text-sm text-foreground dark:text-foreground">
                {phone}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="flex-shrink-0 w-5 h-5 text-primary dark:text-primary" />
              <p className="text-sm text-foreground dark:text-foreground">
                {email}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

/**
 * FAQItem Component
 */
const FAQItem = ({ question, answer, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
    >
      <Card className="transition-all duration-300 bg-white border dark:bg-card border-border dark:border-border hover:shadow-lg hover:border-primary/30 dark:hover:shadow-primary/20">
        <CardContent className="p-6">
          <h3 className="mb-3 text-base font-semibold text-foreground dark:text-foreground">
            {question}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground dark:text-muted-foreground">
            {answer}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
};

/**
 * SuccessMessage Component
 */
const SuccessMessage = () => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className="py-12 text-center"
    >
      <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-secondary/10 dark:bg-secondary/20">
        <CheckCircle className="w-8 h-8 text-secondary dark:text-secondary" />
      </div>
      <h3 className="mb-2 text-xl font-bold text-foreground dark:text-foreground">
        Message Sent!
      </h3>
      <p className="text-muted-foreground dark:text-muted-foreground">
        Thank you for contacting us. We'll respond within 24 hours.
      </p>
    </motion.div>
  );
};

/**
 * ContactForm Component
 */
const ContactForm = ({ formData, onSubmit, onChange, isSubmitted }) => {
  return (
    <Card className="transition-all duration-300 bg-white border dark:bg-card dark:border-border hover:shadow-lg dark:hover:shadow-primary/20">
      <CardHeader>
        <CardTitle className="text-2xl text-foreground dark:text-foreground">
          Send Us a Message
        </CardTitle>
        <p className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground">
          Fill out the form below and we'll get back to you within 24 hours
        </p>
      </CardHeader>
      <CardContent>
        {isSubmitted ? (
          <SuccessMessage />
        ) : (
          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <label className="block mb-2 text-sm font-medium text-foreground dark:text-foreground">
                Full Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={onChange}
                required
                className="w-full px-4 py-3 transition-all duration-200 border rounded-lg border-border dark:border-border bg-input dark:bg-input text-foreground dark:text-foreground placeholder-muted-foreground dark:placeholder-muted-foreground hover:border-primary/50 dark:hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-foreground dark:text-foreground">
                Email Address <span className="text-destructive">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={onChange}
                required
                className="w-full px-4 py-3 transition-all duration-200 border rounded-lg border-border dark:border-border bg-input dark:bg-input text-foreground dark:text-foreground placeholder-muted-foreground dark:placeholder-muted-foreground hover:border-primary/50 dark:hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-foreground dark:text-foreground">
                Subject <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={onChange}
                required
                className="w-full px-4 py-3 transition-all duration-200 border rounded-lg border-border dark:border-border bg-input dark:bg-input text-foreground dark:text-foreground placeholder-muted-foreground dark:placeholder-muted-foreground hover:border-primary/50 dark:hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="How can we help?"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-foreground dark:text-foreground">
                Message <span className="text-destructive">*</span>
              </label>
              <textarea
                name="message"
                value={formData.message}
                onChange={onChange}
                required
                rows={6}
                className="w-full px-4 py-3 transition-all duration-200 border rounded-lg resize-none border-border dark:border-border bg-input dark:bg-input text-foreground dark:text-foreground placeholder-muted-foreground dark:placeholder-muted-foreground hover:border-primary/50 dark:hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Tell us more about your inquiry..."
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="flex items-center justify-center w-full h-12 gap-2 px-6 font-semibold transition-all duration-200 rounded-lg shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-xl dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/80 dark:hover:shadow-primary/30 active:scale-95"
            >
              <Send className="w-5 h-5" />
              <span>Send Message</span>
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * HeroSection Component
 */
const HeroSection = () => {
  return (
    <section className="relative py-16 overflow-hidden sm:py-20 lg:py-24">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 dark:from-primary/10 dark:to-secondary/10 -z-10" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] -z-10" />

      <div className="container px-4 mx-auto sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-3xl mx-auto text-center"
        >
          <h1 className="mb-6 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl text-foreground dark:text-foreground">
            Get In <span className="text-primary dark:text-primary">Touch</span>
          </h1>
          <p className="text-base leading-relaxed sm:text-lg lg:text-xl text-muted-foreground dark:text-muted-foreground">
            Have questions? We're here to help. Reach out to our team and we'll
            get back to you as soon as possible.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

/**
 * ContactMethodsSection Component
 */
const ContactMethodsSection = () => {
  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="container px-4 mx-auto sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {CONTACT_METHODS.map((method, index) => (
            <ContactMethodCard
              key={`${method.title}-${index}`}
              {...method}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

/**
 * FormAndOfficesSection Component
 */
const FormAndOfficesSection = ({
  formData,
  onSubmit,
  onChange,
  isSubmitted,
}) => {
  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="container px-4 mx-auto sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
          <ContactForm
            formData={formData}
            onSubmit={onSubmit}
            onChange={onChange}
            isSubmitted={isSubmitted}
          />

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <h2 className="mb-2 text-3xl font-bold text-foreground dark:text-foreground">
                Our Offices
              </h2>
              <p className="leading-relaxed text-muted-foreground dark:text-muted-foreground">
                Visit us at one of our global locations
              </p>
            </motion.div>

            {OFFICES.map((office, index) => (
              <OfficeCard
                key={`${office.city}-${index}`}
                {...office}
                index={index}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

/**
 * FAQSection Component
 */
const FAQSection = () => {
  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-accent/5 dark:bg-card/30 border-y border-border dark:border-border">
      <div className="container px-4 mx-auto sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-12 text-center sm:mb-16"
        >
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl text-foreground dark:text-foreground">
            Frequently Asked{" "}
            <span className="text-primary dark:text-primary">Questions</span>
          </h2>
          <p className="max-w-2xl mx-auto text-base leading-relaxed sm:text-lg text-muted-foreground dark:text-muted-foreground">
            Find quick answers to common questions about investing with RWAchain
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto space-y-4">
          {FAQS.map((faq, index) => (
            <FAQItem key={`${faq.question}-${index}`} {...faq} index={index} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="mb-4 text-muted-foreground dark:text-muted-foreground">
            Can't find what you're looking for?
          </p>
          <Button className="h-12 px-8 font-semibold transition-all duration-200 rounded-lg shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-xl dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/80 dark:hover:shadow-primary/30">
            View All FAQs
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

/**
 * NewsletterSection Component
 */
const NewsletterSection = () => {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = useCallback(
    (e) => {
      e.preventDefault();
      if (email) {
        setSubscribed(true);
        setEmail("");
        setTimeout(() => setSubscribed(false), 3000);
      }
    },
    [email]
  );

  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="container px-4 mx-auto sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <Card className="transition-all duration-300 border bg-gradient-to-r from-primary/5 to-secondary/5 dark:from-primary/10 dark:to-secondary/10 border-primary/10 dark:border-primary/20 hover:shadow-lg dark:hover:shadow-primary/20">
            <CardContent className="p-8 text-center sm:p-12">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl text-foreground dark:text-foreground">
                Stay Updated
              </h2>
              <p className="max-w-2xl mx-auto mb-8 text-base leading-relaxed text-muted-foreground dark:text-muted-foreground sm:text-lg">
                Subscribe to our newsletter for the latest property listings,
                market insights, and platform updates
              </p>

              {subscribed ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center justify-center gap-2 font-semibold text-secondary dark:text-secondary"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Thanks for subscribing!</span>
                </motion.div>
              ) : (
                <form
                  onSubmit={handleSubscribe}
                  className="flex flex-col max-w-md gap-4 mx-auto sm:flex-row"
                >
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="flex-1 px-4 py-3 transition-all duration-200 bg-white border rounded-lg dark:bg-input border-border dark:border-border text-foreground dark:text-foreground placeholder-muted-foreground dark:placeholder-muted-foreground hover:border-primary/50 dark:hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <Button
                    type="submit"
                    className="h-12 px-6 font-semibold transition-all duration-200 rounded-lg shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-xl dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/80 dark:hover:shadow-primary/30 whitespace-nowrap"
                  >
                    Subscribe
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
};

/**
 * ContactPage Component
 */
export default function ContactPage() {
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();

      if (
        !formData.name ||
        !formData.email ||
        !formData.subject ||
        !formData.message
      ) {
        return;
      }

      setSubmitted(true);

      const timer = setTimeout(() => {
        setSubmitted(false);
        setFormData(INITIAL_FORM_STATE);
      }, 3000);

      return () => clearTimeout(timer);
    },
    [formData]
  );

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  return (
    <div className="bg-background dark:bg-background text-foreground dark:text-foreground">
      <HeroSection />
      <ContactMethodsSection />
      <FormAndOfficesSection
        formData={formData}
        onSubmit={handleSubmit}
        onChange={handleChange}
        isSubmitted={submitted}
      />
      <FAQSection />
      <NewsletterSection />
    </div>
  );
}
