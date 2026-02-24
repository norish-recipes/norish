import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

import { SERVER_CONFIG } from "@norish/config/env-config-server";

// Skip validation for secrets that drizzle-kit doesn't need
process.env.SKIP_ENV_VALIDATION = "1";

if (!SERVER_CONFIG.DATABASE_URL) throw new Error("DATABASE_URL is not defined");

const configDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  schema: resolve(configDir, "schema/**/*.ts"),
  out: resolve(configDir, "migrations"),
  dialect: "postgresql",
  dbCredentials: {
    url: SERVER_CONFIG.DATABASE_URL,
  },
});
