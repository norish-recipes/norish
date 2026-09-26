import type { PantryIngredientDto } from "@norish/shared/contracts";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";

/**
 * The Pantry Ingredient that covers a line, or null where the household has
 * none. The one rule for "is this in the pantry", asked by the add-to-groceries
 * panel and by the Pantry panel's own duplicate check alike (ADR-0037): a line
 * the resolver has seen is covered by a Pantry Ingredient of the same
 * Ingredient, whatever either is spelled — "onions" covers "onions, diced".
 * A text nothing has resolved yet (typed or edited on this screen) can only
 * be matched on its folded name, and nothing looser: "salt" never covers
 * "salted butter", because Norish never guesses from words.
 */
export function pantryIngredientFor(
  items: readonly PantryIngredientDto[],
  line: { ingredientId?: string | null; ingredientName?: string | null }
): PantryIngredientDto | null {
  if (line.ingredientId) {
    return items.find((item) => item.ingredientId === line.ingredientId) ?? null;
  }

  const normalized = normalizeGroceryName(line.ingredientName);

  if (!normalized) return null;

  return items.find((item) => item.normalizedName === normalized) ?? null;
}

/**
 * The Pantry as a person reads it: by name, in their own alphabet. The locale
 * is the reader's, not the runtime's — "ö" files with "o" in German and after
 * "z" in Swedish, and a server and a browser must not disagree about it.
 */
export function sortPantryIngredients<T extends Pick<PantryIngredientDto, "name">>(
  items: readonly T[],
  locale: string
): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: "base" }));
}
