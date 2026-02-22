import { migrate } from "drizzle-orm/node-postgres/migrator";

import { db } from "@norish/db";
import { dbLogger } from "@norish/api/logger";

export async function runMigrations(): Promise<void> {
  dbLogger.info("Checking and applying DB migrations...");

  try {
    await migrate(db, { migrationsFolder: "./packages/db/src/migrations" });
    dbLogger.info("Migrations complete");
  } catch (err) {
    dbLogger.error({ err }, "Migration failed");
    throw err;
  }
}
