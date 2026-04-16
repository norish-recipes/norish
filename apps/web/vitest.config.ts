import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    setupFiles: ["./__tests__/setup.ts"],
    globalSetup: ["../../packages/db/__tests__/setup/global-setup.ts"],
    hookTimeout: 60000,
    testTimeout: 15000,
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "**/node_modules/**", "dist-server", ".next"],
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
      ],
    },
  },
  resolve: {
    alias: {
      "@": __dirname,
      "@/app": path.resolve(__dirname, "app"),
      "@/components": path.resolve(__dirname, "components"),
      "@/context": path.resolve(__dirname, "context"),
      "@/hooks": path.resolve(__dirname, "hooks"),
      "@/stores": path.resolve(__dirname, "stores"),
      "@/styles": path.resolve(__dirname, "styles"),
      "@/public": path.resolve(__dirname, "public"),
      "@norish/web": __dirname,
    },
  },
});
