import type { PantryIngredientDto, PantrySuggestionDto } from "@norish/shared/contracts";
import { SUGGESTIONS_SHOWN } from "@norish/shared/lib/pantry";

import type { Edge } from "../components/card-edges";
import { edgeAt } from "../components/card-edges";

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

/** The foods the Pantry's lists are made of. */
export type PantryFoods = {
  /** Everything the household keeps. */
  items: readonly PantryIngredientDto[];
  /** What the field narrows it to. */
  kept: readonly PantryIngredientDto[];
  onTheList: readonly string[];
  matches: readonly Match[];
  offered: readonly PantrySuggestionDto[];
};

/** What the reader has typed and opened. */
export type PantryView = { typed: string; suggestionsOpen: boolean; showAll: boolean };

/**
 * The Pantry's rows, flat so one virtualised list holds them: the kept foods (or why there are
 * none), the catalogue foods the text finds, and while the field is empty "From your recipes".
 */
export function pantryRows(
  { items, kept, onTheList, matches, offered }: PantryFoods,
  { typed, suggestionsOpen, showAll }: PantryView
): PantryRow[] {
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
        edge: edgeAt(index, kept.length),
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
        edge: edgeAt(index, matches.length),
      })
    );
  }

  if (typed === "" && offered.length > 0) {
    rows.push({ key: "suggestions", type: "suggestions", open: suggestionsOpen });
    if (suggestionsOpen) {
      const shown = showAll ? offered : offered.slice(0, SUGGESTIONS_SHOWN);

      shown.forEach((food, index) =>
        rows.push({
          key: `suggestion:${food.ingredientId}`,
          type: "suggestion",
          food,
          edge: edgeAt(index, shown.length),
        })
      );
      if (!showAll && offered.length > SUGGESTIONS_SHOWN) {
        rows.push({ key: "more", type: "more" });
      }
    }
  }

  return rows;
}
