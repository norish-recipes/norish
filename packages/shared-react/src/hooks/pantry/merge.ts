import type { PantryIngredientDto } from "@norish/shared/contracts";

import type { PantryData } from "./types";

/**
 * The one merge of an added item into what a screen holds: it joins the list,
 * or replaces the item already there under its id. Applying it twice changes
 * nothing, which is what lets the actor's own echo, a replay and a
 * housemate's screen all run it alike — and because the announced row wins,
 * the actor's echo is also what fills in the member and the Ingredient Name
 * that a tentative row could not know.
 */
export function mergePantryAdded(prev: PantryData, item: PantryIngredientDto): PantryData {
  const held = prev.find((other) => other.id === item.id);

  if (!held) return [...prev, item];
  if (isSameItem(held, item)) return prev;

  return prev.map((other) => (other.id === item.id ? item : other));
}

/** Two readings of one Pantry Ingredient, field by field: a row is never edited. */
function isSameItem(a: PantryIngredientDto, b: PantryIngredientDto): boolean {
  return (
    a.userId === b.userId &&
    a.ingredientId === b.ingredientId &&
    a.name === b.name &&
    a.normalizedName === b.normalizedName &&
    a.version === b.version
  );
}

/** The one merge of a removal: the item with that id is gone, and gone stays gone. */
export function mergePantryRemoved(prev: PantryData, itemId: string): PantryData {
  const without = prev.filter((held) => held.id !== itemId);

  return without.length === prev.length ? prev : without;
}
