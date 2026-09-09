import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packageDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        // Tests exercise the sources, not the copy of this package that pnpm
        // injects into node_modules; the copy goes stale on every edit.
        find: /^@norish\/api(?=\/|$)/,
        replacement: path.resolve(packageDir, "src"),
      },
    ],
  },
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.{test,spec}.{ts,tsx}"],
    env: {
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      SKIP_ENV_VALIDATION: "1",
      MASTER_KEY: "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=",
    },
  },
});
