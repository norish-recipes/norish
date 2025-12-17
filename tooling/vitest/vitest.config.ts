import path from "path";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

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
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist-server", ".next"],
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
