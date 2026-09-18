"use client";

import { sharedConfigHooks } from "./shared-config-hooks";

/**
 * Hook to fetch every Ingredient Name and a picture lookup over them. Used by
 * the recipe editor's suggestions and the grocery list's pictures.
 */
export function useIngredientNamesQuery(options: { enabled?: boolean } = {}) {
  return sharedConfigHooks.useIngredientNamesQuery(options);
}
