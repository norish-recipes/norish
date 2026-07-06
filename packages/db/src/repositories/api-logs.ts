import type { NewApiLog } from "@norish/db/schema/api-logs";
import { db } from "@norish/db/drizzle";
import { apiLogs } from "@norish/db/schema/api-logs";

export async function insertApiLog(record: NewApiLog): Promise<void> {
  await db.insert(apiLogs).values(record);
}
