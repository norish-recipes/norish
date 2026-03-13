import fs from "node:fs";
import path from "node:path";

import { migrate } from "drizzle-orm/node-postgres/migrator";
import { resolveExistingWorkspacePath } from "@norish/api/lib/workspace-paths";
import { dbLogger } from "@norish/api/logger";
import { db } from "@norish/db";

const MIGRATIONS_RELATIVE_PATH = path.join("packages", "db", "src", "migrations");
const JOURNAL_FILENAME = path.join("meta", "_journal.json");

export function resolveMigrationsFolder(startDir = process.cwd()): string {
  const migrationsFolder = resolveExistingWorkspacePath(MIGRATIONS_RELATIVE_PATH, startDir);
  const journalPath = path.join(migrationsFolder, JOURNAL_FILENAME);

  if (!fs.existsSync(journalPath)) {
    throw new Error(`Unable to locate Drizzle migrations journal from ${startDir}`);
  }

  return migrationsFolder;
}

export async function runMigrations(): Promise<void> {
  dbLogger.info("Checking and applying DB migrations...");

  try {
    await migrate(db, { migrationsFolder: resolveMigrationsFolder() });
    dbLogger.info("Migrations complete");
  } catch (err) {
    dbLogger.error({ err }, "Migration failed");
    throw err;
  }
}
