import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { resetDbConnection } from "@norish/db/drizzle";

import { openBase64MasterKey } from "../../../../../packages/config/__tests__/helpers/master-key";
import { MASTER_KEY, UNCONNECTED_DATABASE_URL } from "./environment";

/** Point this worker's repository calls at its stack's database; call before the first one. */
export async function connectRepositories(databaseUrl: string): Promise<void> {
  SERVER_CONFIG.DATABASE_URL = databaseUrl;
  await resetDbConnection();
  // The stack's server resolved this key at its boot; the worker only opens it.
  openBase64MasterKey(MASTER_KEY);
}

/** Close the pool before the database goes, and point repositories nowhere again. */
export async function disconnectRepositories(): Promise<void> {
  await connectRepositories(UNCONNECTED_DATABASE_URL);
}
