import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  outputDir: "./.results",
  use: {
    headless: true,
    serviceWorkers: "allow",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "offline", testMatch: "offline/**/*.e2e.ts" },
    { name: "ai", testMatch: "ai/**/*.e2e.ts" },
  ],
});
