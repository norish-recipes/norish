import type { PantryIngredientDto } from "@norish/shared/contracts";

import type { PantryData } from "./types";

/**
 * The one merge of an added item into what a screen holds: it joins the list
 * unless an item with its id is already there. Applying it twice changes
 * nothing, which is what lets the actor's own echo, a replay and a
 * housemate's screen all run it alike.
 */
export function mergePantryAdded(prev: PantryData, item: PantryIngredientDto): PantryData {
  return prev.some((held) => held.id === item.id) ? prev : [...prev, item];
}

/** The one merge of a removal: the item with that id is gone, and gone stays gone. */
export function mergePantryRemoved(prev: PantryData, itemId: string): PantryData {
  const without = prev.filter((held) => held.id !== itemId);

  return without.length === prev.length ? prev : without;
}
