import { format, startOfMonth, subMonths } from "date-fns";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { deleteDoneGroceriesBefore } from "@norish/db/repositories/groceries";
import { schedulerLogger } from "@norish/shared-server/logger";

// Exludes recurring groceries
export async function cleanupOldGroceries(): Promise<{ deleted: number }> {
  try {
    // Calculate cutoff date - first day of (currentMonth - X)
    const retentionMonths = SERVER_CONFIG.SCHEDULER_CLEANUP_MONTHS;
    const today = new Date();
    const cutoffDate = startOfMonth(subMonths(today, retentionMonths));
    const cutoffDateString = format(cutoffDate, "yyyy-MM-dd");

    schedulerLogger.info(
      { cutoffDate: cutoffDateString, retentionMonths },
      "Deleting done groceries"
    );

    // Delete old done groceries (excludes recurring ones)
    const deleted = await deleteDoneGroceriesBefore(cutoffDateString);

    schedulerLogger.info({ deleted }, "Old groceries cleanup complete");

    return { deleted };
  } catch (err) {
    schedulerLogger.error({ err }, "Fatal error during groceries cleanup");

    return { deleted: 0 };
  }
}
