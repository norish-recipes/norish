import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    // CI exports NODE_ENV=production, which resolves React to its production
    // build — that build omits `act`, so every hook test here dies with
    // "act is not a function". Tests always want the development build.
    env: { NODE_ENV: "development" },
    include: ["**/*.{test,spec}.{ts,tsx}"],
  },
});
