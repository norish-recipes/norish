import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    // Inlined so a test's mocks of its native imports (expo-linking, react-native) apply.
    server: { deps: { inline: ["@better-auth/expo"] } },
  },
});
