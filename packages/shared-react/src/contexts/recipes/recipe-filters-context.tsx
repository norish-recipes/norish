import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { DEFAULT_SEARCH_FIELDS, SearchField } from "@norish/shared/contracts";

import type { RecipeFiltersStorageAdapter } from "../../hooks/recipes/dashboard/recipe-filters-storage-adapter";
import type { CanonicalRecipeFilters } from "./filter-contract";
import { DEFAULT_RECIPE_FILTERS, normalizePersistedRecipeFilters } from "./filter-contract";

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
      setFilterState(DEFAULT_RECIPE_FILTERS);
      void storageAdapter?.removeItem(storageKey);
    }, [storageAdapter, storageKey]);

    const toggleSearchField = useCallback((field: SearchField) => {
      setFilterState((previous) => {
        const isEnabled = previous.searchFields.includes(field);

        if (isEnabled) {
          if (previous.searchFields.length <= 1) {
            return { ...previous, searchFields: [...DEFAULT_SEARCH_FIELDS] };
          }

          return {
            ...previous,
            searchFields: previous.searchFields.filter((item) => item !== field),
          };
        }

        return {
          ...previous,
          searchFields: [...previous.searchFields, field],
        };
      });
    }, []);

    const value = useMemo<RecipeFiltersContextValue>(
      () => ({ filters, setFilters, clearFilters, toggleSearchField, isHydrated }),
      [filters, setFilters, clearFilters, toggleSearchField, isHydrated]
    );

    return <RecipeFiltersContext.Provider value={value}>{children}</RecipeFiltersContext.Provider>;
  }

  function useRecipeFiltersContext() {
    const context = useContext(RecipeFiltersContext);

    if (!context) {
      throw new Error("useRecipeFiltersContext must be used within RecipeFiltersProvider");
    }

    return context;
  }

  return {
    RecipeFiltersProvider,
    useRecipeFiltersContext,
  };
}
