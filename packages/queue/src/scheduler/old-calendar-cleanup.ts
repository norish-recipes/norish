import { format, startOfMonth, subMonths } from "date-fns";
import { lte } from "drizzle-orm";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { db } from "@norish/db/drizzle";
import { plannedItems } from "@norish/db/schema";
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

    const result = await db.delete(plannedItems).where(lte(plannedItems.date, cutoffDateString));

    const plannedItemsDeleted = result.rowCount ?? 0;

    schedulerLogger.info({ deleted: plannedItemsDeleted }, "Old calendar cleanup complete");

    return { plannedItemsDeleted };
  } catch (err) {
    schedulerLogger.error({ err }, "Fatal error during calendar cleanup");

    return { plannedItemsDeleted: 0 };
  }
}
