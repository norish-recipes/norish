import type { Edge } from "@/lib/card-edges";
import { edgeAt } from "@/lib/card-edges";

import type { PickedFood } from "@norish/shared-react/groceries";
import type { IngredientItem } from "@norish/shared-react/ingredients";
import type { PantrySuggestionDto } from "@norish/shared/contracts";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";
import { shownSuggestions } from "@norish/shared/lib/pantry";

/** A catalogue food a search found, or a suggested one with how many recipes use it. */
export type Match = Pick<IngredientItem, "id" | "name" | "localeNames"> & { recipeCount?: number };

/** A row of the Add to pantry sheet, a found food or the text as typed: what it shows and keeps. */
export type PantryAddRow = {
  key: string;
  foodId: string | null;
  name: string;
  keeps: string | PickedFood;
  /** How many of the household's recipes use a suggested food; null for any other row. */
  recipeCount: number | null;
  /** The row's own and its + button's. */
  testIDs: { row: string; button: string };
  edge: Edge;
};

/** A found food as the Pantry keeps it. */
export const pickedFood = (food: Match): PickedFood => ({
  ingredientId: food.id,
  name: food.name,
  localeNames: food.localeNames,
});

/** The sheet's rows: the catalogue foods found, then `custom`, the text as typed, when offered. */
export function pantryAddRows(
  matches: readonly Match[],
  custom: string | null,
  locale: string
): PantryAddRow[] {
  const count = matches.length + (custom === null ? 0 : 1);
  const rows: PantryAddRow[] = matches.map((food, index) => ({
    key: `match:${food.id}`,
    foodId: food.id,
    name: ingredientDisplayName(food, locale),
    keeps: pickedFood(food),
    recipeCount: food.recipeCount ?? null,
    testIDs: { row: `pantry-match-row-${food.id}`, button: `pantry-match-${food.id}` },
    edge: edgeAt(index, count),
  }));

  if (custom !== null) {
    rows.push({
      key: "custom",
      foodId: null,
      name: custom,
      keeps: custom,
      recipeCount: null,
      testIDs: { row: "pantry-add-custom-row", button: "pantry-add-custom" },
      edge: edgeAt(matches.length, count),
    });
  }

  return rows;
}

/** What the sheet lists and what it typed and opened. */
type PantryAddInput = {
  typed: string;
  /** Whether the Pantry is read: until then nothing is suggested, as the field takes nothing. */
  isRead: boolean;
  /** The suggested foods the Pantry does not cover. */
  offered: readonly PantrySuggestionDto[];
  showAll: boolean;
  matches: readonly Match[];
  custom: string | null;
};

/** The sheet's list: with the field empty and the Pantry read, "From your recipes" (the header
 * shows and Show more while some are hidden); otherwise, or with none offered, the matches. */
export function pantryAddList(
  { typed, isRead, offered, showAll, matches, custom }: PantryAddInput,
  locale: string
): { rows: PantryAddRow[]; fromYourRecipes: boolean; more: boolean } {
  if (typed !== "" || !isRead || offered.length === 0) {
    return { rows: pantryAddRows(matches, custom, locale), fromYourRecipes: false, more: false };
  }

  const { shown, more } = shownSuggestions(offered, showAll);
  const suggested = shown.map((food) => ({
    id: food.ingredientId,
    name: food.name,
    localeNames: food.localeNames,
    recipeCount: food.recipeCount,
  }));

  return { rows: pantryAddRows(suggested, null, locale), fromYourRecipes: true, more };
}
