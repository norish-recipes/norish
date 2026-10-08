import { describe, expect, it } from "vitest";

import {
  DEVICE_PREFERENCE_DEFAULTS,
  SetDevicePreferencesInputSchema,
} from "@norish/shared/contracts/zod/device-preferences";
import {
  UpdateUserPreferencesInputSchema,
  UserPreferencesSchema,
} from "@norish/shared/contracts/zod/user";
import {
  getAfterPlanningPreference,
  getLocalePreference,
  getUserPreferences,
} from "@norish/shared/lib/user-preferences";

/** The phone's block as the profile document reads it. */
const phoneBlock = (phone: unknown) => UserPreferencesSchema.parse({ phone }).phone;

describe("user preferences", () => {
  it("answers with empty preferences for a reader who has none", () => {
    expect(getUserPreferences(null)).toEqual({});
    expect(getUserPreferences(undefined)).toEqual({});
    expect(getUserPreferences({ preferences: undefined })).toEqual({});
  });

  it("reads the stored locale and nothing where none is stored", () => {
    expect(getLocalePreference({ preferences: { locale: "de-informal" } })).toBe("de-informal");
    expect(getLocalePreference({ preferences: {} })).toBeNull();
    expect(getLocalePreference(null)).toBeNull();
  });

  it("opens the groceries panel after planning unless the reader chose otherwise", () => {
    expect(getAfterPlanningPreference(null)).toBe("openGroceries");
    expect(getAfterPlanningPreference({ preferences: {} })).toBe("openGroceries");
    expect(getAfterPlanningPreference({ preferences: { afterPlanning: "nothing" } })).toBe(
      "nothing"
    );
    expect(getAfterPlanningPreference({ preferences: { afterPlanning: "addGroceries" } })).toBe(
      "addGroceries"
    );
    expect(UserPreferencesSchema.parse({ afterPlanning: "somethingElse" }).afterPlanning).toBe(
      undefined
    );
  });

  it("ignores a stored hidden key from before the device-preference move", () => {
    const parsed = UserPreferencesSchema.safeParse({ hidden: ["rating"], locale: "en" });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ locale: "en" });
  });

  it("reads a kind's block as full values, an absent or broken choice as its default", () => {
    expect(phoneBlock(undefined)).toBeUndefined();
    expect(phoneBlock("not a block")).toBeUndefined();
    expect(phoneBlock({ groceryViewMode: "recipe" })).toEqual({
      ...DEVICE_PREFERENCE_DEFAULTS,
      groceryViewMode: "recipe",
    });
    expect(phoneBlock({ groceryViewMode: "aisle", groceryGroupSimilar: false })).toEqual({
      ...DEVICE_PREFERENCE_DEFAULTS,
      groceryGroupSimilar: false,
    });
  });

  it("keeps Hidden Items the reader's version does not know, so writing the list back drops none", () => {
    expect(phoneBlock({ hiddenItems: ["rating", "fromANewerVersion"] })).toMatchObject({
      hiddenItems: ["rating", "fromANewerVersion"],
    });
    expect(phoneBlock({ hiddenItems: "rating" })?.hiddenItems).toEqual([]);
  });

  it("keeps a kind's block when a person-level choice is one this version does not know", () => {
    const parsed = UserPreferencesSchema.safeParse({
      locale: 42,
      afterPlanning: "fromANewerVersion",
      phone: { groceryViewMode: "recipe" },
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.phone?.groceryViewMode).toBe("recipe");
    expect(parsed.data?.afterPlanning).toBeUndefined();
    expect(parsed.data?.locale).toBeUndefined();
  });

  it("keeps the language when a kind's block is broken", () => {
    const parsed = UserPreferencesSchema.safeParse({ locale: "nl", phone: "broken" });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ locale: "nl" });
  });

  it("rejects a Device Preference write with a value outside its set", () => {
    const write = (preferences: unknown) =>
      SetDevicePreferencesInputSchema.safeParse({ kind: "phone", preferences }).success;

    expect(write({ groceryViewMode: "recipe", groceryGroupSimilar: false })).toBe(true);
    expect(write({ groceryViewMode: "aisle" })).toBe(false);
    expect(write({ groceryGroupSimilar: "false" })).toBe(false);
    expect(write({ somethingElse: true })).toBe(false);
    expect(
      write({ amountDisplay: "decimal", todaySectionVisibility: "planned", recipeViewMode: "list" })
    ).toBe(true);
    expect(write({ recipePageColor: "neon" })).toBe(false);
    expect(write({ hiddenItems: ["timers", "fromANewerVersion"] })).toBe(true);
    expect(write({ hiddenItems: [""] })).toBe(false);
    expect(
      SetDevicePreferencesInputSchema.safeParse({ kind: "tablet", preferences: {} }).success
    ).toBe(false);
  });

  it("never lets the language update write a kind's block", () => {
    const parsed = UpdateUserPreferencesInputSchema.parse({
      version: 1,
      preferences: { locale: "nl", phone: { groceryViewMode: "recipe" } },
    });

    expect(parsed.preferences).toEqual({ locale: "nl" });
  });
});
