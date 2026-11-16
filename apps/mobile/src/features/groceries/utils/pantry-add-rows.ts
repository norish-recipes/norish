import type { Edge } from "@/components/card-edges";
import { edgeAt } from "@/components/card-edges";

/** A catalogue food a search found. */
export type Match = { id: string; name: string; localeNames?: Record<string, string> };

/** A row of the Add to pantry sheet: a catalogue food, or the text as typed. */
export type PantryAddRow =
  | { key: string; foodId: string; type: "match"; food: Match; edge: Edge }
  | { key: "custom"; foodId: null; type: "custom"; name: string; edge: Edge };

/** The sheet's rows for `typed`: the catalogue foods it finds, then the text itself as a custom
 * entry while that is not already kept (`canAdd`) and no found food is named so. */
export function pantryAddRows(
  typed: string,
  matches: readonly Match[],
  canAdd: boolean
): PantryAddRow[] {
  const custom = canAdd && !matches.some((food) => food.name.toLowerCase() === typed.toLowerCase());
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
