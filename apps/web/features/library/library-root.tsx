"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { persistRecipeFilters, readStoredRecipeFilters } from "@/lib/recipe-filters-storage";

import type { PersistedRecipeFilters } from "@norish/shared/contracts/filter-contract";
import {
  LibraryFiltersProvider,
  useLibraryFiltersStoreApi,
  useLibrarySubscriptions,
} from "@norish/shared-react/recipes";

/** The list's and the ratings' events, and the filters kept in the browser and the cookie. */
function LibraryEffects() {
  const store = useLibraryFiltersStoreApi();

  useLibrarySubscriptions();

  // Storage is read after mount, as the server can't; then every change is written back, so the
  // next full load renders under it.
  useEffect(() => {
    store.getState().applyStored(readStoredRecipeFilters());
    persistRecipeFilters(store.getState().filters);

    return store.subscribe((state, previous) => {
      if (state.filters !== previous.filters) persistRecipeFilters(state.filters);
    });
  }, [store]);

  return null;
}

/**
 * What the dashboard and a cookbook page share: the filters, made once from the cookie (`undefined`
 * without one, and in the offline bootstrap), and the list's subscriptions.
 */
export function LibraryRoot({
  filters,
  children,
}: {
  filters: PersistedRecipeFilters | undefined;
  children: ReactNode;
}) {
  return (
    <LibraryFiltersProvider cookie={filters}>
      <LibraryEffects />
      {children}
    </LibraryFiltersProvider>
  );
}
