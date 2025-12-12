/**
 * CalDAV Calendar Sync Service
 *
 * Listens to global calendar events and adds CalDAV sync jobs to the queue.
 * Uses Redis pub/sub subscriptions with async iterators.
 */

import type { CalendarSubscriptionEvents } from "@/server/trpc/routers/calendar/types";
import type { RecipeSubscriptionEvents } from "@/server/trpc/routers/recipes/types";
import type { Slot } from "@/types";

import { addCaldavSyncJob } from "@/server/queue";
import { calendarEmitter } from "@/server/trpc/routers/calendar/emitter";
import { recipeEmitter } from "@/server/trpc/routers/recipes/emitter";
import { getCaldavSyncStatusByItemId } from "@/server/db/repositories/caldav-sync-status";
import { getPlannedRecipesByRecipeId } from "@/server/db/repositories/planned-recipe";
import { getCaldavConfigDecrypted } from "@/server/db/repositories/caldav-config";
import { createLogger } from "@/server/logger";

const log = createLogger("caldav-sync");

let isInitialized = false;
let abortController: AbortController | null = null;

/**
 * Initialize the CalDAV sync service.
 * Starts background subscription loops for calendar and recipe events.
 */
export function initCaldavSync(): void {
  if (isInitialized) {
    log.warn("CalDAV sync service already initialized");

    return;
  }

  log.info("Initializing CalDAV sync service");

  abortController = new AbortController();
  const signal = abortController.signal;

  // Start background subscription loops
  startCalendarSubscriptions(signal);
  startRecipeSubscriptions(signal);

  isInitialized = true;
  log.info("CalDAV sync service initialized");
}

export function stopCaldavSync(): void {
  if (!isInitialized || !abortController) {
    return;
  }

  log.info("Stopping CalDAV sync service");
  abortController.abort();
  abortController = null;
  isInitialized = false;
}

async function getCaldavServerUrl(userId: string): Promise<string | null> {
  const config = await getCaldavConfigDecrypted(userId);

  if (!config || !config.enabled) return null;
  return config.serverUrl;
}

async function queueSyncJob(
  userId: string,
  itemId: string,
  itemType: "recipe" | "note",
  plannedItemId: string,
  eventTitle: string,
  date: string,
  slot: Slot,
  recipeId?: string
): Promise<void> {
  const caldavServerUrl = await getCaldavServerUrl(userId);
  if (!caldavServerUrl) {
    log.debug({ userId, itemId }, "CalDAV not configured, skipping sync");
    return;
  }

  await addCaldavSyncJob({
    userId,
    itemId,
    itemType,
    plannedItemId,
    eventTitle,
    date,
    slot,
    recipeId,
    operation: "sync",
    caldavServerUrl,
  });
}

async function queueDeleteJob(userId: string, itemId: string): Promise<void> {
  const caldavServerUrl = await getCaldavServerUrl(userId);
  if (!caldavServerUrl) {
    log.debug({ userId, itemId }, "CalDAV not configured, skipping delete");
    return;
  }

  await addCaldavSyncJob({
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

async function startCalendarSubscriptions(signal: AbortSignal): Promise<void> {
  // Run all subscriptions concurrently
  await Promise.all([
    subscribeToGlobalEvent(
      "globalRecipePlanned",
      signal,
      async (data: CalendarSubscriptionEvents["globalRecipePlanned"]) => {
        const { id, recipeId, recipeName, date, slot, userId } = data;

        log.debug({ id, recipeId, userId }, "Recipe planned - queuing CalDAV sync");
        try {
          await queueSyncJob(userId, id, "recipe", id, recipeName, date, slot, recipeId);
        } catch (error) {
          log.error({ err: error, id, userId }, "Failed to queue CalDAV sync for planned recipe");
        }
      }
    ),
    subscribeToGlobalEvent(
      "globalRecipeDeleted",
      signal,
      async (data: CalendarSubscriptionEvents["globalRecipeDeleted"]) => {
        const { id, userId } = data;

        log.debug({ id, userId }, "Recipe unplanned - queuing CalDAV delete");
        try {
          await queueDeleteJob(userId, id);
        } catch (error) {
          log.error({ err: error, id, userId }, "Failed to queue CalDAV delete for unplanned recipe");
        }
      }
    ),
    subscribeToGlobalEvent(
      "globalRecipeUpdated",
      signal,
      async (data: CalendarSubscriptionEvents["globalRecipeUpdated"]) => {
        const { id, recipeId, recipeName, newDate, slot, userId } = data;

        log.debug({ id, userId, newDate }, "Recipe updated - queuing CalDAV sync");
        try {
          const syncStatus = await getCaldavSyncStatusByItemId(userId, id);

          if (!syncStatus) {
            log.debug({ id, userId }, "Recipe not synced to CalDAV, skipping update");
            return;
          }
          await queueSyncJob(userId, id, "recipe", id, recipeName, newDate, slot, recipeId);
        } catch (error) {
          log.error({ err: error, id, userId }, "Failed to queue CalDAV sync for recipe update");
        }
      }
    ),
    subscribeToGlobalEvent(
      "globalNotePlanned",
      signal,
      async (data: CalendarSubscriptionEvents["globalNotePlanned"]) => {
        const { id, title, date, slot, userId } = data;

        log.debug({ id, title, userId }, "Note planned - queuing CalDAV sync");
        try {
          await queueSyncJob(userId, id, "note", id, title, date, slot);
        } catch (error) {
          log.error({ err: error, id, userId }, "Failed to queue CalDAV sync for planned note");
        }
      }
    ),
    subscribeToGlobalEvent(
      "globalNoteDeleted",
      signal,
      async (data: CalendarSubscriptionEvents["globalNoteDeleted"]) => {
        const { id, userId } = data;

        log.debug({ id, userId }, "Note unplanned - queuing CalDAV delete");
        try {
          await queueDeleteJob(userId, id);
        } catch (error) {
          log.error({ err: error, id, userId }, "Failed to queue CalDAV delete for unplanned note");
        }
      }
    ),
    subscribeToGlobalEvent(
      "globalNoteUpdated",
      signal,
      async (data: CalendarSubscriptionEvents["globalNoteUpdated"]) => {
        const { id, title, newDate, slot, userId } = data;

        log.debug({ id, userId, newDate }, "Note updated - queuing CalDAV sync");
        try {
          const syncStatus = await getCaldavSyncStatusByItemId(userId, id);

          if (!syncStatus) {
            log.debug({ id, userId }, "Note not synced to CalDAV, skipping update");
            return;
          }
          await queueSyncJob(userId, id, "note", id, title, newDate, slot);
        } catch (error) {
          log.error({ err: error, id, userId }, "Failed to queue CalDAV sync for note update");
        }
      }
    ),
  ]);
}

async function subscribeToGlobalEvent<K extends keyof CalendarSubscriptionEvents>(
  event: K,
  signal: AbortSignal,
  handler: (data: CalendarSubscriptionEvents[K]) => Promise<void>
): Promise<void> {
  const channel = calendarEmitter.globalEvent(event);

  try {
    for await (const data of calendarEmitter.createSubscription(channel, signal)) {
      await handler(data as CalendarSubscriptionEvents[K]);
    }
  } catch (err) {
    if (!signal.aborted) {
      log.error({ err, event }, "Calendar subscription error");
    }
  }
}

async function startRecipeSubscriptions(signal: AbortSignal): Promise<void> {
  const channel = recipeEmitter.broadcastEvent("updated");

  try {
    for await (const data of recipeEmitter.createSubscription(channel, signal)) {
      const typedData = data as RecipeSubscriptionEvents["updated"];
      const { recipe } = typedData;

      if (!recipe || !recipe.name) continue;

      const recipeId = recipe.id;
      const newName = recipe.name;

      log.debug({ recipeId, newName }, "Recipe name updated - queuing CalDAV sync for all instances");

      try {
        const plannedInstances = await getPlannedRecipesByRecipeId(recipeId);

        for (const planned of plannedInstances) {
          await queueSyncJob(
            planned.userId,
            planned.id,
            "recipe",
            planned.id,
            newName,
            planned.date,
            planned.slot as Slot,
            recipeId
          );
        }
        log.info(
          { recipeId, count: plannedInstances.length },
          "Queued CalDAV sync for recipe name update"
        );
      } catch (error) {
        log.error({ err: error, recipeId }, "Failed to queue CalDAV sync for recipe name update");
      }
    }
  } catch (err) {
    if (!signal.aborted) {
      log.error({ err }, "Recipe subscription error");
    }
  }
}

export async function syncAllFutureItems(userId: string): Promise<{
  totalSynced: number;
  totalFailed: number;
}> {
  const { getFuturePlannedRecipes } = await import("@/server/db/repositories/planned-recipe");
  const { getFutureNotes } = await import("@/server/db/repositories/notes");
  const { getRecipeFull } = await import("@/server/db/repositories/recipes");

  log.info({ userId }, "Starting initial CalDAV sync for all future items");

  const today = new Date().toISOString().split("T")[0];
  let totalSynced = 0;
  let totalFailed = 0;

  try {
    // Get all future planned recipes for this user
    const futurePlannedRecipes = await getFuturePlannedRecipes(today);
    const userRecipes = futurePlannedRecipes.filter((p) => p.userId === userId);

    // Get all future notes for this user
    const futureNotes = await getFutureNotes(today);
    const userNotes = futureNotes.filter((n) => n.userId === userId);

    log.debug(
      { userId, recipeCount: userRecipes.length, noteCount: userNotes.length },
      "Found future items to sync"
    );

    // Queue sync for all future planned recipes
    for (const planned of userRecipes) {
      try {
        const recipe = await getRecipeFull(planned.recipeId);

        if (!recipe) continue;

        await queueSyncJob(
          planned.userId,
          planned.id,
          "recipe",
          planned.id,
          recipe.name,
          planned.date,
          planned.slot as Slot,
          planned.recipeId
        );
        totalSynced++;
      } catch (error) {
        log.error(
          { err: error, plannedId: planned.id, userId },
          "Failed to queue planned recipe during initial sync"
        );
        totalFailed++;
      }
    }

    // Queue sync for all future notes
    for (const note of userNotes) {
      try {
        await queueSyncJob(
          note.userId,
          note.id,
          "note",
          note.id,
          note.title,
          note.date,
          note.slot as Slot
        );
        totalSynced++;
      } catch (error) {
        log.error(
          { err: error, noteId: note.id, userId },
          "Failed to queue note during initial sync"
        );
        totalFailed++;
      }
    }

    log.info({ userId, totalSynced, totalFailed }, "Initial CalDAV sync queued");

    return { totalSynced, totalFailed };
  } catch (error) {
    log.error({ err: error, userId }, "Initial CalDAV sync failed");
    throw error;
  }
}

/**
 * Retry pending/failed syncs for a user.
 * Used by the tRPC procedures for manual retry.
 */
export async function retryFailedSyncs(userId: string): Promise<{
  totalRetried: number;
  totalFailed: number;
}> {
  const { getPendingOrFailedSyncStatuses } = await import("@/server/db/repositories/caldav-sync-status");
  const { getPlannedRecipeViewById } = await import("@/server/db/repositories/planned-recipe");
  const { getNoteViewById } = await import("@/server/db/repositories/notes");
  const { getRecipeFull } = await import("@/server/db/repositories/recipes");

  log.info({ userId }, "Starting retry of pending/failed CalDAV syncs");

  let totalRetried = 0;
  let totalFailed = 0;

  try {
    // Get all pending/failed sync statuses for this user
    const pendingItems = await getPendingOrFailedSyncStatuses(userId);

    log.debug({ userId, count: pendingItems.length }, "Found pending/failed items to retry");

    // Retry each pending/failed item
    for (const item of pendingItems) {
      try {
        if (item.itemType === "recipe") {
          const planned = await getPlannedRecipeViewById(item.itemId);

          if (!planned) continue;

          const recipe = await getRecipeFull(planned.recipeId);

          if (!recipe) continue;

          await queueSyncJob(
            userId,
            item.itemId,
            "recipe",
            item.plannedItemId || planned.id,
            recipe.name,
            planned.date,
            planned.slot as Slot,
            planned.recipeId
          );
        } else {
          // Note
          const note = await getNoteViewById(item.itemId);

          if (!note) continue;

          await queueSyncJob(
            userId,
            item.itemId,
            "note",
            item.plannedItemId || note.id,
            note.title,
            note.date,
            note.slot as Slot
          );
        }

        totalRetried++;
      } catch (error) {
        log.error({ err: error, itemId: item.itemId, userId }, "Failed to queue retry sync item");
        totalFailed++;
      }
    }

    log.info({ userId, totalRetried, totalFailed }, "CalDAV sync retry queued");

    return { totalRetried, totalFailed };
  } catch (error) {
    log.error({ err: error, userId }, "CalDAV sync retry failed");
    throw error;
  }
}

