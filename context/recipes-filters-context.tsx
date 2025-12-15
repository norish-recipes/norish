"use client";

import { createContext, useContext, ReactNode, useMemo, useCallback, useState } from "react";

import { FilterMode, SortOrder } from "@/types";

// Filter state for recipes
export type RecipeFilters = {
  rawInput: string;
  searchTags: string[];
  filterMode: FilterMode;
  sortMode: SortOrder;
  showFavoritesOnly: boolean;
};

type FiltersCtx = {
  filters: RecipeFilters;
  setFilters: (filters: Partial<RecipeFilters>) => void;
  clearFilters: () => void;
};

const RecipesFiltersContext = createContext<FiltersCtx | null>(null);

export function RecipesFiltersProvider({ children }: { children: ReactNode }) {
  // Filter state
  const [filters, setFiltersState] = useState<RecipeFilters>({
    rawInput: "",
    searchTags: [],
    filterMode: "AND",
    sortMode: "dateDesc",
    showFavoritesOnly: false,
  });

  const setFilters = useCallback((newFilters: Partial<RecipeFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState({
      rawInput: "",
      searchTags: [],
      filterMode: "AND",
      sortMode: "dateDesc",
      showFavoritesOnly: false,
    });
  }, []);

  const value = useMemo<FiltersCtx>(
    () => ({
      filters,
      setFilters,
      clearFilters,
    }),
    [filters, setFilters, clearFilters]
  );

  return <RecipesFiltersContext.Provider value={value}>{children}</RecipesFiltersContext.Provider>;
}

export function useRecipesFiltersContext() {
  const ctx = useContext(RecipesFiltersContext);

  if (!ctx) throw new Error("useRecipesFiltersContext must be used within RecipesFiltersProvider");

  return ctx;
}
