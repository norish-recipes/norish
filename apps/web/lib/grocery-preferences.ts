import { defineDevicePreference } from "@/lib/device-preferences";

export type GroceryViewMode = "store" | "recipe";

/** Cookies carry strings, so the boolean grouping toggle rides as one. */
export type GroceryGroupSimilar = "true" | "false";

/**
 * The groceries page's device preferences ride in cookies so the server can
 * render the page the way the reader left it: the stored view and grouping
 * arrive in the first HTML instead of the default painting and swapping a
 * frame in.
 */
export const groceryViewModePreference = defineDevicePreference({
  cookieName: "norish_grocery_view_mode",
  values: ["store", "recipe"] as const satisfies readonly GroceryViewMode[],
  defaultValue: "store",
});

export const groceryGroupSimilarPreference = defineDevicePreference({
  cookieName: "norish_grocery_group_similar",
  values: ["true", "false"] as const satisfies readonly GroceryGroupSimilar[],
  defaultValue: "true",
});
