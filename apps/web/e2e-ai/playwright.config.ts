/**
 * Production-like AI E2E harness.
 *
 * The highest acceptance seam for AI-backed background work: a production build
 * in a real browser, with the real database, Redis, queue registry, and workers
 * all running, and only the third-party AI-provider HTTP boundary replaced by a
 * deterministic in-harness provider (./ai-provider.ts). Reusable by every
 * production-like AI browser scenario.
 *
 * Prerequisites (Docker running, once per build):
 *   pnpm run build:web && pnpm run build:server        # repo root
 *   pnpm --filter @norish/web run test:e2e:ai
 */
import { defineConfig } from "@playwright/test";

import { E2E_BASE_URL } from "./env";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.e2e.ts",
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  // One worker, serial: scenarios share one server lifecycle and one queue.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  outputDir: "./.results",
  use: {
    baseURL: E2E_BASE_URL,
    headless: true,
    trace: "retain-on-failure",
  },
});
