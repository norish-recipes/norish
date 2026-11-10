import type { CreateRecipeHooksOptions } from "../recipes/types";
import { useLibraryQuery } from "../../recipes";

export type { LibraryFilters, LibraryQueryResult } from "../../recipes";

export function createUseLibraryQuery(_options: CreateRecipeHooksOptions) {
  return useLibraryQuery;
}
