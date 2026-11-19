import type { CanonicalRecipeFilters } from "@norish/shared/contracts/filter-contract";

/** One applied filter, as the chip that removes it names it. */
export type FilterChip =
  | { kind: "category"; value: string }
  | { kind: "tag"; value: string }
  | { kind: "time"; value: number }
  | { kind: "rating"; value: number }
  | { kind: "favorites" }
  | { kind: "pantry" };

/** The applied filters in the order the chips show: the same set `hasSearchFilters` counts. */
export function filterChips(filters: CanonicalRecipeFilters): FilterChip[] {
  return [
    ...filters.categories.map((value) => ({ kind: "category", value }) as const),
    ...filters.searchTags.map((value) => ({ kind: "tag", value }) as const),
    ...(filters.maxCookingTime === null
      ? []
      : [{ kind: "time", value: filters.maxCookingTime } as const]),
    ...(filters.minRating === null ? [] : [{ kind: "rating", value: filters.minRating } as const]),
    ...(filters.showFavoritesOnly ? [{ kind: "favorites" } as const] : []),
    ...(filters.showPantryOnly ? [{ kind: "pantry" } as const] : []),
  ];
}

/** `filters` less `chip`, as the patch to apply. */
export function withoutChip(
  filters: CanonicalRecipeFilters,
  chip: FilterChip
): Partial<CanonicalRecipeFilters> {
  switch (chip.kind) {
    case "category":
      return { categories: filters.categories.filter((item) => item !== chip.value) };
    case "tag":
      return { searchTags: filters.searchTags.filter((item) => item !== chip.value) };
    case "time":
      return { maxCookingTime: null };
    case "rating":
      return { minRating: null };
    case "favorites":
      return { showFavoritesOnly: false };
    case "pantry":
      return { showPantryOnly: false };
  }
}

/** A key for a chip that is stable while the others come and go. */
export const chipKey = (chip: FilterChip) => `${chip.kind}:${"value" in chip ? chip.value : ""}`;
