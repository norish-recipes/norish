import cron from "node-cron";

import { schedulerLogger } from "@/server/logger";
import { checkRecurringGroceries } from "@/server/scheduler/recurring-grocery-check";
import { cleanupOrphanedImages, cleanupOrphanedAvatars } from "@/server/startup/image-cleanup";
import { cleanupOldCalendarData } from "@/server/scheduler/old-calendar-cleanup";
import { cleanupOldGroceries } from "@/server/scheduler/old-groceries-cleanup";
import { retryFailedCalDavSyncs } from "@/server/scheduler/caldav-retry";

export async function runScheduledCleanup() {
  schedulerLogger.info("Running all scheduled cleanup tasks");

  // Run all scheduler jobs (no longer using event bus)
  try {
    // Recurring Grocery Check
    schedulerLogger.info("Recurring grocery check triggered");
    const groceryResult = await checkRecurringGroceries();

    schedulerLogger.info(
      { unchecked: groceryResult.unchecked },
      "Recurring grocery check completed"
    );
  } catch (err) {
    schedulerLogger.error({ err }, "Recurring grocery check failed");
  }

  try {
    // Image Cleanup
    schedulerLogger.info("Image cleanup triggered");
    const recipeResult = await cleanupOrphanedImages();

    schedulerLogger.info(
      { deleted: recipeResult.deleted, errors: recipeResult.errors },
      "Recipe image cleanup completed"
    );
    const avatarResult = await cleanupOrphanedAvatars();

    schedulerLogger.info(
      { deleted: avatarResult.deleted, errors: avatarResult.errors },
      "Avatar cleanup completed"
    );
    schedulerLogger.info(
      {
        totalDeleted: recipeResult.deleted + avatarResult.deleted,
        totalErrors: recipeResult.errors + avatarResult.errors,
      },
      "Total image cleanup complete"
    );
  } catch (err) {
    schedulerLogger.error({ err }, "Image cleanup failed");
  }

  try {
    // Old Calendar Data Cleanup
    schedulerLogger.info("Old calendar data cleanup triggered");
    const calendarResult = await cleanupOldCalendarData();

    schedulerLogger.info(
      {
        plannedRecipesDeleted: calendarResult.plannedRecipesDeleted,
        notesDeleted: calendarResult.notesDeleted,
      },
      "Old calendar cleanup completed"
    );
  } catch (err) {
    schedulerLogger.error({ err }, "Old calendar cleanup failed");
  }

  try {
    // Old Groceries Cleanup
    schedulerLogger.info("Old groceries cleanup triggered");
    const groceriesResult = await cleanupOldGroceries();

    schedulerLogger.info({ deleted: groceriesResult.deleted }, "Old groceries cleanup completed");
  } catch (err) {
    schedulerLogger.error({ err }, "Old groceries cleanup failed");
  }

  try {
    // CalDAV Retry
    schedulerLogger.info("CalDAV retry triggered");
    const caldavResult = await retryFailedCalDavSyncs();

    schedulerLogger.info(
      { retried: caldavResult.retried, skipped: caldavResult.skipped },
      "CalDAV retry completed"
    );
  } catch (err) {
    schedulerLogger.error({ err }, "CalDAV retry failed");
  }
}

export const startRecurringTasks = () => {
  // Run all cleanup tasks daily at midnight
  cron.schedule("0 0 * * *", async () => {
    try {
      await runScheduledCleanup();
    } catch (err) {
      schedulerLogger.error({ err }, "Scheduled cleanup failed");
    }
  });

  schedulerLogger.info("Scheduler started (all cleanup tasks run daily at midnight)");
};
