"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useSpellingRules } from "@/hooks/config";
import { useQuery } from "@tanstack/react-query";
import { useDebounceValue } from "usehooks-ts";

import { sameFood } from "@norish/shared/lib/spelling-keys";

/** How long a shopper stops typing a name before its Ingredient is asked for. */
const LOOKUP_DEBOUNCE_MS = 400;
/** An Ingredient a name resolves to changes only when the catalogue does. */
const LOOKUP_STALE_MS = 5 * 60 * 1000;

/**
 * The Ingredient a grocery panel's name stands for, which is what a Store's
 * price and aisle for it are keyed by (ADR-0037). A grocery already on the
 * list carries its own, and that is the answer while the name is still the
 * grocery's; a name typed or changed here is asked of the server once the
 * typing stops. Null while unknown — offline, a name Norish has never seen,
 * or still being typed — which reads as "the Store remembers nothing yet".
 */
export function useIngredientFor(
  name: string,
  grocery?: { name: string | null; ingredientId?: string | null } | null
): string | null {
  const trpc = useTRPC();
  const rules = useSpellingRules();
  const own =
    grocery?.ingredientId && sameFood(grocery.name, name, rules) ? grocery.ingredientId : null;
  const [settled] = useDebounceValue(name, LOOKUP_DEBOUNCE_MS);

  const term = settled.trim();
  const { data } = useQuery(
    trpc.ingredients.find.queryOptions(
      { name: term },
      { enabled: own === null && term.length > 0, staleTime: LOOKUP_STALE_MS }
    )
  );

  if (own) return own;

  return settled === name ? (data?.ingredientId ?? null) : null;
}
