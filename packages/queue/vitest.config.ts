import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    hookTimeout: 240000,
    testTimeout: 30000,
    include: ["**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["../config/__tests__/setup/master-key.ts"],
    env: {
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      SKIP_ENV_VALIDATION: "1",
      MASTER_KEY: "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=",
    },
  },
});
