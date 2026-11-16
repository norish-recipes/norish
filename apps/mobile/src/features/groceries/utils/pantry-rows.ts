import type { Edge } from "@/components/card-edges";
import { edgeAt } from "@/components/card-edges";

import type { PantryIngredientDto, PantrySuggestionDto } from "@norish/shared/contracts";
import { SUGGESTIONS_SHOWN } from "@norish/shared/lib/pantry";

/** A row; `foodId` is the Ingredient whose icon it shows, null for rows that name no food. */
export type PantryRow = { key: string; foodId: string | null } & (
  | { type: "kept"; item: PantryIngredientDto; onList: boolean; edge: Edge }
  | { type: "note"; text: "empty" | "noMatch" }
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
  offered: readonly PantrySuggestionDto[];
};

/** What the reader has typed and opened. */
export type PantryView = { typed: string; suggestionsOpen: boolean; showAll: boolean };

/** The Pantry's rows, flat so one virtualised list holds them: the kept foods (or why there are
 * none), and while the field is empty "From your recipes". */
export function pantryRows(
  { items, kept, onTheList, offered }: PantryFoods,
  { typed, suggestionsOpen, showAll }: PantryView
): PantryRow[] {
  const rows: PantryRow[] = [];

  if (items.length === 0) rows.push({ key: "note", foodId: null, type: "note", text: "empty" });
  else if (kept.length === 0)
    rows.push({ key: "note", foodId: null, type: "note", text: "noMatch" });
  else {
    kept.forEach((item, index) =>
      rows.push({
        key: `kept:${item.id}`,
        foodId: item.ingredientId || null,
        type: "kept",
        item,
        onList: onTheList.includes(item.id),
        edge: edgeAt(index, kept.length),
      })
    );
  }

  if (typed === "" && offered.length > 0) {
    rows.push({ key: "suggestions", foodId: null, type: "suggestions", open: suggestionsOpen });
    if (suggestionsOpen) {
      const shown = showAll ? offered : offered.slice(0, SUGGESTIONS_SHOWN);

      shown.forEach((food, index) =>
        rows.push({
          key: `suggestion:${food.ingredientId}`,
          foodId: food.ingredientId,
          type: "suggestion",
          food,
          edge: edgeAt(index, shown.length),
        })
      );
      if (!showAll && offered.length > SUGGESTIONS_SHOWN) {
        rows.push({ key: "more", foodId: null, type: "more" });
      }
    }
  }

  return rows;
}
