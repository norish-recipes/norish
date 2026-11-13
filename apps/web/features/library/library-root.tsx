"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { browserStorage } from "@/lib/browser-storage";
import { writeRecipeFiltersCookie } from "@/lib/recipe-filters-cookie";

import type {
  CanonicalRecipeFilters,
  PersistedRecipeFilters,
} from "@norish/shared/contracts/filter-contract";
import { usePantrySubscription } from "@norish/shared-react/groceries";
import {
  LibraryFiltersProvider,
  useCookbooksSubscription,
  useLibraryFiltersPersistence,
  useRatingsSubscription,
  useRecipeListSubscription,
} from "@norish/shared-react/recipes";

// The filters the store last held in this document, search text included, so a root remounted on
// return to the Library starts from them. Written only from effects, so the server never holds any.
let lastFilters: CanonicalRecipeFilters | undefined;

// The device's storage keeps the filters; the cookie tells the server, so a full load draws the same list.
function keep(filters: CanonicalRecipeFilters) {
  lastFilters = filters;
  writeRecipeFiltersCookie(filters);
}

/** What the Library draws kept current, and the filters kept in the browser and the cookie. */
function LibraryEffects({ resumed }: { resumed: boolean }) {
  useRecipeListSubscription();
  useRatingsSubscription();
  useCookbooksSubscription();
  // The Library can be ordered by how much of a recipe the Pantry covers.
  usePantrySubscription();

  // Storage is read after mount, as the server can't, unless the store resumed this document's own.
  useLibraryFiltersPersistence({ storage: browserStorage, resumed, onKeep: keep });

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
