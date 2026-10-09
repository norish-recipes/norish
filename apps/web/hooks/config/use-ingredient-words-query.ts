"use client";

import { sharedConfigHooks } from "./shared-config-hooks";

/** The ingredient words names are read by, as the server has them (ADR-0037). */
export function useIngredientWordsQuery() {
  return sharedConfigHooks.useIngredientWordsQuery();
}
