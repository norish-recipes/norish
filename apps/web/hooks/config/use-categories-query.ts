"use client";

import { sharedConfigHooks } from "./shared-config-hooks";

/** The household's Categories, for the recipe form's chips. */
export function useCategoriesQuery() {
  return sharedConfigHooks.useCategoriesQuery();
}
