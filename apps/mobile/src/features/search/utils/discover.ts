import type { HiddenItemVisibility } from "@norish/shared-react/reader";
import type { CanonicalRecipeFilters } from "@norish/shared/contracts/filter-contract";

type Patch = Partial<CanonicalRecipeFilters>;

export type DiscoverSection = "recent" | "categories" | "quickFilters" | "tags";

/** What the sections' choice reads: a count is null while its read is loading. */
export type DiscoverInput = {
  /** The keyboard is up: only Recent and Categories show behind the field. */
  focused: boolean;
  recentCount: number;
  categoryCount: number | null;
  tagCount: number | null;
};

/** The sections to show, in order: a section with no data is left out (a loading one shows its
 * skeleton), Recent only when there is one, Quick filters and Tags only with the keyboard down. */
export function discoverSections({
  focused,
  recentCount,
  categoryCount,
  tagCount,
}: DiscoverInput): DiscoverSection[] {
  const sections: DiscoverSection[] = [];

  if (recentCount > 0) sections.push("recent");
  if (categoryCount === null || categoryCount > 0) sections.push("categories");
  if (focused) return sections;

  sections.push("quickFilters");
  if (tagCount === null || tagCount > 0) sections.push("tags");

  return sections;
}

/** A one-tap filter: the words it reads, the filters it sets, and what Hidden Items must allow. */
export type QuickFilter = {
  key: "favorites" | "underThirty" | "fourAndUp" | "pantry";
  labelId: string;
  icon: "heart-outline" | "time-outline" | "star" | "file-tray-outline";
  isOn: (filters: CanonicalRecipeFilters) => boolean;
  on: Patch;
  off: Patch;
  offered: (visibility: HiddenItemVisibility) => boolean;
};

export const QUICK_FILTERS: readonly QuickFilter[] = [
  {
    key: "favorites",
    labelId: "common.filters.favorites",
    icon: "heart-outline",
    isOn: (filters) => filters.showFavoritesOnly,
    on: { showFavoritesOnly: true },
    off: { showFavoritesOnly: false },
    offered: (visibility) => visibility.showFavorites,
  },
  {
    key: "underThirty",
    labelId: "recipes.search.underThirty",
    icon: "time-outline",
    isOn: (filters) => filters.maxCookingTime === 30,
    on: { maxCookingTime: 30 },
    off: { maxCookingTime: null },
    offered: () => true,
  },
  {
    key: "fourAndUp",
    labelId: "recipes.search.fourAndUp",
    icon: "star",
    isOn: (filters) => filters.minRating === 4,
    on: { minRating: 4 },
    off: { minRating: null },
    offered: (visibility) => visibility.showRatings,
  },
  {
    key: "pantry",
    labelId: "common.filters.pantryOnly",
    icon: "file-tray-outline",
    isOn: (filters) => filters.showPantryOnly,
    on: { showPantryOnly: true },
    off: { showPantryOnly: false },
    offered: () => true,
  },
];

/** The Quick filters the reader's Hidden Items leave on offer. */
export const offeredQuickFilters = (visibility: HiddenItemVisibility) =>
  QUICK_FILTERS.filter((quick) => quick.offered(visibility));

/** A tap on a Quick filter: off sets it, on removes its chip. */
export const toggleQuickFilter = (filters: CanonicalRecipeFilters, quick: QuickFilter): Patch =>
  quick.isOn(filters) ? quick.off : quick.on;

const has = (list: readonly string[], name: string) =>
  list.some((item) => item.toLowerCase() === name.toLowerCase());

export const isCategoryOn = (filters: CanonicalRecipeFilters, name: string) =>
  has(filters.categories, name);

export const isTagOn = (filters: CanonicalRecipeFilters, name: string) =>
  has(filters.searchTags, name);

/** A tap on a Category: applied removes its chip (any case), else it is added. */
export const toggleCategory = (filters: CanonicalRecipeFilters, name: string): Patch => ({
  categories: isCategoryOn(filters, name)
    ? filters.categories.filter((item) => item.toLowerCase() !== name.toLowerCase())
    : [...filters.categories, name],
});

/** A tap on a Tag, likewise. */
export const toggleTag = (filters: CanonicalRecipeFilters, name: string): Patch => ({
  searchTags: isTagOn(filters, name)
    ? filters.searchTags.filter((item) => item.toLowerCase() !== name.toLowerCase())
    : [...filters.searchTags, name],
});
