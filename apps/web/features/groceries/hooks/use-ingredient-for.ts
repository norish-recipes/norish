"use client";

import { useSpellingRules } from "@norish/shared-react/config";
import { useIngredientsNamed } from "@norish/shared-react/ingredients";
import { sameFood } from "@norish/shared/lib/spelling-keys";

/**
 * The Ingredient a grocery panel's name stands for (ADR-0037): the grocery's own while the name is
 * still its, else the server's answer for the settled name; null while unknown.
 */
export function useIngredientFor(
  name: string,
  settled: string,
  grocery?: { name: string | null; ingredientId?: string | null } | null
): string | null {
  const rules = useSpellingRules();
  const own =
    grocery?.ingredientId && sameFood(grocery.name, name, rules) ? grocery.ingredientId : null;
  const term = settled.trim();
  const named = useIngredientsNamed(own === null && term.length > 0 ? [term] : []);

  if (own) return own;

  return settled === name ? (named.get(term) ?? null) : null;
}
