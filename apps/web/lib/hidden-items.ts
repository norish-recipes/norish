/**
 * The things a reader can choose not to be shown. Names only — what each one
 * suppresses is the reading side's business.
 *
 * `timers` differs from the rest in one way: an administrator can switch recipe
 * timers off for the whole deployment, and when they have, a reader is never
 * offered the choice. The stored name survives that, so turning the capability
 * back on restores whatever the reader had chosen.
 */
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

export type HiddenItem = (typeof HIDDEN_ITEMS)[number];

/**
 * A stored list split into what a control can show and what it must carry.
 *
 * `selected` is what the control ticks, in contract order. `carried` is
 * everything else stored: a name from a newer version this one cannot offer,
 * or one an administrator has gated off. A control writes back
 * `[...chosen, ...carried]`, so it can never drop a choice it was not in a
 * position to show.
 */
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
