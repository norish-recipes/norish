import type { Edge } from "@/components/card-edges";
import { edgeAt } from "@/components/card-edges";

/** A catalogue food a search found. */
export type Match = { id: string; name: string; localeNames?: Record<string, string> };

/** A row of the Add to pantry sheet: a catalogue food, or the text as typed. */
export type PantryAddRow =
  | { key: string; foodId: string; type: "match"; food: Match; edge: Edge }
  | { key: "custom"; foodId: null; type: "custom"; name: string; edge: Edge };

/** The sheet's rows for `typed`: the catalogue foods it finds, then the text itself as a custom
 * entry while that is not already kept (`canAdd`). */
export function pantryAddRows(
  typed: string,
  matches: readonly Match[],
  canAdd: boolean
): PantryAddRow[] {
  const count = matches.length + (canAdd ? 1 : 0);
  const rows: PantryAddRow[] = matches.map((food, index) => ({
    key: `match:${food.id}`,
    foodId: food.id,
    type: "match",
    food,
    edge: edgeAt(index, count),
  }));

  if (canAdd) {
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
