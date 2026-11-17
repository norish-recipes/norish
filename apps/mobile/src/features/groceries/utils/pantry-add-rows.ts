import type { Edge } from "@/lib/card-edges";
import { edgeAt } from "@/lib/card-edges";

import type { PickedFood } from "@norish/shared-react/groceries";
import type { IngredientItem } from "@norish/shared-react/ingredients";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

/** A catalogue food a search found. */
export type Match = Pick<IngredientItem, "id" | "name" | "localeNames">;

/** A row of the Add to pantry sheet, a found food or the text as typed: what it shows and keeps. */
export type PantryAddRow = {
  key: string;
  foodId: string | null;
  name: string;
  keeps: string | PickedFood;
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
    testIDs: { row: `pantry-match-row-${food.id}`, button: `pantry-match-${food.id}` },
    edge: edgeAt(index, count),
  }));

  if (custom !== null) {
    rows.push({
      key: "custom",
      foodId: null,
      name: custom,
      keeps: custom,
      testIDs: { row: "pantry-add-custom-row", button: "pantry-add-custom" },
      edge: edgeAt(matches.length, count),
    });
  }

  return rows;
}
