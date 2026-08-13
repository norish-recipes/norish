import { defineDevicePreference } from "@/lib/device-preferences";

export type RecipeDashboardViewMode = "grid" | "list";

/**
 * The dashboard's grid/list choice rides in a device-preference cookie. The
 * library is server-rendered, and a cookie is the only client preference
 * the server can read while it produces that HTML — anything read after
 * hydration forces the server to guess "grid", and a list reader watches
 * the whole library re-lay-out a frame in.
 */
export const recipeViewModePreference = defineDevicePreference({
  cookieName: "norish_recipe_view_mode",
  values: ["grid", "list"] as const satisfies readonly RecipeDashboardViewMode[],
  defaultValue: "grid",
});
