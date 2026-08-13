export type RecipeDashboardViewMode = "grid" | "list";

/**
 * The dashboard's grid/list choice rides in a cookie rather than localStorage.
 * The library is server-rendered, and a cookie is the only client preference
 * the server can read while it produces that HTML — anything read after
 * hydration forces the server to guess "grid", and a list reader watches the
 * whole library re-lay-out a frame in.
 */
export const RECIPE_VIEW_MODE_COOKIE = "norish_recipe_view_mode";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function parseRecipeViewMode(value: string | undefined): RecipeDashboardViewMode {
  return value === "list" ? "list" : "grid";
}

/** The stored choice, or null when this browser has never made one. */
export function readRecipeViewModeCookie(): RecipeDashboardViewMode | null {
  if (typeof document === "undefined") return null;

  for (const entry of document.cookie.split(";")) {
    const [name, value] = entry.trim().split("=");

    if (name === RECIPE_VIEW_MODE_COOKIE) return parseRecipeViewMode(value);
  }

  return null;
}

export function writeRecipeViewModeCookie(viewMode: RecipeDashboardViewMode) {
  if (typeof document === "undefined") return;

  document.cookie = `${RECIPE_VIEW_MODE_COOKIE}=${viewMode};path=/;max-age=${COOKIE_MAX_AGE_SECONDS};SameSite=Lax`;
}
