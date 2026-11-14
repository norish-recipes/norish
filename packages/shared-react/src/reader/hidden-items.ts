/** What a reader can hide. An administrator can turn `timers` off for everyone, hiding the choice;
 * the stored name survives, so turning timers back on restores the reader's choice. */
export const HIDDEN_ITEMS = [
  "provenance",
  "nutrition",
  "notes",
  "rating",
  "favorites",
  "conversion",
  "timers",
  "cookbooks",
  "ingredientIcons",
] as const;

type HiddenItem = (typeof HIDDEN_ITEMS)[number];

/** `selected` is what a control ticks, in contract order; `carried` is a stored name it can't offer
 * (newer or gated off), written back as `[...chosen, ...carried]` so it is never dropped. */
export function partitionHiddenItems(
  stored: readonly string[],
  offered: readonly HiddenItem[] = HIDDEN_ITEMS
): { selected: HiddenItem[]; carried: string[] } {
  const offeredNames = new Set<string>(offered);

  return {
    selected: offered.filter((item) => stored.includes(item)),
    carried: stored.filter((item) => !offeredNames.has(item)),
  };
}

export type HiddenItemVisibility = {
  showRatings: boolean;
  showFavorites: boolean;
  showConversion: boolean;
  showProvenance: boolean;
  showNutrition: boolean;
  showNotes: boolean;
  showCookbooks: boolean;
  showIngredientIcons: boolean;
};

/** A stored hidden list as visibility flags; the browser and the server's seeds read the same. */
export function hiddenItemVisibility(hidden: readonly string[]): HiddenItemVisibility {
  const shows = (item: HiddenItem) => !hidden.includes(item);

  return {
    showRatings: shows("rating"),
    showFavorites: shows("favorites"),
    showConversion: shows("conversion"),
    showProvenance: shows("provenance"),
    showNutrition: shows("nutrition"),
    showNotes: shows("notes"),
    // The recipe page's cookbooks card only. Hiding it never touches the
    // Library or its type chips.
    showCookbooks: shows("cookbooks"),
    showIngredientIcons: shows("ingredientIcons"),
  };
}
