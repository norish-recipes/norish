import type { ReactNode } from "react";
import { useState } from "react";

import type { CanonicalRecipeFilters } from "@norish/shared/contracts/filter-contract";
import { usePlatform } from "@norish/shared-react/platform";
import { LibraryFiltersProvider, useLibraryFiltersPersistence } from "@norish/shared-react/recipes";

// The tRPC provider remounts the tree when the session settles, so the filters it last held live here.
let lastFilters: CanonicalRecipeFilters | undefined;

function keep(filters: CanonicalRecipeFilters) {
  lastFilters = filters;
}

function LibraryEffects({ resumed }: { resumed: boolean }) {
  const { storage } = usePlatform();

  useLibraryFiltersPersistence({ storage, resumed, onKeep: keep });

  return null;
}

/** The Library's filters for the Recipes stack, kept on the device and across a remount. */
export function LibraryRoot({ children }: { children: ReactNode }) {
  const [resumed] = useState(() => lastFilters);

  return (
    <LibraryFiltersProvider initial={resumed}>
      <LibraryEffects resumed={resumed !== undefined} />
      {children}
    </LibraryFiltersProvider>
  );
}
