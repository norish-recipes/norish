import type { PantryIngredientDto, PantrySuggestionDto } from "@norish/shared/contracts";

/** Which corners of its card a row rounds. */
export type Edge = { top: boolean; bottom: boolean };

/** A catalogue food a search found. */
type Match = { id: string; name: string; localeNames?: Record<string, string> };

export type PantryRow = { key: string } & (
  | { type: "kept"; item: PantryIngredientDto; onList: boolean; edge: Edge }
  | { type: "note"; text: "empty" | "noMatch" }
  | { type: "label"; text: "fromCatalogue" }
  | { type: "match"; food: Match; edge: Edge }
  | { type: "suggestions"; open: boolean }
  | { type: "suggestion"; food: PantrySuggestionDto; edge: Edge }
  | { type: "more" }
);

/** How many suggestions show before Show more. */
export const HANDFUL = 6;

const edges = (index: number, count: number): Edge => ({
  top: index === 0,
  bottom: index === count - 1,
});

/**
 * The Pantry's rows, flat so one virtualised list holds them: the kept foods (or why there are
 * none), the catalogue foods the text finds, and while the field is empty "From your recipes".
 */
export function pantryRows({
  items,
  kept,
  onTheList,
  matches,
  offered,
  typed,
  suggestionsOpen,
  showAll,
}: {
  /** Everything the household keeps. */
  items: readonly PantryIngredientDto[];
  /** What the field narrows it to. */
  kept: readonly PantryIngredientDto[];
  onTheList: readonly string[];
  matches: readonly Match[];
  offered: readonly PantrySuggestionDto[];
  typed: string;
  suggestionsOpen: boolean;
  showAll: boolean;
}): PantryRow[] {
  const rows: PantryRow[] = [];

  if (items.length === 0) rows.push({ key: "note", type: "note", text: "empty" });
  else if (kept.length === 0) rows.push({ key: "note", type: "note", text: "noMatch" });
  else {
    kept.forEach((item, index) =>
      rows.push({
        key: `kept:${item.id}`,
        type: "kept",
        item,
        onList: onTheList.includes(item.id),
        edge: edges(index, kept.length),
      })
    );
  }

  if (matches.length > 0) {
    rows.push({ key: "label", type: "label", text: "fromCatalogue" });
    matches.forEach((food, index) =>
      rows.push({
        key: `match:${food.id}`,
        type: "match",
        food,
        edge: edges(index, matches.length),
      })
    );
  }

  if (typed === "" && offered.length > 0) {
    rows.push({ key: "suggestions", type: "suggestions", open: suggestionsOpen });
    if (suggestionsOpen) {
      const shown = showAll ? offered : offered.slice(0, HANDFUL);

      shown.forEach((food, index) =>
        rows.push({
          key: `suggestion:${food.ingredientId}`,
          type: "suggestion",
          food,
          edge: edges(index, shown.length),
        })
      );
      if (!showAll && offered.length > HANDFUL) rows.push({ key: "more", type: "more" });
    }
  }

  return rows;
}
