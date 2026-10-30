import type { Job } from "bullmq";

import { sweepAIChanges } from "@norish/db/repositories/ingredient-ai-changes";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { cleanupOldCalendarData } from "@norish/queue/scheduler/old-calendar-cleanup";
import { cleanupOldGroceries } from "@norish/queue/scheduler/old-groceries-cleanup";
import { checkRecurringGroceries } from "@norish/queue/scheduler/recurring-grocery-check";
import { sweepUnusedIngredients } from "@norish/shared-server/ingredients/catalogue";
import { sweepIngredientIcons } from "@norish/shared-server/ingredients/icon-drafts";
import { refreshIngredientCatalogue } from "@norish/shared-server/ingredients/seed/catalogue-seed";
import { recheckUndecidedMintsOnRungChange } from "@norish/shared-server/ingredients/seed/recheck-mints";
import { createLogger } from "@norish/shared-server/logger";

import type { ScheduledTaskJobData } from "./tasks";
import { createWorker } from "../create-worker";
import { reportStep } from "../job-steps";
import { QUEUE_NAMES } from "../queue-names";

const log = createLogger("worker:scheduled-tasks");

async function processScheduledTask(job: Job<ScheduledTaskJobData>): Promise<void> {
  const cleanupOrphanedImages = requireQueueApiHandler("cleanupOrphanedImages");
  const cleanupOrphanedAvatars = requireQueueApiHandler("cleanupOrphanedAvatars");
  const cleanupOrphanedStepImages = requireQueueApiHandler("cleanupOrphanedStepImages");
  const cleanupOldTempFiles = requireQueueApiHandler("cleanupOldTempFiles");
  const { taskType } = job.data;

  log.info({ jobId: job.id, taskType }, "Processing scheduled task");
  await reportStep(job, `running:${taskType}`);

  switch (taskType) {
    case "recurring-grocery-check": {
      const result = await checkRecurringGroceries();

      log.info({ unchecked: result.unchecked }, "Recurring grocery check completed");
      break;
    }

    case "media-cleanup": {
      const recipeResult = await cleanupOrphanedImages();
      const avatarResult = await cleanupOrphanedAvatars();
      const stepResult = await cleanupOrphanedStepImages();
      // Ingredient Icons no food points at: a draft nobody saved, an icon removed or replaced.
      const iconResult = await sweepIngredientIcons();

      log.info(
        {
          mediaDeleted: recipeResult.deleted,
          avatarsDeleted: avatarResult.deleted,
          stepImagesDeleted: stepResult.deleted,
          ingredientIconsDeleted: iconResult.deleted,
          errors: recipeResult.errors + avatarResult.errors + stepResult.errors + iconResult.errors,
        },
        "Media cleanup completed"
      );
      break;
    }

    case "calendar-cleanup": {
      const result = await cleanupOldCalendarData();

      log.info(
        {
          plannedItemsDeleted: result.plannedItemsDeleted,
        },
        "Calendar cleanup completed"
      );
      break;
    }

    case "groceries-cleanup": {
      const result = await cleanupOldGroceries();

      log.info({ deleted: result.deleted }, "Groceries cleanup completed");
      break;
    }

    case "video-temp-cleanup": {
      await cleanupOldTempFiles();
      log.info("Video temp cleanup completed");
      break;
    }

    case "ingredient-catalogue-refresh": {
      // A failed fetch or a malformed file throws before anything is
      // applied: the last good seed stays, and the job monitor shows why.
      const result = await refreshIngredientCatalogue();

      log.info({ result }, "Ingredient catalogue refresh completed");

      // A first seed that arrived after the upgrade (an offline first boot):
      // what was minted without it is looked at again against it.
      if (result === "applied") await recheckUndecidedMintsOnRungChange();
      break;
    }

    case "ingredient-sweep": {
      // Own foods nothing has named for 90 days go; a seeded one never does.
      const result = await sweepUnusedIngredients();
      const changesSwept = await sweepAIChanges();

      log.info({ deleted: result.deleted, changesSwept }, "Ingredient sweep completed");
      break;
    }

    default:
      throw new Error(`Unknown scheduled task type: ${taskType}`);
  }
}

export function startScheduledTasksWorker(): void {
  createWorker(QUEUE_NAMES.SCHEDULED_TASKS, processScheduledTask);
}
