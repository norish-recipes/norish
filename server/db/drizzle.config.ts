import { defineConfig } from "drizzle-kit";

// Skip validation for secrets that drizzle-kit doesn't need
process.env.SKIP_ENV_VALIDATION = "1";

import { SERVER_CONFIG } from "@/config/env-config-server";

if (!SERVER_CONFIG.DATABASE_URL) throw new Error("DATABASE_URL is not defined");

export default defineConfig({
  // Point directly to schema files (relative to project root)
  schema: "./server/db/schema/**/*.ts",
  out: "./server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: SERVER_CONFIG.DATABASE_URL,
  },
});
