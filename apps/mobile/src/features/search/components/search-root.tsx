import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { keepSearchFilters, savedSearchFilters } from "@/lib/search-session";

import { LibraryFiltersProvider, useLibraryFiltersStoreApi } from "@norish/shared-react/recipes";

function KeepFilters() {
  const store = useLibraryFiltersStoreApi();

  // Clear filters leaves the text, scope and sort: they are the field's, not chips.
  useEffect(() => {
    store.setState({ keepOnClear: ["rawInput", "searchFields", "sortMode"] });

    return store.subscribe((state) => keepSearchFilters(state.filters));
  }, [store]);

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
