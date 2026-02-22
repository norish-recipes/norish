import { defineConfig } from "drizzle-kit";

// Skip validation for secrets that drizzle-kit doesn't need
process.env.SKIP_ENV_VALIDATION = "1";

import { SERVER_CONFIG } from "@norish/config/env-config-server";

if (!SERVER_CONFIG.DATABASE_URL) throw new Error("DATABASE_URL is not defined");

export default defineConfig({
  // Point directly to schema files (relative to project root)
  schema: "./packages/db/src/schema/**/*.ts",
  out: "./packages/db/src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: SERVER_CONFIG.DATABASE_URL,
  },
});
