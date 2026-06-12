import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, TrendingUp } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";

const HeroSectionComponent = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: "easeOut" },
    },
  };

  return (
    <section className="relative min-h-screen pt-20 pb-12 overflow-hidden bg-gradient-to-b from-background via-background to-primary/5 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/20 md:pb-20">
      {/* Animated Background Gradient */}
      <div className="absolute inset-0 opacity-30 dark:opacity-10">
        <div className="absolute rounded-full top-20 left-10 w-72 h-72 bg-primary/20 dark:bg-blue-600/10 mix-blend-multiply filter blur-3xl animate-blob" />
        <div className="absolute rounded-full top-40 right-10 w-72 h-72 bg-secondary/20 dark:bg-purple-600/10 mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute rounded-full -bottom-8 left-1/2 w-72 h-72 bg-accent/20 dark:bg-pink-600/10 mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000" />
      </div>

      {/* Content */}
      <div className="relative z-10 container-max">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          <motion.div
            className="flex items-center justify-center gap-2 mb-6"
            variants={itemVariants}
          >
            <span className="px-4 py-2 text-sm font-semibold border rounded-full bg-primary/10 dark:bg-blue-500/20 text-primary dark:text-blue-300 border-primary/20 dark:border-blue-500/30">
              🚀 The Future of Real Estate
            </span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            className="mb-6 text-5xl font-bold leading-tight md:text-7xl text-foreground dark:text-slate-50"
            variants={itemVariants}
          >
            Invest in Real Estate with{" "}
            <span className="text-transparent bg-gradient-to-r from-primary via-blue-500 to-blue-600 dark:from-blue-400 dark:via-blue-500 dark:to-blue-600 bg-clip-text">
              Blockchain
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="max-w-2xl mx-auto mb-8 text-lg leading-relaxed md:text-xl text-muted-foreground dark:text-slate-300"
            variants={itemVariants}
          >
            Own a fraction of premium properties starting from $100. Tokenized
            real estate investments made simple, secure, and accessible to
            everyone.
          </motion.p>

          {/* Stats */}
          <motion.div
            className="grid grid-cols-3 gap-4 mb-8 md:gap-8"
            variants={itemVariants}
          >
            {[
              { value: "$2.5B", label: "Assets Under Management" },
              { value: "50K+", label: "Active Investors" },
              { value: "1000+", label: "Properties Listed" },
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-2xl font-bold md:text-3xl text-primary dark:text-blue-400">
                  {stat.value}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground dark:text-slate-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col items-center justify-center gap-4 md:flex-row"
            variants={itemVariants}
          >
            <Link to="/marketplace">
              <Button
                size="lg"
                className="px-8 btn-primary dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white"
              >
                <TrendingUp className="w-5 h-5 mr-2" />
                Start Investing
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/how-it-works">
              <Button
                variant="outline"
                size="lg"
                className="px-8 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-900"
              >
                Learn More
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Feature Grid */}
        <motion.div
          className="grid grid-cols-1 gap-6 mt-16 md:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {[
            {
              icon: "🔒",
              title: "Secure",
              desc: "Blockchain-verified transactions",
            },
            {
              icon: "⚡",
              title: "Fast",
              desc: "Instant property ownership tokens",
            },
            {
              icon: "💰",
              title: "Affordable",
              desc: "Start with as low as $100",
            },
          ].map((feature, index) => (
            <motion.div
              key={index}
              className="p-6 transition-all border rounded-lg border-border dark:border-slate-700 bg-card/50 dark:bg-slate-900/50 backdrop-blur hover:border-primary dark:hover:border-blue-500"
              variants={itemVariants}
            >
              <div className="mb-3 text-3xl">{feature.icon}</div>
              <h3 className="mb-2 text-lg font-semibold text-foreground dark:text-slate-50">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground dark:text-slate-400">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export const HeroSection = memo(HeroSectionComponent);
