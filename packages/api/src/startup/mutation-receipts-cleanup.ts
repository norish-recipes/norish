import { cleanupExpiredMutationReceipts } from "@norish/db/repositories/mutation-receipts";
import { schedulerLogger } from "@norish/shared-server/logger";
import { recordReceiptMetric } from "@norish/trpc/server";

export async function runMutationReceiptCleanup(): Promise<number> {
  const deleted = await cleanupExpiredMutationReceipts();

  if (deleted > 0) {
    for (let index = 0; index < deleted; index += 1) {
      recordReceiptMetric("expiry");
    }
  }

  schedulerLogger.info({ deleted }, "Mutation receipt cleanup complete");

  return deleted;
}
