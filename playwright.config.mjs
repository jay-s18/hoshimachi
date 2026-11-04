import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  testMatch: "*.spec.mjs",
  timeout: 60_000,
  use: { baseURL: "http://localhost:8123", ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 } },
  webServer: { command: "node tools/serve.mjs app 8123", url: "http://localhost:8123", reuseExistingServer: !process.env.CI },
  reporter: process.env.CI ? "github" : "list",
});
