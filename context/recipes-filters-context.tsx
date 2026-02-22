"use client";

import type { SearchField } from "@norish/shared/contracts";

import { createContext, useContext, ReactNode, useMemo } from "react";

import { useRecipeFilters, type RecipeFilters } from "@/hooks/recipes/use-recipe-filters";

type FiltersCtx = {
  filters: RecipeFilters;
  setFilters: (filters: Partial<RecipeFilters>) => void;
  clearFilters: () => void;
  toggleSearchField: (field: SearchField) => void;
};

const RecipesFiltersContext = createContext<FiltersCtx | null>(null);

export function RecipesFiltersProvider({ children }: { children: ReactNode }) {
  const { filters, setFilters, clearFilters, toggleSearchField } = useRecipeFilters();

  const value = useMemo<FiltersCtx>(
    () => ({ filters, setFilters, clearFilters, toggleSearchField }),
    [filters, setFilters, clearFilters, toggleSearchField]
  );

  return <RecipesFiltersContext.Provider value={value}>{children}</RecipesFiltersContext.Provider>;
}

export function useRecipesFiltersContext() {
  const ctx = useContext(RecipesFiltersContext);

  if (!ctx) throw new Error("useRecipesFiltersContext must be used within RecipesFiltersProvider");

  return ctx;
}

// Re-export types for convenience
export type { RecipeFilters };
