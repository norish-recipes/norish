"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { persistRecipeFilters, readStoredRecipeFilters } from "@/lib/recipe-filters-storage";

import type {
  CanonicalRecipeFilters,
  PersistedRecipeFilters,
} from "@norish/shared/contracts/filter-contract";
import { usePantrySubscription } from "@norish/shared-react/groceries";
import {
  LibraryFiltersProvider,
  useCookbooksSubscription,
  useLibraryFiltersStoreApi,
  useRatingsSubscription,
  useRecipeListSubscription,
} from "@norish/shared-react/recipes";

// The filters the store last held in this document, search text included, so a root remounted on
// return to the Library starts from them. Written only from effects, so the server never holds any.
let lastFilters: CanonicalRecipeFilters | undefined;

function keep(filters: CanonicalRecipeFilters) {
  lastFilters = filters;
  persistRecipeFilters(filters);
}

/** What the Library draws kept current, and the filters kept in the browser and the cookie. */
function LibraryEffects({ resumed }: { resumed: boolean }) {
  const store = useLibraryFiltersStoreApi();

  useRecipeListSubscription();
  useRatingsSubscription();
  useCookbooksSubscription();
  // The Library can be ordered by how much of a recipe the Pantry covers.
  usePantrySubscription();

  // Storage is read after mount, as the server can't, unless the store resumed this document's own;
  // then every change is written back, so the next full load renders under it.
  useEffect(() => {
    if (!resumed) store.getState().applyStored(readStoredRecipeFilters());
    keep(store.getState().filters);

    return store.subscribe((state, previous) => {
      if (state.filters !== previous.filters) keep(state.filters);
    });
  }, [store, resumed]);

  return null;
}

// The dashboard's and a cookbook's filters, from the cookie or this document's last ones, and the
// subscriptions of what they draw (LibraryEffects): recipes, ratings, cookbooks and the Pantry.
export function LibraryRoot({
  filters,
  children,
}: {
  filters: PersistedRecipeFilters | undefined;
  children: ReactNode;
}) {
  const [resumed] = useState(() => lastFilters);

  return (
    <LibraryFiltersProvider initial={resumed ?? filters}>
      <LibraryEffects resumed={resumed !== undefined} />
      {children}
    </LibraryFiltersProvider>
  );
}
