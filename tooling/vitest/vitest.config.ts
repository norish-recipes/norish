import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    env: {
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      SKIP_ENV_VALIDATION: "1",
      MASTER_KEY: "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=",
    },
    setupFiles: ["./tooling/vitest/setup.ts"],
    globalSetup: ["./__tests__/setup/global-setup.ts"],
    hookTimeout: 60000,
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist-server", ".next"],
    // NOTE: In Vitest 4.x, environmentMatchGlobs was removed.
    // Use `// @vitest-environment node` comment at top of server test files instead.
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules",
        "dist-server",
        ".next",
        "**/*.d.ts",
        "**/*.config.*",
        "**/types/**",
        "tooling/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../"),
    },
  },
});
