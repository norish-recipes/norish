"use client";

import type { ReactNode } from "react";
import type { StoreApi } from "zustand";
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
  /** Filters a clear leaves alone, besides the Library's type: Search keeps its text, scope and sort. */
  keepOnClear: readonly (keyof CanonicalRecipeFilters)[];
  /** Resets every filter except the Library's type, a lens that clearing a search must not move
   * (ADR-0026), and those in `keepOnClear`. */
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
    keepOnClear: [],
    clearFilters: () =>
      set((state) => ({
        filters: {
          ...DEFAULT_RECIPE_FILTERS,
          ...Object.fromEntries(state.keepOnClear.map((key) => [key, state.filters[key]])),
          libraryType: state.filters.libraryType,
        },
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

type LibraryFiltersStore = ReturnType<typeof createLibraryFiltersStore>;
type InitialFilters = PersistedRecipeFilters | CanonicalRecipeFilters | undefined;

const isStore = (key: InitialFilters | StoreApi<LibraryFiltersState>): key is LibraryFiltersStore =>
  key !== undefined && "getState" in key;

const libraryFilters = createPageStoreContext(
  "LibraryFiltersProvider",
  (key: InitialFilters | StoreApi<LibraryFiltersState>) =>
    isStore(key) ? key : createLibraryFiltersStore(key)
);

/**
 * Makes the Library's filters once from `initial`; a later render's value is the store's own.
 * A `store` made elsewhere is used as it is, for filters that outlive the provider's tree.
 */
export function LibraryFiltersProvider({
  initial,
  store,
  children,
}: {
  initial?: InitialFilters;
  store?: LibraryFiltersStore;
  children: ReactNode;
}) {
  const [first] = useState(store ?? initial);

  return <libraryFilters.Provider pageKey={first}>{children}</libraryFilters.Provider>;
}

export const useLibraryFiltersStoreApi = libraryFilters.usePageStoreApi;

/** One slice of the Library's filters; renders when that slice changes. */
export const useLibraryFilters = libraryFilters.usePageStore;
