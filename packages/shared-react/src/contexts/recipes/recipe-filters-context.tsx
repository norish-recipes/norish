import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { SearchField } from "@norish/shared/contracts";

import type { RecipeFiltersStorageAdapter } from "../../hooks/recipes/dashboard/recipe-filters-storage-adapter";
import type { CanonicalRecipeFilters } from "./filter-contract";
import {
  DEFAULT_RECIPE_FILTERS,
  normalizePersistedRecipeFilters,
  toggleSearchFieldIn,
} from "./filter-contract";

type RecipeFiltersContextValue = {
  filters: CanonicalRecipeFilters;
  setFilters: (next: Partial<CanonicalRecipeFilters>) => void;
  clearFilters: () => void;
  toggleSearchField: (field: SearchField) => void;
  isHydrated: boolean;
};

type CreateRecipeFiltersContextOptions = {
  storageAdapter?: RecipeFiltersStorageAdapter;
  storageKey?: string;
};

const DEFAULT_STORAGE_KEY = "norish:recipe-filters";

export function createRecipeFiltersContext({
  storageAdapter,
  storageKey = DEFAULT_STORAGE_KEY,
}: CreateRecipeFiltersContextOptions = {}) {
  const RecipeFiltersContext = createContext<RecipeFiltersContextValue | null>(null);

  function RecipeFiltersProvider({ children }: { children: React.ReactNode }) {
    const [filters, setFilterState] = useState(DEFAULT_RECIPE_FILTERS);
    const [isHydrated, setHydrated] = useState(storageAdapter === undefined);

    useEffect(() => {
      if (!storageAdapter) return;

      let mounted = true;

      const loadPersistedFilters = async () => {
        try {
          const rawValue = await storageAdapter.getItem(storageKey);

          if (!mounted) return;

          if (!rawValue) {
            setHydrated(true);

            return;
          }

          const parsed = JSON.parse(rawValue) as unknown;
          const normalized = normalizePersistedRecipeFilters(parsed);

          if (normalized) {
            setFilterState((previous) => ({ ...previous, ...normalized }));
          }
        } finally {
          if (mounted) {
            setHydrated(true);
          }
        }
      };

      void loadPersistedFilters();

      return () => {
        mounted = false;
      };
    }, [storageAdapter, storageKey]);

    useEffect(() => {
      if (!storageAdapter || !isHydrated) return;

      const { rawInput: _rawInput, ...persisted } = filters;

      void storageAdapter.setItem(storageKey, JSON.stringify(persisted));
    }, [filters, isHydrated, storageAdapter, storageKey]);

    const setFilters = useCallback((next: Partial<CanonicalRecipeFilters>) => {
      setFilterState((previous) => ({ ...previous, ...next }));
    }, []);

    const clearFilters = useCallback(() => {
      // The Library type is a lens, not a filter: clearing a search must not
      // move a reader who browses by cookbook back to All (ADR-0026).
      setFilterState((previous) => ({
        ...DEFAULT_RECIPE_FILTERS,
        libraryType: previous.libraryType,
      }));
      void storageAdapter?.removeItem(storageKey);
    }, [storageAdapter, storageKey]);

    const toggleSearchField = useCallback((field: SearchField) => {
      setFilterState((previous) => ({
        ...previous,
        searchFields: toggleSearchFieldIn(previous.searchFields, field),
      }));
    }, []);

    const value = useMemo<RecipeFiltersContextValue>(
      () => ({ filters, setFilters, clearFilters, toggleSearchField, isHydrated }),
      [filters, setFilters, clearFilters, toggleSearchField, isHydrated]
    );

    return <RecipeFiltersContext.Provider value={value}>{children}</RecipeFiltersContext.Provider>;
  }

  function useRecipeFiltersContext() {
    const context = useOptionalRecipeFiltersContext();

    if (!context) {
      throw new Error("useRecipeFiltersContext must be used within RecipeFiltersProvider");
    }

    return context;
  }

  /**
   * The filters where there are any, and null outside the provider.
   *
   * Wanting to *name* the Library is not the same as being part of it: a back
   * link that says where "/" will land reads the lens, but a recipe page is
   * not a filtered list and should not stop rendering because nothing above it
   * happens to be one.
   */
  function useOptionalRecipeFiltersContext() {
    return useContext(RecipeFiltersContext);
  }

  return {
    RecipeFiltersProvider,
    useRecipeFiltersContext,
    useOptionalRecipeFiltersContext,
  };
}
