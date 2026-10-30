import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { resetDbConnection } from "@norish/db/drizzle";

import { UNCONNECTED_DATABASE_URL } from "./environment";

/** Point this worker's repository calls at its stack's database; call before the first one. */
export async function connectRepositories(databaseUrl: string): Promise<void> {
  SERVER_CONFIG.DATABASE_URL = databaseUrl;
  await resetDbConnection();
}

/** Close the pool before the database goes, and point repositories nowhere again. */
export async function disconnectRepositories(): Promise<void> {
  await connectRepositories(UNCONNECTED_DATABASE_URL);
}
