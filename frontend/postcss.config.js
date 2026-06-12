/**
 * PostCSS Configuration
 *
 * Processes CSS with plugins:
 * - tailwindcss: Utility-first CSS framework
 * - autoprefixer: Adds vendor prefixes for browser compatibility
 *
 * @type {import('postcss-load-config').Config}
 */
export default {
  plugins: {
    // Tailwind CSS - Utility-first CSS framework
    tailwindcss: {},

    // Autoprefixer - Adds vendor prefixes automatically
    autoprefixer: {},
  },
};
