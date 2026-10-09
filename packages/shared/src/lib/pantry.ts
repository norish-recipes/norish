import type { PantryIngredientDto } from "@norish/shared/contracts";
import type { LocaleNames } from "@norish/shared/lib/ingredient-names";
import type { SpellingRules } from "@norish/shared/lib/spelling-keys";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";
import { BASE_SPELLING_RULES, foodKey, sameFood } from "@norish/shared/lib/spelling-keys";

/**
 * The Pantry Ingredient that covers a line, or null where the household has
 * none. The one rule for "is this in the pantry", asked by the add-to-groceries
 * panel and by the Pantry panel's own duplicate check alike (ADR-0037): a line
 * the resolver has seen is covered by a Pantry Ingredient of the same
 * Ingredient, whatever either is spelled — "onions" covers "onions, diced" —
 * or of a food it is a kind of: "red onion" covers "onion", never the reverse.
 * A text nothing has resolved yet (typed or edited on this screen, or added
 * to the Pantry offline) is matched on the keys the resolver's first two
 * rungs use (`sameFood`, with the units map and the ingredient words)
 * against the Ingredient's name or its name in a language, so "onions,
 * diced", "salt to taste" and "uien" are covered offline as they will be
 * once synced, and on nothing looser: "salt" never covers "salted butter",
 * because Norish never guesses from words.
 */
export function pantryIngredientFor(
  items: readonly PantryIngredientDto[],
  line: { ingredientId?: string | null; ingredientName?: string | null },
  rules: SpellingRules = BASE_SPELLING_RULES
): PantryIngredientDto | null {
  const key = foodKey(line.ingredientName, rules);

  return (
    items.find((item) =>
      // A Pantry Ingredient added offline has no Ingredient until it syncs,
      // and meanwhile is matched on its name like any unresolved text.
      line.ingredientId && item.ingredientId
        ? item.ingredientId === line.ingredientId || item.ancestorIds.includes(line.ingredientId)
        : key !== "" &&
          [item.name, ...Object.values(item.localeNames ?? {})].some((name) =>
            sameFood(name, line.ingredientName, rules)
          )
    ) ?? null
  );
}

/**
 * The grocery that puts a kept food _on the list_, or null where none does:
 * a grocery of the same Ingredient still to buy, however it got there
 * (typed, added from a recipe, or put there from the Pantry). Asked by the
 * Pantry page, the Ingredient panel and the add-to-groceries panel alike.
 *
 * It deliberately differs from `pantryIngredientFor` (ADR-0036's 2026-10-05
 * amendment): only the same food counts, never a kind of it, because red
 * onions bought for one recipe restock nobody's onions; and a ticked grocery
 * never counts, because ticking it off was the restock. A grocery nothing
 * has resolved yet (added offline, or a moment ago), or a kept food added
 * offline, is matched on its food key against the food's name or its name in
 * a language, the fallback coverage uses, and on nothing looser.
 */
export function groceryOnTheList<
  G extends { name?: string | null; ingredientId?: string | null; isDone: boolean },
>(
  groceries: readonly G[],
  item: Pick<PantryIngredientDto, "ingredientId" | "name"> & { localeNames?: LocaleNames },
  rules: SpellingRules = BASE_SPELLING_RULES
): G | null {
  const names = [item.name, ...Object.values(item.localeNames ?? {})];

  return (
    groceries.find((grocery) => {
      if (grocery.isDone) return false;
      if (grocery.ingredientId && item.ingredientId) {
        return grocery.ingredientId === item.ingredientId;
      }

      return (
        foodKey(grocery.name, rules) !== "" &&
        names.some((name) => sameFood(name, grocery.name, rules))
      );
    }) ?? null
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
