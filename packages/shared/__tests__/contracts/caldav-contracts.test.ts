// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  CaldavItemStatusUpdatedEventSchema,
  SaveCaldavConfigInputSchema,
} from "@norish/shared/contracts/zod";

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

  it("takes an empty password on save, which keeps the stored one", () => {
    const save = SaveCaldavConfigInputSchema.safeParse({
      serverUrl: "https://cal.example.com",
      username: "mike",
      password: "",
      enabled: false,
      breakfastTime: "07:00-08:00",
      lunchTime: "12:00-13:00",
      dinnerTime: "18:00-19:00",
      snackTime: "15:00-16:00",
    });

    expect(save.success).toBe(true);
  });
});
