import path from "node:path";

export default {
  test: {
    root: path.resolve(import.meta.dirname, "../.."),
    environment: "jsdom",
    globals: true,
    env: {
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      SKIP_ENV_VALIDATION: "1",
      MASTER_KEY: "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=",
    },
    setupFiles: ["./apps/web/__tests__/setup.ts"],
    globalSetup: ["./packages/db/__tests__/setup/global-setup.ts"],
    hookTimeout: 60000,
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "**/node_modules/**", "dist-server", ".next"],
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
      "@/app": path.resolve(__dirname, "../../apps/web/app"),
      "@/components": path.resolve(__dirname, "../../apps/web/components"),
      "@/context": path.resolve(__dirname, "../../apps/web/context"),
      "@/hooks": path.resolve(__dirname, "../../apps/web/hooks"),
      "@/stores": path.resolve(__dirname, "../../apps/web/stores"),
      "@/styles": path.resolve(__dirname, "../../apps/web/styles"),
      "@/public": path.resolve(__dirname, "../../apps/web/public"),
      "@": path.resolve(__dirname, "../../"),
      "@norish/api": path.resolve(__dirname, "../../packages/api/src"),
      "@norish/auth": path.resolve(__dirname, "../../packages/auth/src"),
      "@norish/config": path.resolve(__dirname, "../../packages/config/src"),
      "@norish/db": path.resolve(__dirname, "../../packages/db/src"),
      "@norish/i18n": path.resolve(__dirname, "../../packages/i18n/src"),
      "@norish/queue": path.resolve(__dirname, "../../packages/queue/src"),
      "@norish/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@norish/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@norish/web": path.resolve(__dirname, "../../apps/web"),
    },
  },
};
