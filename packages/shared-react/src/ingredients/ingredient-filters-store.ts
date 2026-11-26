"use client";

import { create, useStore } from "zustand";

import type { IngredientFilters } from "./ingredient-filters";
import { DEFAULT_INGREDIENT_FILTERS } from "./ingredient-filters";

type FiltersState = {
  filters: IngredientFilters;
  apply: (filters: IngredientFilters) => void;
  reset: () => void;
};

/** The Ingredients list's filters, shared by the list and the sheet that sets them. */
const filtersStore = create<FiltersState>((set) => ({
  filters: DEFAULT_INGREDIENT_FILTERS,
  apply: (filters) => set({ filters }),
  reset: () => set({ filters: DEFAULT_INGREDIENT_FILTERS }),
}));

export function useIngredientFiltersStore<T>(select: (state: FiltersState) => T): T {
  return useStore(filtersStore, select);
}
