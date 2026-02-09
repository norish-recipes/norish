import type { CalendarSubscriptionEvents } from "@/server/trpc/routers/calendar/types";
import type { RecipeSubscriptionEvents } from "@/server/trpc/routers/recipes/types";
import type { Slot } from "@/types";
import type Redis from "ioredis";

import superjson from "superjson";

import { getQueues } from "@/server/queue/registry";
import { addCaldavSyncJob } from "@/server/queue/caldav-sync/producer";
import { recipeEmitter } from "@/server/trpc/routers/recipes/emitter";
import { getCaldavSyncStatusByItemId } from "@/server/db/repositories/caldav-sync-status";
import { getCaldavConfigDecrypted } from "@/server/db/repositories/caldav-config";
import { createSubscriberClient } from "@/server/redis/client";
import { createLogger } from "@/server/logger";

const log = createLogger("caldav-sync");

let isInitialized = false;
let abortController: AbortController | null = null;

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

  await addCaldavSyncJob(getQueues().caldavSync, {
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

async function startCalendarSubscriptions(signal: AbortSignal): Promise<void> {
  const CALENDAR_PATTERN = "norish:calendar:household:*:*";
  let subscriber: Redis | null = null;

  try {
    subscriber = await createSubscriberClient();

    if (signal.aborted) {
      await subscriber.quit();

      return;
    }

    await subscriber.psubscribe(CALENDAR_PATTERN);
    log.info({ pattern: CALENDAR_PATTERN }, "CalDAV subscribed to calendar events via psubscribe");

    const abortHandler = async () => {
      if (subscriber) {
        try {
          await subscriber.punsubscribe(CALENDAR_PATTERN);
          await subscriber.quit();
        } catch (err) {
          log.debug({ err }, "Error during calendar subscription cleanup");
        }
      }
    };

    signal.addEventListener("abort", abortHandler, { once: true });

    subscriber.on("pmessage", (_pattern: string, channel: string, message: string) => {
      const parts = channel.split(":");
      const eventName = parts[parts.length - 1];

      let data: unknown;

      try {
        data = superjson.parse(message);
      } catch (err) {
        log.error({ err, channel }, "Failed to parse calendar event message");

        return;
      }

      void handleCalendarEvent(eventName, data);
    });

    subscriber.on("error", (err) => {
      if (!signal.aborted) {
        log.error({ err }, "Calendar psubscribe error");
      }
    });

    await new Promise<void>((resolve) => {
      signal.addEventListener("abort", () => resolve(), { once: true });
    });
  } catch (err) {
    if (!signal.aborted) {
      log.error({ err }, "Failed to start calendar subscriptions");
    }
  } finally {
    if (subscriber) {
      try {
        await subscriber.punsubscribe(CALENDAR_PATTERN);
        await subscriber.quit();
      } catch {
        // Cleanup errors are expected during shutdown
      }
    }
  }
}

async function handleCalendarEvent(eventName: string, data: unknown): Promise<void> {
  try {
    switch (eventName) {
      case "itemCreated": {
        const { item } = data as CalendarSubscriptionEvents["itemCreated"];
        const title =
          item.itemType === "recipe" ? (item.recipeName ?? "Recipe") : (item.title ?? "Note");

        log.debug(
          { id: item.id, itemType: item.itemType, userId: item.userId },
          "Item created - queuing CalDAV sync"
        );
        await queueSyncJob(
          item.userId,
          item.id,
          item.itemType,
          item.id,
          title,
          item.date,
          item.slot,
          item.recipeId ?? undefined
        );
        break;
      }

      case "itemDeleted": {
        const { itemId } = data as CalendarSubscriptionEvents["itemDeleted"];

        log.debug({ itemId }, "Item deleted - queuing CalDAV delete for all synced users");
        await queueDeleteJobByItemId(itemId);
        break;
      }

      case "itemMoved": {
        const { item } = data as CalendarSubscriptionEvents["itemMoved"];
        const title =
          item.itemType === "recipe" ? (item.recipeName ?? "Recipe") : (item.title ?? "Note");

        log.debug(
          { id: item.id, userId: item.userId, date: item.date },
          "Item moved - queuing CalDAV sync"
        );

        const movedSyncStatus = await getCaldavSyncStatusByItemId(item.userId, item.id);

        if (!movedSyncStatus) {
          log.debug(
            { id: item.id, userId: item.userId },
            "Item not synced to CalDAV, skipping move update"
          );

          return;
        }

        await queueSyncJob(
          item.userId,
          item.id,
          item.itemType,
          item.id,
          title,
          item.date,
          item.slot,
          item.recipeId ?? undefined
        );
        break;
      }

      case "itemUpdated": {
        const { item } = data as CalendarSubscriptionEvents["itemUpdated"];
        const title =
          item.itemType === "recipe" ? (item.recipeName ?? "Recipe") : (item.title ?? "Note");

        log.debug({ id: item.id, userId: item.userId }, "Item updated - queuing CalDAV sync");

        const updatedSyncStatus = await getCaldavSyncStatusByItemId(item.userId, item.id);

        if (!updatedSyncStatus) {
          log.debug(
            { id: item.id, userId: item.userId },
            "Item not synced to CalDAV, skipping update"
          );

          return;
        }

        await queueSyncJob(
          item.userId,
          item.id,
          item.itemType,
          item.id,
          title,
          item.date,
          item.slot,
          item.recipeId ?? undefined
        );
        break;
      }

      default:
        break;
    }
  } catch (error) {
    log.error({ err: error, eventName }, "Failed to handle calendar event for CalDAV sync");
  }
}

async function queueDeleteJobByItemId(itemId: string): Promise<void> {
  const { getAllCaldavSyncStatusesByItemId } =
    await import("@/server/db/repositories/caldav-sync-status");

  const syncStatuses = await getAllCaldavSyncStatusesByItemId(itemId);

  for (const status of syncStatuses) {
    try {
      await queueDeleteJob(status.userId, itemId);
    } catch (error) {
      log.error({ err: error, itemId, userId: status.userId }, "Failed to queue CalDAV delete");
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

      log.debug(
        { recipeId, newName },
        "Recipe name updated - CalDAV sync temporarily disabled during planned_items migration"
      );

      // TODO: Re-enable after planned-items repository is implemented
      // This requires getPlannedItemsByRecipeId from the new repository
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
  log.info({ userId }, "syncAllFutureItems temporarily disabled during planned_items migration");

  // TODO: Re-enable after planned-items repository is implemented
  return { totalSynced: 0, totalFailed: 0 };
}

/**
 * Retry pending/failed syncs for a user.
 * Used by the tRPC procedures for manual retry.
 */
export async function retryFailedSyncs(userId: string): Promise<{
  totalRetried: number;
  totalFailed: number;
}> {
  log.info({ userId }, "retryFailedSyncs temporarily disabled during planned_items migration");

  // TODO: Re-enable after planned-items repository is implemented
  return { totalRetried: 0, totalFailed: 0 };
}
