import { defineConfig } from "drizzle-kit";

import { SERVER_CONFIG } from "@norish/config/env-config-server";

// Skip validation for secrets that drizzle-kit doesn't need
process.env.SKIP_ENV_VALIDATION = "1";

if (!SERVER_CONFIG.DATABASE_URL) throw new Error("DATABASE_URL is not defined");

export default defineConfig({
  schema: "./src/schema/**/*.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: SERVER_CONFIG.DATABASE_URL,
  },
});
