/**
 * Backend-down browser suite (ADR-0009).
 *
 * The highest acceptance seam: a production build in a real browser with the
 * backend genuinely stopped — installed service worker, real IndexedDB,
 * Cache Storage, document navigations, and the app providers together.
 *
 * Prerequisites (Docker running, once per build):
 *   pnpm run build:web && pnpm run build:server   # repo root
 *   pnpm --filter @norish/web run test:e2e
 */
import { defineConfig } from "@playwright/test";

import { E2E_BASE_URL } from "./env";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.e2e.ts",
  globalSetup: "./global-setup.ts",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  // One worker, serial: the tests share one server lifecycle and one queue.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  outputDir: "./.results",
  use: {
    baseURL: E2E_BASE_URL,
    headless: true,
    serviceWorkers: "allow",
    trace: "retain-on-failure",
  },
});
