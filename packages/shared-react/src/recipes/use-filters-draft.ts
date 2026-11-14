"use client";

import { useState } from "react";

import type { RecipeCategory, SortOrder } from "@norish/shared/contracts";
import type { CanonicalRecipeFilters } from "@norish/shared/contracts/filter-contract";
import { DEFAULT_RECIPE_FILTERS } from "@norish/shared/contracts/filter-contract";

import { useHiddenItemVisibility } from "../reader";
import { useLibraryFilters } from "./library-filters-store";

/** The cooking-time limits a filter offers, with the `common.filters` key of each label. */
export const COOKING_TIME_OPTIONS = [
  { value: 15, labelKey: "cookingTimeUnder15" },
  { value: 30, labelKey: "cookingTimeUnder30" },
  { value: 60, labelKey: "cookingTimeUnder60" },
  { value: 120, labelKey: "cookingTimeUnder120" },
] as const;

/** What the Filters panel edits before Apply: the filters, less the Library type the lenses set. */
export type FiltersDraft = Omit<CanonicalRecipeFilters, "libraryType">;

const SORT_ORDERS: readonly SortOrder[] = ["titleAsc", "titleDesc", "dateAsc", "dateDesc", "none"];

export function draftOf(filters: CanonicalRecipeFilters): FiltersDraft {
  const { libraryType: _libraryType, ...draft } = filters;

  return {
    ...draft,
    sortMode: SORT_ORDERS.includes(filters.sortMode) ? filters.sortMode : "none",
    maxCookingTime: filters.maxCookingTime ?? null,
  };
}

export const toggled = <T>(list: T[], item: T) =>
  list.includes(item) ? list.filter((other) => other !== item) : [...list, item];

/** A sort button's next order: ascending, then descending, then off. */
export function nextSortOrder(current: SortOrder, type: "title" | "date"): SortOrder {
  const asc = `${type}Asc` as SortOrder;
  const desc = `${type}Desc` as SortOrder;

  return current === asc ? desc : current === desc ? "none" : asc;
}

/** The Filters panel's draft of the applied filters until `apply`; `reset` clears the applied ones
 * too. Mount it while the panel is open, so each opening starts fresh. */
export function useFiltersDraft() {
  const filters = useLibraryFilters((state) => state.filters);
  const setFilters = useLibraryFilters((state) => state.setFilters);
  const clearFilters = useLibraryFilters((state) => state.clearFilters);
  const { showRatings, showFavorites } = useHiddenItemVisibility();
  const [draft, setDraft] = useState(() => draftOf(filters));

  const update = (patch: Partial<FiltersDraft>) =>
    setDraft((previous) => ({ ...previous, ...patch }));

  return {
    draft,
    update,
    toggleTag: (tag: string) =>
      setDraft((previous) => ({ ...previous, searchTags: toggled(previous.searchTags, tag) })),
    toggleCategory: (category: RecipeCategory) =>
      setDraft((previous) => ({ ...previous, categories: toggled(previous.categories, category) })),
    toggleCookingTime: (value: number) =>
      setDraft((previous) => ({
        ...previous,
        maxCookingTime: previous.maxCookingTime === value ? null : value,
      })),
    decideSortOrder: (type: "title" | "date") =>
      setDraft((previous) => ({ ...previous, sortMode: nextSortOrder(previous.sortMode, type) })),
    reset: () => {
      clearFilters();
      setDraft(draftOf(DEFAULT_RECIPE_FILTERS));
    },
    // A hidden favourites or rating filter is dropped, so it can't narrow a list that never offers it.
    apply: () =>
      setFilters({
        ...draft,
        showFavoritesOnly: showFavorites ? draft.showFavoritesOnly : false,
        minRating: showRatings ? draft.minRating : null,
      }),
  };
}
