import { describe, expect, it } from "vitest";

import { UserPreferencesSchema } from "@norish/shared/contracts/zod/user";
import { getLocalePreference, getUserPreferences } from "@norish/shared/lib/user-preferences";

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

  it("ignores a stored hidden key from before the device-preference move", () => {
    // Hidden Items left this contract with ticket 23: the list is a device
    // cookie now. A row written before the move still parses, hidden dropped.
    const parsed = UserPreferencesSchema.safeParse({ hidden: ["rating"], locale: "en" });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ locale: "en" });
  });
});
