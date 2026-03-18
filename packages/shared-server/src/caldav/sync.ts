import { createLogger } from "@norish/shared-server/logger";

const log = createLogger("caldav-sync");

export async function syncAllFutureItems(userId: string): Promise<{
  totalSynced: number;
  totalFailed: number;
}> {
  log.info({ userId }, "syncAllFutureItems temporarily disabled during planned_items migration");

  return { totalSynced: 0, totalFailed: 0 };
}

export async function retryFailedSyncs(userId: string): Promise<{
  totalRetried: number;
  totalFailed: number;
}> {
  log.info({ userId }, "retryFailedSyncs temporarily disabled during planned_items migration");

  return { totalRetried: 0, totalFailed: 0 };
}
