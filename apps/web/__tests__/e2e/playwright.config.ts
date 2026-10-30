import { defineConfig } from "@playwright/test";

import { BUILT_BASE_PATH } from "./harness/build";
import { prepareRepositoryEnvironment } from "./harness/environment";

// Workers load this file before any spec, so the environment is set before a repository is imported.
prepareRepositoryEnvironment();

export default defineConfig({
  testDir: ".",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  // Each worker boots a whole stack (server, parser, Postgres, Valkey) beside its
  // browser, so a worker costs two to three cores and over a gigabyte. On a
  // 10-core, 16 GB Mac, 5 and 8 workers overloaded it into timing reds, and 4
  // swapped out gigabytes per run: renderers crashed and Docker took longer
  // than testcontainers' fixed 30 s to bind a container's ports. CI runners
  // have 4 vCPUs, so CI takes its parallelism from shards instead.
  workers: process.env.CI ? 1 : 3,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  outputDir: "./.results",
  use: {
    headless: true,
    serviceWorkers: "allow",
    trace: "retain-on-failure",
  },
  // A build for a base path runs only the base-path project; a root build runs the rest.
  projects: BUILT_BASE_PATH
    ? [{ name: "base-path", testMatch: "base-path/**/*.e2e.ts" }]
    : [
        { name: "offline", testMatch: "offline/**/*.e2e.ts" },
        { name: "ai", testMatch: "ai/**/*.e2e.ts" },
        { name: "realtime", testMatch: "realtime/**/*.e2e.ts" },
      ],
});
