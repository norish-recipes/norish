/**
 * CalDAV Sync Manager Tests
 *
 * An item that has already been synced owns an event on the server. Moving or
 * retitling it has to land on that event, not add a second one.
 */

// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetCaldavConfigDecrypted = vi.fn();
const mockGetCaldavSyncStatusByItemId = vi.fn();
const mockUpdateCaldavSyncStatus = vi.fn();
const mockCreateEvent = vi.fn();
const mockUpdateEvent = vi.fn();
const mockDeleteEvent = vi.fn();

vi.mock("@norish/db/repositories/caldav-config", () => ({
  getCaldavConfigDecrypted: mockGetCaldavConfigDecrypted,
}));

vi.mock("@norish/db/repositories/caldav-sync-status", () => ({
  getCaldavSyncStatusByItemId: mockGetCaldavSyncStatusByItemId,
  updateCaldavSyncStatus: mockUpdateCaldavSyncStatus,
}));

vi.mock("@norish/shared-server/caldav/client", () => ({
  CalDavClient: class {
    createEvent = mockCreateEvent;
    updateEvent = mockUpdateEvent;
    deleteEvent = mockDeleteEvent;
  },
}));

const { deletePlannedItem, getEventTimeRange, syncPlannedItem } =
  await import("../../src/caldav/sync-manager");

const CONFIG = {
  enabled: true,
  serverUrl: "https://radicale.example/dav/",
  calendarUrl: null,
  username: "chef",
  password: "secret",
  breakfastTime: "08:00-09:00",
  lunchTime: "12:00-13:00",
  dinnerTime: "18:00-19:00",
  snackTime: "15:00-15:30",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCaldavConfigDecrypted.mockResolvedValue(CONFIG);
  mockCreateEvent.mockImplementation(({ uid }: { uid?: string }) =>
    Promise.resolve({ uid: uid ?? "generated-uid", href: "h", rawIcs: "" })
  );
  mockUpdateEvent.mockImplementation(({ uid }: { uid: string }) =>
    Promise.resolve({ uid, href: "h", rawIcs: "" })
  );
});

describe("getEventTimeRange", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads slot times as wall-clock time in the server's timezone", () => {
    vi.stubEnv("TZ", "Europe/Kyiv");

    expect(getEventTimeRange("2026-08-21", "Dinner", CONFIG)).toEqual({
      start: new Date("2026-08-21T15:00:00Z"),
      end: new Date("2026-08-21T16:00:00Z"),
    });
    // Same slot after the switch to winter time.
    expect(getEventTimeRange("2026-12-21", "Dinner", CONFIG)).toEqual({
      start: new Date("2026-12-21T16:00:00Z"),
      end: new Date("2026-12-21T17:00:00Z"),
    });
  });
});

describe("syncPlannedItem", () => {
  it("creates a new event for an item that has never been synced", async () => {
    mockGetCaldavSyncStatusByItemId.mockResolvedValue(null);

    const result = await syncPlannedItem("user-1", "item-1", "Lasagne", "2026-08-21", "Dinner");

    expect(result).toEqual({ uid: "generated-uid", isNew: true });
    expect(mockCreateEvent).toHaveBeenCalledTimes(1);
    expect(mockUpdateEvent).not.toHaveBeenCalled();
  });

  it("writes over the existing event when the item moves to another day", async () => {
    mockGetCaldavSyncStatusByItemId.mockResolvedValue({
      id: "status-1",
      caldavEventUid: "event-uid",
      eventTitle: "Lasagne",
    });

    const result = await syncPlannedItem("user-1", "item-1", "Lasagne", "2026-08-25", "Lunch");

    expect(result).toEqual({ uid: "event-uid", isNew: false });
    expect(mockCreateEvent).not.toHaveBeenCalled();
    expect(mockUpdateEvent).toHaveBeenCalledTimes(1);
    expect(mockUpdateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "event-uid",
        summary: "Lasagne",
        start: new Date(2026, 7, 25, 12, 0),
        end: new Date(2026, 7, 25, 13, 0),
      })
    );
  });

  it("keeps the event uid when the title changes instead of deleting and recreating", async () => {
    mockGetCaldavSyncStatusByItemId.mockResolvedValue({
      id: "status-1",
      caldavEventUid: "event-uid",
      eventTitle: "Lasagne",
    });

    const result = await syncPlannedItem("user-1", "item-1", "Moussaka", "2026-08-21", "Dinner");

    expect(result).toEqual({ uid: "event-uid", isNew: false });
    expect(mockDeleteEvent).not.toHaveBeenCalled();
    expect(mockUpdateEvent).toHaveBeenCalledWith(
      expect.objectContaining({ uid: "event-uid", summary: "Moussaka" })
    );
  });

  it("links a recipe item back to its page", async () => {
    mockGetCaldavSyncStatusByItemId.mockResolvedValue(null);
    vi.stubEnv("AUTH_URL", "https://norish.example");

    await syncPlannedItem("user-1", "item-1", "Lasagne", "2026-08-21", "Dinner", "recipe-9");

    expect(mockCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://norish.example/recipes/recipe-9" })
    );

    vi.unstubAllEnvs();
  });

  it("refuses to sync when CalDAV is disabled", async () => {
    mockGetCaldavConfigDecrypted.mockResolvedValue({ ...CONFIG, enabled: false });

    await expect(
      syncPlannedItem("user-1", "item-1", "Lasagne", "2026-08-21", "Dinner")
    ).rejects.toThrow("CalDAV not configured or disabled");
  });
});

describe("deletePlannedItem", () => {
  it("removes the event and marks the row removed", async () => {
    mockGetCaldavSyncStatusByItemId.mockResolvedValue({
      id: "status-1",
      caldavEventUid: "event-uid",
      eventTitle: "Lasagne",
    });

    await deletePlannedItem("user-1", "item-1");

    expect(mockDeleteEvent).toHaveBeenCalledWith("event-uid");
    expect(mockUpdateCaldavSyncStatus).toHaveBeenCalledWith(
      "status-1",
      expect.objectContaining({ syncStatus: "removed", errorMessage: null })
    );
  });

  it("keeps the server error on the row when the delete fails", async () => {
    mockGetCaldavSyncStatusByItemId.mockResolvedValue({
      id: "status-1",
      caldavEventUid: "event-uid",
      eventTitle: "Lasagne",
    });
    mockDeleteEvent.mockRejectedValue(new Error("boom"));

    await deletePlannedItem("user-1", "item-1");

    expect(mockUpdateCaldavSyncStatus).toHaveBeenCalledWith(
      "status-1",
      expect.objectContaining({ syncStatus: "removed", errorMessage: "boom" })
    );
  });
});
