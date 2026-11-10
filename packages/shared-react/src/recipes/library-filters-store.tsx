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
  canonicalRecipeFilters,
  changedRecipeFilters,
  DEFAULT_RECIPE_FILTERS,
  toggleSearchFieldIn,
} from "@norish/shared/contracts/filter-contract";

import { createPageStoreContext } from "./page-store";

export type LibraryFiltersState = {
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

/** The Library's filters, starting on the cookie's; `undefined` without one. */
export function createLibraryFiltersStore(cookie: PersistedRecipeFilters | undefined) {
  return createStore<LibraryFiltersState>()((set) => ({
    filters: cookie ? canonicalRecipeFilters(cookie) : DEFAULT_RECIPE_FILTERS,
    hydrated: cookie !== undefined,
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

/** Makes the Library's filters once from the cookie's; a later render's cookie is the store's own. */
export function LibraryFiltersProvider({
  cookie,
  children,
}: {
  cookie: PersistedRecipeFilters | undefined;
  children: ReactNode;
}) {
  const [first] = useState(cookie);

  return <libraryFilters.Provider pageKey={first}>{children}</libraryFilters.Provider>;
}

export const useLibraryFiltersStoreApi = libraryFilters.usePageStoreApi;

/** One slice of the Library's filters; renders when that slice changes. */
export const useLibraryFilters = libraryFilters.usePageStore;
