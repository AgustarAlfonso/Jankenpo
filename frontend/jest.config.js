module.exports = {
  preset: "jest-puppeteer",
  testMatch: ["**/tests/**/*.test.js"],
  testEnvironment: "jest-environment-puppeteer",
  transform: {} // To allow testing native ES Modules if needed
};
