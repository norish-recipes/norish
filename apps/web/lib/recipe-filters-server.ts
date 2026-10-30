import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { RECIPE_FILTERS_COOKIE, recipeFiltersFromCookie } from "@/lib/recipe-filters-cookie";

import {
  canonicalRecipeFilters,
  toRecipesQueryFilters,
} from "@norish/shared-react/filter-contract";

/**
 * The reader's Library filters for this request, read once; undefined without the cookie, when the
 * browser reads its own copy after mount.
 */
export const readRecipeFilters = cache(async () => {
  const value = (await cookies()).get(RECIPE_FILTERS_COOKIE)?.value;

  return value === undefined ? undefined : recipeFiltersFromCookie(value);
});

/** The same filters as the list queries take them, so a seed keys what the browser will ask. */
export async function readRecipeQueryFilters() {
  const filters = await readRecipeFilters();

  return filters && toRecipesQueryFilters(canonicalRecipeFilters(filters));
}
