import {
  cleanupOrphanedAvatars,
  cleanupOrphanedImages,
  cleanupOrphanedStepImages,
} from "@norish/api/startup/media-cleanup";
import { cleanupOldCalendarData } from "@norish/queue/scheduler/old-calendar-cleanup";
import { cleanupOldGroceries } from "@norish/queue/scheduler/old-groceries-cleanup";
import { serverLogger } from "@norish/shared-server/logger";

export interface StartupMaintenanceCleanupSummary {
  media: {
    rootFilesAndDirsDeleted: number;
    stepImagesDeleted: number;
    avatarsDeleted: number;
    errors: number;
  };
  calendar: {
    plannedItemsDeleted: number;
  };
  groceries: {
    deleted: number;
  };
}

export async function runStartupMaintenanceCleanup(): Promise<StartupMaintenanceCleanupSummary> {
  serverLogger.info("Running startup maintenance cleanup");

  const mediaRootResult = await cleanupOrphanedImages();
  const mediaStepResult = await cleanupOrphanedStepImages();
  const avatarResult = await cleanupOrphanedAvatars();
  const calendarResult = await cleanupOldCalendarData();
  const groceriesResult = await cleanupOldGroceries();

  const summary: StartupMaintenanceCleanupSummary = {
    media: {
      rootFilesAndDirsDeleted: mediaRootResult.deleted,
      stepImagesDeleted: mediaStepResult.deleted,
      avatarsDeleted: avatarResult.deleted,
      errors: mediaRootResult.errors + mediaStepResult.errors + avatarResult.errors,
    },
    calendar: {
      plannedItemsDeleted: calendarResult.plannedItemsDeleted,
    },
    groceries: {
      deleted: groceriesResult.deleted,
    },
  };

  serverLogger.info(summary, "Startup maintenance cleanup complete");

  return summary;
}
