import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packageDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@norish\/api(?=\/|$)/,
        replacement: path.resolve(packageDir, "../api/src"),
      },
      {
        find: /^@norish\/config(?=\/|$)/,
        replacement: path.resolve(packageDir, "../config/src"),
      },
      {
        find: /^@norish\/db(?=\/|$)/,
        replacement: path.resolve(packageDir, "src"),
      },
      {
        find: /^@norish\/queue(?=\/|$)/,
        replacement: path.resolve(packageDir, "../queue/src"),
      },
    ],
  },
  test: {
    environment: "node",
    globals: true,
    globalSetup: ["./__tests__/setup/global-setup.ts"],
    hookTimeout: 60000,
    include: ["**/*.{test,spec}.{ts,tsx}"],
    env: {
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      SKIP_ENV_VALIDATION: "1",
      MASTER_KEY: "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=",
    },
  },
});
