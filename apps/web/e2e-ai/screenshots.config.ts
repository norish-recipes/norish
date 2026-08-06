/**
 * Documentation screenshot capture.
 *
 * Reuses the production-like AI harness rather than a second stack: the same
 * real server, database, Redis, workers, and UI, with only the AI provider
 * faked. That is what makes the images reproducible — a screenshot is only
 * documentation if someone can regenerate it after the UI moves.
 *
 * Deliberately a separate config from `playwright.config.ts`, so capturing
 * images is never part of the acceptance gate.
 *
 * Prerequisites (Docker running, once per build):
 *   pnpm run build:web && pnpm run build:server        # repo root
 *   pnpm --filter @norish/web run screenshots:docs
 */
import { defineConfig } from "@playwright/test";

import { E2E_BASE_URL } from "./env";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.shot.ts",
  globalSetup: "./global-setup.ts",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  outputDir: "./.results",
  use: {
    baseURL: E2E_BASE_URL,
    headless: true,
    // 900 logical pixels at 2x, so the captures match the 1800px-wide
    // screenshots already in the docs.
    viewport: { width: 900, height: 1100 },
    deviceScaleFactor: 2,
  },
});
