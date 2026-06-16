import { format, startOfMonth, subMonths } from "date-fns";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { deletePlannedItemsBefore } from "@norish/db/repositories/planned-items";
import { schedulerLogger } from "@norish/shared-server/logger";

export async function cleanupOldCalendarData(): Promise<{
  plannedItemsDeleted: number;
}> {
  try {
    const retentionMonths = SERVER_CONFIG.SCHEDULER_CLEANUP_MONTHS;
    const today = new Date();
    const cutoffDate = startOfMonth(subMonths(today, retentionMonths));
    const cutoffDateString = format(cutoffDate, "yyyy-MM-dd");

    schedulerLogger.info(
      { cutoffDate: cutoffDateString, retentionMonths },
      "Deleting old calendar data"
    );

    const plannedItemsDeleted = await deletePlannedItemsBefore(cutoffDateString);

    schedulerLogger.info({ deleted: plannedItemsDeleted }, "Old calendar cleanup complete");

    return { plannedItemsDeleted };
  } catch (err) {
    schedulerLogger.error({ err }, "Fatal error during calendar cleanup");

    return { plannedItemsDeleted: 0 };
  }
}
