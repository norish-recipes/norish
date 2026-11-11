// @vitest-environment node

import { describe, expect, it } from "vitest";

import { CaldavItemStatusUpdatedEventSchema } from "@norish/shared/contracts/zod";

describe("CalDAV realtime contracts", () => {
  it("requires version on item status updates", () => {
    const valid = CaldavItemStatusUpdatedEventSchema.safeParse({
      itemId: "item-1",
      itemType: "recipe",
      syncStatus: "synced",
      errorMessage: null,
      caldavEventUid: "uid-1",
      version: 2,
    });
    const invalid = CaldavItemStatusUpdatedEventSchema.safeParse({
      itemId: "item-1",
      itemType: "recipe",
      syncStatus: "synced",
      errorMessage: null,
      caldavEventUid: "uid-1",
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });
});
