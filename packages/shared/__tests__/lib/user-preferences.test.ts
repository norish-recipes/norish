import { describe, expect, it } from "vitest";

import { HIDDEN_ITEMS, UpdateUserPreferencesInputSchema } from "@norish/shared/contracts/zod/user";
import {
  getHiddenItems,
  getTimersEnabledPreference,
  isHiddenForUser,
  partitionHiddenItems,
} from "@norish/shared/lib/user-preferences";

describe("hidden items", () => {
  it("shows everything to a reader with no preferences at all", () => {
    expect(isHiddenForUser(null, "rating")).toBe(false);
    expect(isHiddenForUser(undefined, "nutrition")).toBe(false);
    expect(isHiddenForUser({ preferences: {} }, "notes")).toBe(false);
  });

  it("shows everything when the stored list is empty", () => {
    expect(isHiddenForUser({ preferences: { hidden: [] } }, "favorites")).toBe(false);
  });

  it("hides only what the reader chose", () => {
    const user = { preferences: { hidden: ["rating", "notes"] } };

    expect(isHiddenForUser(user, "rating")).toBe(true);
    expect(isHiddenForUser(user, "notes")).toBe(true);
    expect(isHiddenForUser(user, "favorites")).toBe(false);
    expect(isHiddenForUser(user, "provenance")).toBe(false);
  });

  it("ignores a name it does not recognise rather than failing on it", () => {
    const user = { preferences: { hidden: ["something-newer", "rating"] } };

    expect(getHiddenItems(user)).toEqual(["something-newer", "rating"]);
    expect(isHiddenForUser(user, "rating")).toBe(true);
    expect(isHiddenForUser(user, "conversion")).toBe(false);
  });

  it("splits a stored list into what a control can offer and what it must carry", () => {
    const user = { preferences: { hidden: ["something-newer", "rating", "notes"] } };

    // Selected names come back in contract order, whatever order they were stored.
    expect(partitionHiddenItems(user)).toEqual({
      selected: ["notes", "rating"],
      carried: ["something-newer"],
    });
  });

  it("splits an absent list into nothing and nothing", () => {
    expect(partitionHiddenItems(null)).toEqual({ selected: [], carried: [] });
  });

  it("carries a known name a control is not currently offering", () => {
    const user = { preferences: { hidden: ["timers", "rating"] } };
    const offered = HIDDEN_ITEMS.filter((item) => item !== "timers");

    expect(partitionHiddenItems(user, offered)).toEqual({
      selected: ["rating"],
      carried: ["timers"],
    });
  });

  it("treats timers as shown until the reader hides them", () => {
    expect(getTimersEnabledPreference(null)).toBe(true);
    expect(getTimersEnabledPreference({ preferences: { hidden: [] } })).toBe(true);
    expect(getTimersEnabledPreference({ preferences: { hidden: ["rating"] } })).toBe(true);
    expect(getTimersEnabledPreference({ preferences: { hidden: ["timers"] } })).toBe(false);
  });

  it("accepts the list at the API boundary, unknown names included", () => {
    const parsed = UpdateUserPreferencesInputSchema.safeParse({
      version: 1,
      preferences: { hidden: ["rating", "something-newer"] },
    });

    expect(parsed.success).toBe(true);
  });
});
