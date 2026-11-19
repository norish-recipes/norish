import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { LibraryFiltersProvider, useLibraryFiltersStoreApi } from "@norish/shared-react/recipes";

import { keepSearchFilters, savedSearchFilters } from "../utils/search-session";

function KeepFilters() {
  const store = useLibraryFiltersStoreApi();

  useEffect(() => store.subscribe((state) => keepSearchFilters(state.filters)), [store]);

  return null;
}

/** Search's own filters, apart from the Recipes tab's and never stored: the session keeps them across a remount. */
export function SearchRoot({ children }: { children: ReactNode }) {
  const [resumed] = useState(savedSearchFilters);

  return (
    <LibraryFiltersProvider initial={resumed}>
      <KeepFilters />
      {children}
    </LibraryFiltersProvider>
  );
}
