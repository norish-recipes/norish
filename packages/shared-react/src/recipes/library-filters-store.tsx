"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { createStore } from "zustand";

import type { SearchField } from "@norish/shared/contracts";
import type {
  CanonicalRecipeFilters,
  PersistedRecipeFilters,
} from "@norish/shared/contracts/filter-contract";
import {
  changedRecipeFilters,
  DEFAULT_RECIPE_FILTERS,
  toggleSearchFieldIn,
} from "@norish/shared/contracts/filter-contract";

import { createPageStoreContext } from "../page-store";

type LibraryFiltersState = {
  filters: CanonicalRecipeFilters;
  /** False until the stored filters are applied: without the cookie, the first render's are the defaults. */
  hydrated: boolean;
  setFilters: (next: Partial<CanonicalRecipeFilters>) => void;
  /** Every filter but the Library's type, a lens that clearing a search must not move (ADR-0026). */
  clearFilters: () => void;
  toggleSearchField: (field: SearchField) => void;
  /** The browser's stored filters win over the cookie's: a kept document can be old. */
  applyStored: (stored: PersistedRecipeFilters | null) => void;
};

/**
 * The Library's filters, starting on `initial` as already applied: the cookie's, or the last ones
 * this document held with their search text. `undefined` without either.
 */
export function createLibraryFiltersStore(
  initial: PersistedRecipeFilters | CanonicalRecipeFilters | undefined
) {
  return createStore<LibraryFiltersState>()((set) => ({
    filters: { ...DEFAULT_RECIPE_FILTERS, ...initial },
    hydrated: initial !== undefined,
    setFilters: (next) => set((state) => ({ filters: { ...state.filters, ...next } })),
    clearFilters: () =>
      set((state) => ({
        filters: { ...DEFAULT_RECIPE_FILTERS, libraryType: state.filters.libraryType },
      })),
    toggleSearchField: (field) =>
      set((state) => ({
        filters: {
          ...state.filters,
          searchFields: toggleSearchFieldIn(state.filters.searchFields, field),
        },
      })),
    applyStored: (stored) =>
      set((state) => ({
        hydrated: true,
        filters:
          stored && Object.keys(changedRecipeFilters(stored, state.filters)).length > 0
            ? { ...state.filters, ...stored }
            : state.filters,
      })),
  }));
}

const libraryFilters = createPageStoreContext("LibraryFiltersProvider", createLibraryFiltersStore);

/** Makes the Library's filters once from `initial`; a later render's value is the store's own. */
export function LibraryFiltersProvider({
  initial,
  children,
}: {
  initial: PersistedRecipeFilters | CanonicalRecipeFilters | undefined;
  children: ReactNode;
}) {
  const [first] = useState(initial);

  return <libraryFilters.Provider pageKey={first}>{children}</libraryFilters.Provider>;
}

export const useLibraryFiltersStoreApi = libraryFilters.usePageStoreApi;

/** One slice of the Library's filters; renders when that slice changes. */
export const useLibraryFilters = libraryFilters.usePageStore;
