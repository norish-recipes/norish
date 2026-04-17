import { defineConfig } from "drizzle-kit";

// Skip validation for secrets that drizzle-kit doesn't need
process.env.SKIP_ENV_VALIDATION = "1";

const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:norish@localhost:5432/norish";

if (!databaseUrl) throw new Error("DATABASE_URL is not defined");

export default defineConfig({
  schema: "./src/schema/**/*.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
