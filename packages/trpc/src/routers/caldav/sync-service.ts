/**
 * CalDAV bulk sync.
 *
 * Event-driven sync only covers items that change while a calendar is
 * connected. These two entry points cover the rest: everything already on the
 * plan when the connection is made, and everything a previous attempt left
 * behind.
 */

import type { PlannedItemWithRecipe } from "@norish/db/repositories/planned-items";
import { getCaldavConfigDecrypted } from "@norish/db/repositories/caldav-config";
import { getPendingOrFailedSyncStatuses } from "@norish/db/repositories/caldav-sync-status";
import {
  getPlannedItemHouseholdId,
  getPlannedItemWithRecipeById,
  listPlannedItemsByHouseholdAndDateRange,
} from "@norish/db/repositories/planned-items";
import { addCaldavSyncJob } from "@norish/queue/caldav-sync/producer";
import { getQueues } from "@norish/queue/registry";
import { createLogger } from "@norish/shared-server/logger";

const log = createLogger("caldav-sync");

/** Planned dates are plain YYYY-MM-DD and nothing caps how far ahead a user plans. */
const FAR_FUTURE = "9999-12-31";

/**
 * Today in the server's own timezone, which is the one the operator set and
 * the one the user's plan is written against.
 */
function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

function eventTitleFor(item: PlannedItemWithRecipe): string {
  return item.itemType === "recipe" ? (item.recipeName ?? "Recipe") : (item.title ?? "Note");
}

async function queueItemSync(
  userId: string,
  caldavServerUrl: string,
  item: PlannedItemWithRecipe
): Promise<void> {
  await addCaldavSyncJob(getQueues().caldavSync, {
    userId,
    itemId: item.id,
    itemType: item.itemType,
    plannedItemId: item.id,
    eventTitle: eventTitleFor(item),
    date: item.date,
    slot: item.slot,
    recipeId: item.recipeId ?? undefined,
    operation: "sync",
    caldavServerUrl,
  });
}

async function queueItemDelete(
  userId: string,
  caldavServerUrl: string,
  itemId: string
): Promise<void> {
  await addCaldavSyncJob(getQueues().caldavSync, {
    userId,
    itemId,
    itemType: "recipe", // Doesn't matter for delete
    plannedItemId: null,
    eventTitle: "",
    date: "",
    slot: "",
    operation: "delete",
    caldavServerUrl,
  });
}

/**
 * Push every planned item from today onwards onto the calendar.
 *
 * Runs when a connection is first enabled, so a plan built before the calendar
 * existed still lands there, and behind the manual "sync all" action. Syncing
 * an item is an upsert on the event it already owns, so re-running this
 * reconciles rather than duplicates.
 *
 * @returns How many items were handed to the sync queue, and how many could
 *   not be queued at all. Whether each one reaches the server is reported
 *   per item over the caldav subscription.
 */
export async function syncAllFutureItems(
  userId: string,
  householdId: string
): Promise<{
  totalSynced: number;
  totalFailed: number;
}> {
  const config = await getCaldavConfigDecrypted(userId);

  if (!config || !config.enabled) {
    log.debug({ userId }, "CalDAV not enabled, nothing to sync");

    return { totalSynced: 0, totalFailed: 0 };
  }

  // A member's calendar carries the entries they added to their household's plan.
  const items = (
    await listPlannedItemsByHouseholdAndDateRange(householdId, todayKey(), FAR_FUTURE)
  ).filter((item) => item.userId === userId);

  let totalSynced = 0;
  let totalFailed = 0;

  for (const item of items) {
    try {
      await queueItemSync(userId, config.serverUrl, item);
      totalSynced += 1;
    } catch (err) {
      totalFailed += 1;
      log.error({ err, userId, itemId: item.id }, "Failed to queue CalDAV sync for planned item");
    }
  }

  log.info({ userId, totalSynced, totalFailed }, "Queued CalDAV sync for planned items");

  return { totalSynced, totalFailed };
}

/**
 * Re-queue the items whose last sync never landed.
 *
 * An item can sit in `pending` or `failed` because the server was unreachable,
 * the credentials were wrong, or the job that would have retried it was
 * dropped. An item deleted in the meantime is chased off the calendar instead.
 */
export async function retryFailedSyncs(
  userId: string,
  householdId: string
): Promise<{
  totalRetried: number;
  totalFailed: number;
}> {
  const config = await getCaldavConfigDecrypted(userId);

  if (!config || !config.enabled) {
    log.debug({ userId }, "CalDAV not enabled, nothing to retry");

    return { totalRetried: 0, totalFailed: 0 };
  }

  const statuses = await getPendingOrFailedSyncStatuses(userId);

  let totalRetried = 0;
  let totalFailed = 0;

  for (const status of statuses) {
    try {
      const [item, itemHouseholdId] = await Promise.all([
        getPlannedItemWithRecipeById(status.itemId),
        getPlannedItemHouseholdId(status.itemId),
      ]);

      // An entry left behind in a household the member has left comes off their calendar.
      if (item && itemHouseholdId === householdId) {
        await queueItemSync(userId, config.serverUrl, item);
      } else {
        await queueItemDelete(userId, config.serverUrl, status.itemId);
      }

      totalRetried += 1;
    } catch (err) {
      totalFailed += 1;
      log.error({ err, userId, itemId: status.itemId }, "Failed to queue CalDAV sync retry");
    }
  }

  log.info({ userId, totalRetried, totalFailed }, "Queued CalDAV sync retries");

  return { totalRetried, totalFailed };
}
