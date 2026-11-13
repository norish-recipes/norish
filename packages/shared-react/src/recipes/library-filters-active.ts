import type { CanonicalRecipeFilters } from "@norish/shared/contracts/filter-contract";
import { hasAppliedRecipeFilters } from "@norish/shared/contracts/filter-contract";

/** Whether the Filters button shows its dot: anything applied, or a minimum rating. */
export function hasActiveLibraryFilters(filters: CanonicalRecipeFilters): boolean {
  return hasAppliedRecipeFilters(filters) || filters.minRating !== null;
}
