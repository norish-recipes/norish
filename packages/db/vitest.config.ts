import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    globalSetup: ["./__tests__/setup/global-setup.ts"],
    hookTimeout: 60000,
    include: ["**/*.{test,spec}.{ts,tsx}"],
  },
});
