import { useHiddenItemVisibility } from "@norish/shared-react/reader";
import { useLibraryFilters } from "@norish/shared-react/recipes";

import { visibleFilters } from "../utils/search-chips";

/** Search's filters as it reads them: the store's, less any the reader's Hidden Items hides. */
export function useSearchFilters() {
  const filters = useLibraryFilters((state) => state.filters);

  return visibleFilters(filters, useHiddenItemVisibility());
}
