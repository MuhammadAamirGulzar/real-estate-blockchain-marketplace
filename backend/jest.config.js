export default {
  testEnvironment: "node",
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/**/*.js",
    "routes/**/*.js",
    "controllers/**/*.js",
    "utils/**/*.js",
    "!**/node_modules/**",
    "!**/coverage/**",
  ],
  testMatch: ["**/__tests__/**/*.js", "**/?(*.)+(spec|test).js"],
  coverageReporters: ["text", "lcov", "html"],
  verbose: true,
  testTimeout: 10000,
};
