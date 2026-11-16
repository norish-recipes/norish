import type { Edge } from "@/components/card-edges";
import { edgeAt } from "@/components/card-edges";

import type { PickedFood } from "@norish/shared-react/groceries";
import type { IngredientItem } from "@norish/shared-react/ingredients";
import type { SpellingRules } from "@norish/shared/lib/spelling-keys";
import { foodNamedAsTyped } from "@norish/shared-react/ingredients";

/** A catalogue food a search found. */
export type Match = Pick<IngredientItem, "id" | "name" | "localeNames">;

/** A row of the Add to pantry sheet: a catalogue food, or the text as typed. */
export type PantryAddRow =
  | { key: string; foodId: string; type: "match"; food: Match; edge: Edge }
  | { key: "custom"; foodId: null; type: "custom"; name: string; edge: Edge };

/** A found food as the Pantry keeps it. */
export const pickedFood = (food: Match): PickedFood => ({
  ingredientId: food.id,
  name: food.name,
  localeNames: food.localeNames,
});

/** What Return keeps for `typed`: the found food named so, else the text itself while it can be
 * added; null for neither. */
export function pantryAddSubmit(
  typed: string,
  matches: readonly Match[],
  canAdd: boolean,
  locale: string,
  rules: SpellingRules
): string | PickedFood | null {
  const named = foodNamedAsTyped(typed, matches, locale, rules);

  return named ? pickedFood(named) : canAdd ? typed : null;
}

/** The sheet's rows for `typed`: the catalogue foods it finds, then the text itself as a custom
 * entry while that is not already kept (`canAdd`) and no found food is named so. */
export function pantryAddRows(
  typed: string,
  matches: readonly Match[],
  canAdd: boolean,
  locale: string,
  rules: SpellingRules
): PantryAddRow[] {
  const custom = canAdd && !foodNamedAsTyped(typed, matches, locale, rules);
  const count = matches.length + (custom ? 1 : 0);
  const rows: PantryAddRow[] = matches.map((food, index) => ({
    key: `match:${food.id}`,
    foodId: food.id,
    type: "match",
    food,
    edge: edgeAt(index, count),
  }));

  if (custom) {
    rows.push({
      key: "custom",
      foodId: null,
      type: "custom",
      name: typed,
      edge: edgeAt(matches.length, count),
    });
  }

  return rows;
}
