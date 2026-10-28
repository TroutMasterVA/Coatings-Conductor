import { defineConfig, devices } from "@playwright/test";

/**
 * Real-browser smoke tests against a deployed preview.
 * BASE_URL is required, e.g. BASE_URL=https://<preview>.vercel.app npx playwright test
 */
const baseURL = process.env.BASE_URL?.trim();
if (!baseURL) {
  throw new Error(
    "BASE_URL is not set. Point it at a deployed preview, e.g. BASE_URL=https://<preview>.vercel.app npx playwright test",
  );
}

export default defineConfig({
  testDir: "tests/smoke",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  // Previews share one database and the forecast cap is per client: keep load gentle.
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    screenshot: "on",
    video: "on",
    trace: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    // Stands in for Safari and DuckDuckGo on iOS (both use WebKit there).
    { name: "iphone-webkit", use: { ...devices["iPhone 14"] } },
    { name: "android-chromium", use: { ...devices["Pixel 7"] } },
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
  ],
});
