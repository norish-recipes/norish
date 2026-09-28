import type { PantryIngredientDto } from "@norish/shared/contracts";
import type { LocaleNames } from "@norish/shared/lib/ingredient-names";
import { foldName } from "@norish/shared/lib/fold-name";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

/**
 * The Pantry Ingredient that covers a line, or null where the household has
 * none. The one rule for "is this in the pantry", asked by the add-to-groceries
 * panel and by the Pantry panel's own duplicate check alike (ADR-0037): a line
 * the resolver has seen is covered by a Pantry Ingredient of the same
 * Ingredient, whatever either is spelled — "onions" covers "onions, diced" —
 * or of a food it is a kind of: "red onion" covers "onion", never the reverse.
 * A text nothing has resolved yet (typed or edited on this screen, or added
 * to the Pantry offline) can only be matched on its folded name — the
 * Ingredient's own or its name in a language — and nothing looser: "salt" never covers
 * "salted butter", because Norish never guesses from words.
 */
export function pantryIngredientFor(
  items: readonly PantryIngredientDto[],
  line: { ingredientId?: string | null; ingredientName?: string | null }
): PantryIngredientDto | null {
  const normalized = foldName(line.ingredientName);

  return (
    items.find((item) =>
      // A Pantry Ingredient added offline has no Ingredient until it syncs,
      // and meanwhile is matched on its name like any unresolved text.
      line.ingredientId && item.ingredientId
        ? item.ingredientId === line.ingredientId || item.ancestorIds.includes(line.ingredientId)
        : normalized !== "" &&
          [item.name, ...Object.values(item.localeNames ?? {})].some(
            (name) => foldName(name) === normalized
          )
    ) ?? null
  );
}

/**
 * The Pantry as a person reads it: by the name they see, in their own
 * language and alphabet. The locale is the reader's, not the runtime's — "ö"
 * files with "o" in German and after "z" in Swedish, and a server and a
 * browser must not disagree about it.
 */
export function sortPantryIngredients<
  T extends Pick<PantryIngredientDto, "name"> & { localeNames?: LocaleNames },
>(items: readonly T[], locale: string): T[] {
  return [...items].sort((a, b) =>
    ingredientDisplayName(a, locale).localeCompare(ingredientDisplayName(b, locale), locale, {
      sensitivity: "base",
    })
  );
}
