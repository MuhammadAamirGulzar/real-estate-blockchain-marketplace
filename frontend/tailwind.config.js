/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* Theme-adaptive navy palette — references CSS variables */
        navy: {
          950: "hsl(var(--navy-950))",
          900: "hsl(var(--navy-900))",
          800: "hsl(var(--navy-800))",
          700: "hsl(var(--navy-700))",
          600: "hsl(var(--navy-600))",
          500: "hsl(var(--navy-500))",
          400: "hsl(var(--navy-400))",
          300: "hsl(var(--navy-300))",
          200: "hsl(var(--navy-200))",
          100: "hsl(var(--navy-100))",
          50: "hsl(var(--navy-50))",
        },
        gold: {
          950: "#2B210A",
          900: "#4A3A10",
          800: "#6B5518",
          700: "#8C7020",
          600: "#AB892A",
          500: "#C4A232",
          DEFAULT: "#D4AF37",
          400: "#D4AF37",
          300: "#DDBE5A",
          200: "#E8CE80",
          100: "#F0DEAA",
          50: "#F8EFD4",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ['"Playfair Display"', "Georgia", "serif"],
      },
      borderRadius: {
        lg: `var(--radius)`,
        md: `calc(var(--radius) - 2px)`,
        sm: `calc(var(--radius) - 4px)`,
      },
      backgroundImage: {
        "hero-pattern":
          "linear-gradient(160deg, hsl(var(--background)) 0%, hsl(var(--card)) 50%, hsl(var(--background)) 100%)",
        "gold-gradient":
          "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-hover)) 100%)",
        "card-gradient":
          "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "gold-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(212,175,55,0)" },
          "50%": { boxShadow: "0 0 0 6px rgba(212,175,55,0.15)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 3s linear infinite",
        "gold-pulse": "gold-pulse 2.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
