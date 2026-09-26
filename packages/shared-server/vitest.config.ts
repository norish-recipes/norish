import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // The ingredient resolver's tests start a Postgres container.
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
