/**
 * CalDAV sync: the server-internal reaction to planned-item changes.
 *
 * One `hub.on()` registration per `internal` calendar companion event; the
 * household event the client sees is published beside it with the same
 * payload (`publishCalendarItemEvent`).
 */

import type {
  CalendarItemEvent,
  CalendarRealtime,
} from "@norish/shared/contracts/realtime/calendar";
import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { RealtimeEventEnvelope } from "@norish/shared/contracts/realtime/envelope";
import { getCaldavConfigDecrypted } from "@norish/db/repositories/caldav-config";
import { getCaldavSyncStatusByItemId } from "@norish/db/repositories/caldav-sync-status";
import { addCaldavSyncJob, isCaldavSyncPending } from "@norish/queue/caldav-sync/producer";
import { getQueues } from "@norish/queue/registry";
import { createLogger } from "@norish/shared-server/logger";
import { calendar } from "@norish/shared-server/realtime/calendar";
import { getRealtimeHub } from "@norish/shared-server/realtime/hub";
import { calendarInternalCompanion } from "@norish/shared/contracts/realtime/calendar";

const log = createLogger("caldav-sync");

/** The planned-item events the CalDAV sync reacts to. */
export const CALDAV_CALENDAR_EVENTS = Object.keys(calendarInternalCompanion) as CalendarItemEvent[];

let releases: Array<() => void> | null = null;

export function initCaldavSync(): void {
  if (releases) {
    log.warn("CalDAV sync service already initialized");

    return;
  }

  log.info("Initializing CalDAV sync service");

  releases = startCalendarSubscriptions();

  log.info("CalDAV sync service initialized");
}

/** Resolves once every hub registration is released. */
export async function stopCaldavSync(): Promise<void> {
  if (!releases) {
    return;
  }

  log.info("Stopping CalDAV sync service");

  const pending = releases;

  releases = null;

  for (const release of pending) {
    release();
  }
}

async function getCaldavServerUrl(userId: string): Promise<string | null> {
  const config = await getCaldavConfigDecrypted(userId);

  if (!config || !config.enabled) return null;

  return config.serverUrl;
}

/**
 * Queue a sync of a planned item's state. An edit syncs only an item the
 * calendar has or is about to have: one with a sync row, or one whose first
 * sync is still pending, which the edit then joins with its newer state.
 */
async function queueSyncJob(item: PlannedItem, { edit }: { edit: boolean }): Promise<void> {
  const caldavServerUrl = await getCaldavServerUrl(item.userId);

  if (!caldavServerUrl) {
    log.debug({ userId: item.userId, itemId: item.id }, "CalDAV not configured, skipping sync");

    return;
  }

  const queue = getQueues().caldavSync;

  // Pending first: a first sync that finishes in between has written the row by then.
  if (
    edit &&
    !(await isCaldavSyncPending(queue, caldavServerUrl, item.id)) &&
    !(await getCaldavSyncStatusByItemId(item.userId, item.id))
  ) {
    log.debug({ id: item.id, userId: item.userId }, "Item not synced to CalDAV, skipping edit");

    return;
  }

  await addCaldavSyncJob(queue, {
    userId: item.userId,
    itemId: item.id,
    itemType: item.itemType,
    plannedItemId: item.id,
    eventTitle: item.itemType === "recipe" ? (item.recipeName ?? "Recipe") : (item.title ?? "Note"),
    date: item.date,
    slot: item.slot,
    recipeId: item.recipeId ?? undefined,
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

/** One `hub.on()` per internal companion; the hub must be started. */
function startCalendarSubscriptions(): Array<() => void> {
  const hub = getRealtimeHub();

  return CALDAV_CALENDAR_EVENTS.map((event) => {
    const companion = calendarInternalCompanion[event];
    const channel = calendar.channel(companion, undefined);

    log.info({ channel }, "CalDAV subscribed to calendar events");

    return hub.on(channel, (envelope) => {
      void handleCalendarEvent(event, envelope);
    });
  });
}

type CalendarPayload<E extends CalendarItemEvent> = PayloadOf<CalendarRealtime, E>;
type PlannedItem = CalendarPayload<"itemCreated">["item"];

function parsePayload<E extends CalendarItemEvent>(
  event: E,
  envelope: RealtimeEventEnvelope
): CalendarPayload<E> | null {
  const parsed = calendar.catalogue.events[event].payload.safeParse(envelope.payload);

  if (!parsed.success) {
    log.error(
      { event, channel: envelope.meta.channel, issues: parsed.error.issues },
      "Dropped malformed calendar event"
    );

    return null;
  }

  return parsed.data as CalendarPayload<E>;
}

export async function handleCalendarEvent(
  eventName: CalendarItemEvent,
  envelope: RealtimeEventEnvelope
): Promise<void> {
  try {
    switch (eventName) {
      case "itemCreated": {
        const payload = parsePayload("itemCreated", envelope);

        if (!payload) return;

        log.debug({ id: payload.item.id }, "Item created - queuing CalDAV sync");
        await queueSyncJob(payload.item, { edit: false });
        break;
      }

      case "itemDeleted": {
        const payload = parsePayload("itemDeleted", envelope);

        if (!payload) return;

        const { itemId } = payload;

        log.debug({ itemId }, "Item deleted - queuing CalDAV delete for all synced users");
        await queueDeleteJobByItemId(itemId);
        break;
      }

      case "itemMoved":
      case "itemUpdated": {
        const payload = parsePayload(eventName, envelope);

        if (!payload) return;

        log.debug({ id: payload.item.id, eventName }, "Item edited - queuing CalDAV sync");
        await queueSyncJob(payload.item, { edit: true });
        break;
      }
    }
  } catch (error) {
    log.error({ err: error, eventName }, "Failed to handle calendar event for CalDAV sync");
  }
}

async function queueDeleteJobByItemId(itemId: string): Promise<void> {
  const { getAllCaldavSyncStatusesByItemId } =
    await import("@norish/db/repositories/caldav-sync-status");

  const syncStatuses = await getAllCaldavSyncStatusesByItemId(itemId);

  for (const status of syncStatuses) {
    try {
      await queueDeleteJob(status.userId, itemId);
    } catch (error) {
      log.error({ err: error, itemId, userId: status.userId }, "Failed to queue CalDAV delete");
    }
  }
}
