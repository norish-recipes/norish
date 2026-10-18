import { defineConfig } from "@playwright/test";

// A base-path build carries NEXT_PUBLIC_BASE_PATH at build time. The project
// only exists when the build was made for that prefix, so the default
// `pnpm test:e2e` against a root build never picks up its specs (ADR-0040).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default defineConfig({
  testDir: ".",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  // Each worker boots a whole stack (server, parser, Postgres, Redis) beside its
  // browser, so a worker costs two to three cores. On a 10-core Mac 4 workers
  // ran the suite in 5 minutes; 5 and 8 overloaded it into timing reds. CI
  // runners have 4 vCPUs, so CI takes its parallelism from shards instead.
  workers: process.env.CI ? 1 : "40%",
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
    { name: "realtime", testMatch: "realtime/**/*.e2e.ts" },
    ...(basePath ? [{ name: "base-path", testMatch: "base-path/**/*.e2e.ts" }] : []),
  ],
});
