import type { ReactNode } from "react";
import { searchStore } from "@/lib/search-session";

import { LibraryFiltersProvider } from "@norish/shared-react/recipes";

/** Search's own filters, apart from the Recipes tab's and never stored. */
export function SearchRoot({ children }: { children: ReactNode }) {
  return <LibraryFiltersProvider store={searchStore}>{children}</LibraryFiltersProvider>;
}
