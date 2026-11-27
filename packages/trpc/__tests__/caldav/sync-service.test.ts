/**
 * CalDAV Bulk Sync Tests
 *
 * Event-driven sync only sees items that change while a calendar is connected,
 * so a plan built beforehand reaches the server through these entry points.
 */

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetCaldavConfigDecrypted = vi.fn();
const mockGetPendingOrFailedSyncStatuses = vi.fn();
const mockListPlannedItemsAddedBy = vi.fn();
const mockGetPlannedItemWithRecipeById = vi.fn();
const mockAddCaldavSyncJob = vi.fn();
const caldavSync = { name: "caldav-sync" };

vi.mock("@norish/db/repositories/caldav-config", () => ({
  getCaldavConfigDecrypted: mockGetCaldavConfigDecrypted,
}));

vi.mock("@norish/db/repositories/caldav-sync-status", () => ({
  getPendingOrFailedSyncStatuses: mockGetPendingOrFailedSyncStatuses,
}));

vi.mock("@norish/db/repositories/planned-items", () => ({
  listPlannedItemsAddedBy: mockListPlannedItemsAddedBy,
  getPlannedItemWithRecipeById: mockGetPlannedItemWithRecipeById,
}));

vi.mock("@norish/queue/caldav-sync/producer", () => ({
  addCaldavSyncJob: mockAddCaldavSyncJob,
}));

vi.mock("@norish/queue/registry", () => ({
  getQueues: () => ({ caldavSync }),
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const { retryFailedSyncs, syncAllFutureItems } =
  await import("../../src/routers/caldav/sync-service");

const SERVER_URL = "https://radicale.example/dav/";
const CONFIG = { enabled: true, serverUrl: SERVER_URL };

function plannedItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    userId: "user-1",
    date: "2026-08-21",
    slot: "Dinner",
    itemType: "recipe",
    recipeId: "recipe-1",
    recipeName: "Lasagne",
    title: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockGetCaldavConfigDecrypted.mockResolvedValue(CONFIG);
  mockAddCaldavSyncJob.mockResolvedValue({ id: "job" });
  mockListPlannedItemsAddedBy.mockResolvedValue([]);
  mockGetPendingOrFailedSyncStatuses.mockResolvedValue([]);
});

describe("syncAllFutureItems", () => {
  it("queues every planned item from today onwards", async () => {
    mockListPlannedItemsAddedBy.mockResolvedValue([
      plannedItem(),
      plannedItem({ id: "item-2", date: "2026-08-22", slot: "Lunch" }),
    ]);

    const result = await syncAllFutureItems("user-1", "household-1");

    expect(result).toEqual({ totalSynced: 2, totalFailed: 0 });
    expect(mockAddCaldavSyncJob).toHaveBeenCalledTimes(2);
    expect(mockAddCaldavSyncJob).toHaveBeenCalledWith(
      caldavSync,
      expect.objectContaining({
        userId: "user-1",
        itemId: "item-1",
        plannedItemId: "item-1",
        eventTitle: "Lasagne",
        date: "2026-08-21",
        slot: "Dinner",
        recipeId: "recipe-1",
        operation: "sync",
        caldavServerUrl: SERVER_URL,
      })
    );
  });

  it("asks for the entries the member added to their household's plan from today", async () => {
    await syncAllFutureItems("user-1", "household-1");

    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    expect(mockListPlannedItemsAddedBy).toHaveBeenCalledWith("household-1", "user-1", expected);
  });

  it("titles a note from its own text", async () => {
    mockListPlannedItemsAddedBy.mockResolvedValue([
      plannedItem({ itemType: "note", recipeId: null, recipeName: null, title: "Leftovers" }),
    ]);

    await syncAllFutureItems("user-1", "household-1");

    expect(mockAddCaldavSyncJob).toHaveBeenCalledWith(
      caldavSync,
      expect.objectContaining({ eventTitle: "Leftovers", itemType: "note", recipeId: undefined })
    );
  });

  it("keeps going when one item cannot be queued", async () => {
    mockListPlannedItemsAddedBy.mockResolvedValue([plannedItem(), plannedItem({ id: "item-2" })]);
    mockAddCaldavSyncJob.mockRejectedValueOnce(new Error("valkey down"));

    const result = await syncAllFutureItems("user-1", "household-1");

    expect(result).toEqual({ totalSynced: 1, totalFailed: 1 });
  });

  it("does nothing when CalDAV is not enabled", async () => {
    mockGetCaldavConfigDecrypted.mockResolvedValue({ ...CONFIG, enabled: false });

    const result = await syncAllFutureItems("user-1", "household-1");

    expect(result).toEqual({ totalSynced: 0, totalFailed: 0 });
    expect(mockListPlannedItemsAddedBy).not.toHaveBeenCalled();
  });

  it("does nothing when there is no config at all", async () => {
    mockGetCaldavConfigDecrypted.mockResolvedValue(null);

    await expect(syncAllFutureItems("user-1", "household-1")).resolves.toEqual({
      totalSynced: 0,
      totalFailed: 0,
    });
  });
});

describe("retryFailedSyncs", () => {
  it("re-queues each item whose last sync never landed", async () => {
    mockGetPendingOrFailedSyncStatuses.mockResolvedValue([{ itemId: "item-1" }]);
    mockGetPlannedItemWithRecipeById.mockResolvedValue(plannedItem());

    const result = await retryFailedSyncs("user-1", "household-1");

    expect(result).toEqual({ totalRetried: 1, totalFailed: 0 });
    expect(mockGetPlannedItemWithRecipeById).toHaveBeenCalledWith("item-1", "household-1");
    expect(mockAddCaldavSyncJob).toHaveBeenCalledWith(
      caldavSync,
      expect.objectContaining({ itemId: "item-1", operation: "sync" })
    );
  });

  it("chases an item deleted since the failure off the calendar", async () => {
    mockGetPendingOrFailedSyncStatuses.mockResolvedValue([{ itemId: "item-gone" }]);
    mockGetPlannedItemWithRecipeById.mockResolvedValue(null);

    const result = await retryFailedSyncs("user-1", "household-1");

    expect(result).toEqual({ totalRetried: 1, totalFailed: 0 });
    expect(mockAddCaldavSyncJob).toHaveBeenCalledWith(
      caldavSync,
      expect.objectContaining({ itemId: "item-gone", operation: "delete", plannedItemId: null })
    );
  });

  it("counts a retry it could not queue", async () => {
    mockGetPendingOrFailedSyncStatuses.mockResolvedValue([{ itemId: "item-1" }]);
    mockGetPlannedItemWithRecipeById.mockRejectedValue(new Error("db down"));

    await expect(retryFailedSyncs("user-1", "household-1")).resolves.toEqual({
      totalRetried: 0,
      totalFailed: 1,
    });
  });

  it("does nothing when CalDAV is not enabled", async () => {
    mockGetCaldavConfigDecrypted.mockResolvedValue({ ...CONFIG, enabled: false });

    const result = await retryFailedSyncs("user-1", "household-1");

    expect(result).toEqual({ totalRetried: 0, totalFailed: 0 });
    expect(mockGetPendingOrFailedSyncStatuses).not.toHaveBeenCalled();
  });
});
