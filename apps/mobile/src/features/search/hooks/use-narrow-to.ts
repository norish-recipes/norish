import { useLibraryFilters, useLibraryFiltersStoreApi } from "@norish/shared-react/recipes";

import type { NarrowRow } from "../utils/search-suggestions";
import { narrowPatch } from "../utils/search-suggestions";
import { useAddIngredient } from "./use-add-ingredient";

/** What a Narrow-to row does: adds its chip (an Ingredient with its name at once), then the field
 * empties its text and Results show. `narrowed` is the field's. */
export function useNarrowTo(narrowed: () => void) {
  const addIngredient = useAddIngredient();
  const store = useLibraryFiltersStoreApi();
  const setFilters = useLibraryFilters((state) => state.setFilters);

  return (row: NarrowRow) => {
    if (row.kind === "ingredient") addIngredient({ id: row.id, name: row.name });
    else setFilters(narrowPatch(row, store.getState().filters));

    narrowed();
  };
}
