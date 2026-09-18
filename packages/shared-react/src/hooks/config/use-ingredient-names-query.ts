import { useQuery } from "@tanstack/react-query";

import type { IngredientSummaryDto } from "@norish/shared/contracts";
import type { IngredientLookup } from "@norish/shared/lib/ingredient-pictures";
import { buildIngredientLookup } from "@norish/shared/lib/ingredient-pictures";

import type { CreateConfigHooksOptions } from "./types";

const EMPTY: IngredientSummaryDto[] = [];

/**
 * One lookup per payload, however many components ask: a grocery list reads
 * it once per row, and each row must not index it again.
 */
const lookups = new WeakMap<readonly IngredientSummaryDto[], IngredientLookup>();

function lookupFor(ingredients: readonly IngredientSummaryDto[]): IngredientLookup {
  let lookup = lookups.get(ingredients);

  if (!lookup) {
    lookup = buildIngredientLookup(ingredients);
    lookups.set(ingredients, lookup);
  }

  return lookup;
}

/**
 * Every Ingredient Name (ADR-0037), and a lookup that answers "which picture
 * does this name show?" by the one grocery folding.
 *
 * Recipes mint names as a side effect, so this list is invalidated wherever a
 * recipe is created, imported, edited or deleted — the realtime handlers in
 * `use-recipes-subscription` — rather than being read on a short leash.
 *
 * The recipe editor suggests from every name, whether or not it has a picture;
 * the grocery list matches names against the pictures. The persisted query
 * cache keeps both working offline.
 */
export function createUseIngredientNamesQuery({ useTRPC }: CreateConfigHooksOptions) {
  return function useIngredientNamesQuery(options: { enabled?: boolean } = {}) {
    const trpc = useTRPC();

    const { data, error, isLoading } = useQuery({
      ...trpc.ingredients.list.queryOptions(),
      enabled: options.enabled ?? true,
    });

    const ingredients = data?.ingredients ?? EMPTY;
    const lookup = lookupFor(ingredients);

    return { ingredients, lookup, error, isLoading };
  };
}
