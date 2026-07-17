import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.NORISH_E2E_BASE_URL ?? "http://localhost:3300";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  // Development-mode route compilation can consume most of a minute before
  // an offline scenario opens its second, fresh page.
  timeout: 180_000,
  expect: { timeout: 30_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "line",
  outputDir: "./test-results/e2e",
  use: {
    baseURL,
    serviceWorkers: "allow",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "pnpm run e2e:server",
    url: `${baseURL}/api/v1/health`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "./e2e/.auth/primary.json",
      },
    },
  ],
});
