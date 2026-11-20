import type { HiddenItemVisibility } from "@norish/shared-react/reader";
import type { CanonicalRecipeFilters } from "@norish/shared/contracts/filter-contract";

type Patch = Partial<CanonicalRecipeFilters>;

export type DiscoverSection = "recent" | "categories" | "quickFilters" | "tags";

/** A section's read: how many it loaded (cached data counts), or that it is loading or failed. */
export type SectionRead = number | "loading" | "failed";

/** What the sections' choice reads. */
export type DiscoverInput = {
  /** The keyboard is up: only Recent and Categories show behind the field. */
  focused: boolean;
  recentCount: number;
  categories: SectionRead;
  tags: SectionRead;
};

// A loading section shows its skeleton; a failed or empty one is left out.
const shows = (read: SectionRead) => read === "loading" || (typeof read === "number" && read > 0);

/** The sections to show, in order: Recent only when there is one, Quick filters and Tags only
 * with the keyboard down. */
export function discoverSections({
  focused,
  recentCount,
  categories,
  tags,
}: DiscoverInput): DiscoverSection[] {
  const sections: DiscoverSection[] = [];

  if (recentCount > 0) sections.push("recent");
  if (shows(categories)) sections.push("categories");
  if (focused) return sections;

  sections.push("quickFilters");
  if (shows(tags)) sections.push("tags");

  return sections;
}

/** A one-tap filter: the words it reads, the filters it sets, and what Hidden Items must allow. */
export type QuickFilter = {
  key: "favorites" | "underThirty" | "fourAndUp" | "pantry";
  labelId: string;
  icon: "heart-outline" | "time-outline" | "star" | "file-tray-outline";
  on: Patch;
  offered: (visibility: HiddenItemVisibility) => boolean;
};

export const QUICK_FILTERS: readonly QuickFilter[] = [
  {
    key: "favorites",
    labelId: "common.filters.favorites",
    icon: "heart-outline",
    on: { showFavoritesOnly: true },
    offered: (visibility) => visibility.showFavorites,
  },
  {
    key: "underThirty",
    labelId: "recipes.search.underThirty",
    icon: "time-outline",
    on: { maxCookingTime: 30 },
    offered: () => true,
  },
  {
    key: "fourAndUp",
    labelId: "recipes.search.fourAndUp",
    icon: "star",
    on: { minRating: 4 },
    offered: (visibility) => visibility.showRatings,
  },
  {
    key: "pantry",
    labelId: "common.filters.pantryOnly",
    icon: "file-tray-outline",
    on: { showPantryOnly: true },
    offered: () => true,
  },
];

/** The Quick filters the reader's Hidden Items leave on offer. */
export const offeredQuickFilters = (visibility: HiddenItemVisibility) =>
  QUICK_FILTERS.filter((quick) => quick.offered(visibility));
