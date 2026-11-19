import { useSyncExternalStore } from "react";

import type { CanonicalRecipeFilters } from "@norish/shared/contracts/filter-contract";
import { DEFAULT_RECIPE_FILTERS } from "@norish/shared/contracts/filter-contract";

import { BEST_MATCH } from "./search-sort";

/** What a fresh Search holds: recipes only, ranked by Best match, Title and Ingredients. */
export const SEARCH_START: CanonicalRecipeFilters = {
  ...DEFAULT_RECIPE_FILTERS,
  sortMode: BEST_MATCH,
  libraryType: "recipes",
};

// The tRPC provider remounts the tree when the session settles, so what Search holds lives here.
let filters: CanonicalRecipeFilters = SEARCH_START;
let confirmed = false;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => void listeners.delete(listener);
};

/** The filters Search last held, text and Search Scope included; never stored on the device. */
export const savedSearchFilters = () => filters;

export function keepSearchFilters(next: CanonicalRecipeFilters) {
  filters = next;
}

/** Whether Results show: set by the search key, a chip or a discover row, cleared by typing. */
export function setSearchConfirmed(next: boolean) {
  if (confirmed === next) return;

  confirmed = next;
  listeners.forEach((listener) => listener());
}

export const useSearchConfirmed = () => useSyncExternalStore(subscribe, () => confirmed);

/** A new session starts Search over. */
export function resetSearchSession() {
  filters = SEARCH_START;
  setSearchConfirmed(false);
}
