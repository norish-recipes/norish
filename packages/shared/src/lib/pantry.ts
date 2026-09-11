import type { PantryIngredientDto } from "../contracts/dto/pantry";
import { normalizeGroceryName } from "./normalized-name";

/**
 * The Pantry Ingredient a name is, or null where the household has none by that
 * name. The one rule for "is this in the pantry", asked by the add-to-groceries
 * panel and by the Pantry panel's own duplicate check alike: an exact match on
 * the folded name (case, diacritics, punctuation and whitespace gone), and
 * nothing looser. "Olive oil" is in the pantry when "olive oil" is; "extra
 * virgin olive oil" is not, because Norish never guesses from words.
 */
export function pantryIngredientFor(
  items: readonly PantryIngredientDto[],
  name: string | null | undefined
): PantryIngredientDto | null {
  const normalized = normalizeGroceryName(name);

  if (!normalized) return null;

  return items.find((item) => item.normalizedName === normalized) ?? null;
}

/** The Pantry as a person reads it: by name, in their own alphabet. */
export function sortPantryIngredients<T extends Pick<PantryIngredientDto, "name">>(
  items: readonly T[]
): T[] {
  return [...items].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}
