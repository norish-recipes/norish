"use client";

import { useQuery } from "@tanstack/react-query";

import { sameFood } from "@norish/shared/lib/spelling-keys";

import { useSpellingRules } from "../config";
import { useTRPC } from "../trpc";

/** An Ingredient a name resolves to changes only when the catalogue does. */
const LOOKUP_STALE_MS = 5 * 60 * 1000;

/**
 * The Ingredient a grocery panel's name stands for (ADR-0037): the grocery's own while the name is
 * still its, else the server's answer for the settled name; null while unknown.
 */
export function useIngredientFor(
  name: string,
  settled: string,
  grocery?: { name: string | null; ingredientId?: string | null } | null
): string | null {
  const trpc = useTRPC();
  const rules = useSpellingRules();
  const own =
    grocery?.ingredientId && sameFood(grocery.name, name, rules) ? grocery.ingredientId : null;
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
