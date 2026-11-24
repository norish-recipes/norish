"use client";

import { useQuery } from "@tanstack/react-query";

import { allergenSet } from "@norish/shared/lib/helpers";

import { useTRPC } from "../trpc";
import { useAllergiesQuery } from "./use-allergies";

type ActiveAllergies = {
  allergies: string[];
  /** Lower-cased, for a case-insensitive lookup. */
  allergySet: Set<string>;
};

/** The allergies the Reader's recipes warn about: the household's, else their own. */
export function useActiveAllergies(): ActiveAllergies {
  const trpc = useTRPC();
  const { data: household } = useQuery({
    ...trpc.households.get.queryOptions(),
    // Null outside a household; inside one, its list stands even emptied.
    select: (data) => data.household?.allergies ?? null,
  });
  const own = useAllergiesQuery().allergies;

  const allergies = household ?? own;
  const allergySet = allergenSet(allergies);

  return { allergies, allergySet };
}
