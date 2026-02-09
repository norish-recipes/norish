"use client";

import { useState, useCallback, useMemo } from "react";

import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  FilterMode,
  SortOrder,
  SearchField,
  RecipeCategory,
  DEFAULT_SEARCH_FIELDS,
  SEARCH_FIELDS,
} from "@/types";

const VALID_CATEGORIES: RecipeCategory[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

// Full filter state including non-persisted rawInput
export type RecipeFilters = {
  rawInput: string;
  searchTags: string[];
  searchFields: SearchField[];
  filterMode: FilterMode;
  sortMode: SortOrder;
  showFavoritesOnly: boolean;
  minRating: number | null;
  maxCookingTime: number | null;
  categories: RecipeCategory[];
};

// What gets persisted (excludes rawInput)
type PersistedFilters = Omit<RecipeFilters, "rawInput">;

// Valid values for validation
const VALID_SORT_MODES: SortOrder[] = ["titleAsc", "titleDesc", "dateAsc", "dateDesc", "none"];
const VALID_FILTER_MODES: FilterMode[] = ["AND", "OR"];

const DEFAULT_PERSISTED: PersistedFilters = {
  searchTags: [],
  searchFields: [...DEFAULT_SEARCH_FIELDS],
  filterMode: "AND",
  sortMode: "dateDesc",
  showFavoritesOnly: false,
  minRating: null,
  maxCookingTime: null,
  categories: [],
};

/**
 * Validate persisted filter data from localStorage.
 */
function validateFilters(data: unknown): PersistedFilters | null {
  if (typeof data !== "object" || data === null) return null;

  const d = data as Record<string, unknown>;

  const sortMode = VALID_SORT_MODES.includes(d.sortMode as SortOrder)
    ? (d.sortMode as SortOrder)
    : null;
  const filterMode = VALID_FILTER_MODES.includes(d.filterMode as FilterMode)
    ? (d.filterMode as FilterMode)
    : null;
  const searchTags = Array.isArray(d.searchTags)
    ? d.searchTags.filter((t): t is string => typeof t === "string")
    : null;
  const searchFields = Array.isArray(d.searchFields)
    ? d.searchFields.filter((f): f is SearchField => SEARCH_FIELDS.includes(f as SearchField))
    : null;
  const showFavoritesOnly = typeof d.showFavoritesOnly === "boolean" ? d.showFavoritesOnly : null;
  const minRating =
    d.minRating === null || (typeof d.minRating === "number" && d.minRating >= 0)
      ? (d.minRating as number | null)
      : null;
  const maxCookingTime =
    d.maxCookingTime === null || (typeof d.maxCookingTime === "number" && d.maxCookingTime > 0)
      ? (d.maxCookingTime as number | null)
      : null;
  const categories = Array.isArray(d.categories)
    ? d.categories.filter((c): c is RecipeCategory =>
        VALID_CATEGORIES.includes(c as RecipeCategory)
      )
    : null;

  // Return null if nothing valid
  if (sortMode === null && filterMode === null && searchFields === null) return null;

  return {
    sortMode: sortMode ?? DEFAULT_PERSISTED.sortMode,
    filterMode: filterMode ?? DEFAULT_PERSISTED.filterMode,
    searchTags: searchTags ?? DEFAULT_PERSISTED.searchTags,
    searchFields: searchFields ?? [...DEFAULT_PERSISTED.searchFields],
    showFavoritesOnly: showFavoritesOnly ?? DEFAULT_PERSISTED.showFavoritesOnly,
    minRating: minRating ?? DEFAULT_PERSISTED.minRating,
    maxCookingTime: maxCookingTime ?? DEFAULT_PERSISTED.maxCookingTime,
    categories: categories ?? DEFAULT_PERSISTED.categories,
  };
}

export type UseRecipeFiltersResult = {
  filters: RecipeFilters;
  setFilters: (filters: Partial<RecipeFilters>) => void;
  clearFilters: () => void;
  toggleSearchField: (field: SearchField) => void;
};

/**
 * Hook for managing recipe filters with localStorage persistence.
 * Persists all filter settings except rawInput (search text).
 */
export function useRecipeFilters(): UseRecipeFiltersResult {
  const [persisted, setPersisted, clearPersisted] = useLocalStorage<PersistedFilters>(
    "norish:recipe-filters",
    DEFAULT_PERSISTED,
    validateFilters
  );

  const [rawInput, setRawInput] = useState("");

  const filters: RecipeFilters = useMemo(() => ({ rawInput, ...persisted }), [rawInput, persisted]);

  const setFilters = useCallback(
    (newFilters: Partial<RecipeFilters>) => {
      if ("rawInput" in newFilters) {
        setRawInput(newFilters.rawInput ?? "");
      }

      const { rawInput: _rawInput, ...persistedUpdates } = newFilters;

      if (Object.keys(persistedUpdates).length > 0) {
        setPersisted((prev) => ({ ...prev, ...persistedUpdates }));
      }
    },
    [setPersisted]
  );

  const clearFilters = useCallback(() => {
    setRawInput("");
    clearPersisted();
  }, [clearPersisted]);

  const toggleSearchField = useCallback(
    (field: SearchField) => {
      setPersisted((prev) => {
        const isEnabled = prev.searchFields.includes(field);

        if (isEnabled) {
          if (prev.searchFields.length <= 1) {
            return { ...prev, searchFields: [...DEFAULT_SEARCH_FIELDS] };
          }

          return { ...prev, searchFields: prev.searchFields.filter((f) => f !== field) };
        }

        return { ...prev, searchFields: [...prev.searchFields, field] };
      });
    },
    [setPersisted]
  );

  return { filters, setFilters, clearFilters, toggleSearchField };
}
