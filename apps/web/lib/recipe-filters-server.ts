import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { RECIPE_FILTERS_COOKIE, recipeFiltersFromCookie } from "@/lib/recipe-filters-cookie";
import { readRequestProfile } from "@/lib/request-profile";

import { hiddenItemVisibility, withoutHiddenFilters } from "@norish/shared-react/reader";
import {
  canonicalRecipeFilters,
  toRecipesQueryFilters,
} from "@norish/shared/contracts/filter-contract";
import { deviceBlocks } from "@norish/shared/contracts/zod/device-preferences";

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
  const [filters, { kind, preferences }] = await Promise.all([
    readRecipeFilters(),
    readRequestProfile(),
  ]);
  const visibility = hiddenItemVisibility(deviceBlocks(preferences)[kind].hiddenItems);

  return (
    filters &&
    toRecipesQueryFilters(withoutHiddenFilters(canonicalRecipeFilters(filters), visibility))
  );
}
