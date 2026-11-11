import { describe, expect, it } from "vitest";

import type { CaldavSyncStatusViewDto } from "@norish/shared/contracts";

import { applyCaldavStatusUpdate } from "../use-caldav-subscription";

describe("CalDAV version helpers", () => {
  it("updates cached sync status versions from realtime payloads", () => {
    const before = [
      {
        id: "status-1",
        userId: "user-1",
        itemId: "item-1",
        itemType: "recipe",
        plannedItemId: null,
        eventTitle: "Dinner",
        syncStatus: "pending",
        caldavEventUid: null,
        retryCount: 0,
        errorMessage: null,
        lastSyncAt: null,
        version: 1,
        createdAt: new Date("2026-03-20T12:00:00.000Z"),
        updatedAt: new Date("2026-03-20T12:00:00.000Z"),
        date: "2026-03-20",
        slot: "Dinner",
      },
    ] satisfies CaldavSyncStatusViewDto[];

    const now = new Date("2026-03-20T12:30:00.000Z");
    const after = applyCaldavStatusUpdate(
      before,
      {
        itemId: "item-1",
        itemType: "recipe",
        syncStatus: "synced",
        errorMessage: null,
        caldavEventUid: "evt-1",
        version: 2,
      },
      now
    );

    expect(after[0]).toMatchObject({
      syncStatus: "synced",
      caldavEventUid: "evt-1",
      version: 2,
      lastSyncAt: now,
    });
  });
});
