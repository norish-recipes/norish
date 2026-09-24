/**
 * CalDAV event listener
 *
 * The listener is a set of `hub.on()` registrations on the `internal`
 * companions of the calendar events it reacts to; the household event the
 * client sees is published beside each one with the same payload.
 */

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RealtimeEventEnvelope } from "@norish/shared/contracts/realtime/envelope";
import {
  calendarInternalCompanion,
  calendarRealtime,
} from "@norish/shared/contracts/realtime/calendar";
import { ENVELOPE_VERSION } from "@norish/shared/contracts/realtime/envelope";

const hub = vi.hoisted(() => {
  const handlers = new Map<string, Set<(envelope: unknown) => void>>();

  return {
    handlers,
    on: vi.fn((channel: string, handler: (envelope: unknown) => void) => {
      const set = handlers.get(channel) ?? new Set();

      set.add(handler);
      handlers.set(channel, set);

      return () => {
        set.delete(handler);
      };
    }),
    emit(channel: string, envelope: unknown) {
      for (const handler of handlers.get(channel) ?? []) handler(envelope);
    },
  };
});

const db = vi.hoisted(() => ({
  getCaldavConfigDecrypted: vi.fn(),
  getCaldavSyncStatusByItemId: vi.fn(),
  getAllCaldavSyncStatusesByItemId: vi.fn(),
}));

const queue = vi.hoisted(() => ({
  addCaldavSyncJob: vi.fn(async () => undefined),
  caldavSync: { name: "caldav-sync" },
}));

vi.mock("@norish/shared-server/realtime/hub", () => ({ getRealtimeHub: () => hub }));
vi.mock("@norish/db/repositories/caldav-config", () => ({
  getCaldavConfigDecrypted: db.getCaldavConfigDecrypted,
}));
vi.mock("@norish/db/repositories/caldav-sync-status", () => ({
  getCaldavSyncStatusByItemId: db.getCaldavSyncStatusByItemId,
  getAllCaldavSyncStatusesByItemId: db.getAllCaldavSyncStatusesByItemId,
}));
vi.mock("@norish/queue/caldav-sync/producer", () => ({ addCaldavSyncJob: queue.addCaldavSyncJob }));
vi.mock("@norish/queue/registry", () => ({ getQueues: () => ({ caldavSync: queue.caldavSync }) }));
vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const { CALDAV_CALENDAR_EVENTS, initCaldavSync, stopCaldavSync } =
  await import("@norish/api/caldav/event-listener");

function companionChannel(event: keyof typeof calendarInternalCompanion) {
  return `norish:calendar:internal:${calendarInternalCompanion[event]}`;
}

function envelope(channel: string, payload: unknown): RealtimeEventEnvelope {
  return {
    meta: {
      version: ENVELOPE_VERSION,
      eventId: "uuid-1",
      eventName: channel.split(":").at(-1)!,
      namespace: "calendar",
      scope: "internal",
      channel,
      occurredAt: new Date().toISOString(),
    },
    payload,
  };
}

const item = {
  id: "item-1",
  date: "2026-09-18",
  slot: "Dinner" as const,
  sortOrder: 0,
  itemType: "recipe" as const,
  recipeId: "recipe-1",
  title: null,
  userId: "user-1",
  version: 1,
  recipeName: "Soup",
  recipeImage: null,
  servings: 2,
  calories: null,
};

async function settle() {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

beforeEach(async () => {
  vi.clearAllMocks();
  hub.handlers.clear();
  await stopCaldavSync();
  db.getCaldavConfigDecrypted.mockResolvedValue({ enabled: true, serverUrl: "https://dav" });
  db.getCaldavSyncStatusByItemId.mockResolvedValue({ id: "status-1" });
  db.getAllCaldavSyncStatusesByItemId.mockResolvedValue([{ userId: "user-1" }]);
});

describe("calendar companions", () => {
  it("every event the listener handles has an internal companion in the catalogue", () => {
    expect(CALDAV_CALENDAR_EVENTS).toEqual([
      "itemCreated",
      "itemDeleted",
      "itemMoved",
      "itemUpdated",
    ]);

    for (const event of CALDAV_CALENDAR_EVENTS) {
      const companion = calendarInternalCompanion[event];

      expect(calendarRealtime.events[event]?.scope).toBe("household");
      expect(calendarRealtime.events[companion]?.scope).toBe("internal");
      expect(calendarRealtime.events[companion]?.payload).toBe(
        calendarRealtime.events[event]?.payload
      );
    }
  });

  it("registers one hub listener per companion, and releases them all on stop", async () => {
    initCaldavSync();

    for (const event of CALDAV_CALENDAR_EVENTS) {
      expect(hub.on).toHaveBeenCalledWith(companionChannel(event), expect.any(Function));
    }
    expect(hub.on).toHaveBeenCalledTimes(CALDAV_CALENDAR_EVENTS.length);

    await stopCaldavSync();

    for (const event of CALDAV_CALENDAR_EVENTS) {
      expect(hub.handlers.get(companionChannel(event))?.size).toBe(0);
    }
  });

  it("queues a sync for a created item of a user with CalDAV enabled", async () => {
    initCaldavSync();

    hub.emit(companionChannel("itemCreated"), envelope(companionChannel("itemCreated"), { item }));
    await settle();

    expect(queue.addCaldavSyncJob).toHaveBeenCalledWith(
      queue.caldavSync,
      expect.objectContaining({
        userId: "user-1",
        itemId: "item-1",
        operation: "sync",
        eventTitle: "Soup",
        caldavServerUrl: "https://dav",
      })
    );
  });

  it("queues a delete for every user who had the item synced", async () => {
    initCaldavSync();

    hub.emit(
      companionChannel("itemDeleted"),
      envelope(companionChannel("itemDeleted"), {
        itemId: "item-1",
        date: "2026-09-18",
        slot: "Dinner",
      })
    );
    await settle();

    expect(queue.addCaldavSyncJob).toHaveBeenCalledWith(
      queue.caldavSync,
      expect.objectContaining({ userId: "user-1", itemId: "item-1", operation: "delete" })
    );
  });

  it("drops a payload that fails its schema", async () => {
    initCaldavSync();

    hub.emit(
      companionChannel("itemUpdated"),
      envelope(companionChannel("itemUpdated"), { item: 1 })
    );
    await settle();

    expect(queue.addCaldavSyncJob).not.toHaveBeenCalled();
  });
});
