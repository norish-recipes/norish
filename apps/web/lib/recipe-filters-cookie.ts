import type { PersistedRecipeFilters } from "@norish/shared-react/filter-contract";
import {
  DEFAULT_PERSISTED_RECIPE_FILTERS,
  normalizePersistedRecipeFilters,
} from "@norish/shared-react/filter-contract";

/** The Library filters this browser last used, so a full load is drawn under them. */
export const RECIPE_FILTERS_COOKIE = "norish-recipe-filters";

/** Only what differs from the defaults, since every request carries it. */
export function recipeFiltersCookieValue(filters: PersistedRecipeFilters): string {
  const changed = Object.entries(filters).filter(
    ([key, value]) =>
      JSON.stringify(value) !==
      JSON.stringify(DEFAULT_PERSISTED_RECIPE_FILTERS[key as keyof PersistedRecipeFilters])
  );

  return encodeURIComponent(JSON.stringify(Object.fromEntries(changed)));
}

/** The cookie's filters; a malformed one reads as the defaults. */
export function recipeFiltersFromCookie(value: string): PersistedRecipeFilters {
  try {
    const stored: unknown = JSON.parse(decodeURIComponent(value));

    return (
      normalizePersistedRecipeFilters({
        ...DEFAULT_PERSISTED_RECIPE_FILTERS,
        ...(stored as object),
      }) ?? DEFAULT_PERSISTED_RECIPE_FILTERS
    );
  } catch {
    return DEFAULT_PERSISTED_RECIPE_FILTERS;
  }
}

/** Kept a year, like the time-zone cookie. */
export function writeRecipeFiltersCookie(filters: PersistedRecipeFilters): void {
  document.cookie = `${RECIPE_FILTERS_COOKIE}=${recipeFiltersCookieValue(filters)}; path=/; max-age=31536000; SameSite=Lax`;
}
