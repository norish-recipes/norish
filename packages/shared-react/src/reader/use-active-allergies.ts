"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";
import { useAllergiesQuery } from "./use-allergies";

export type ActiveAllergies = {
  allergies: string[];
  /** Lower-cased, for a case-insensitive lookup. */
  allergySet: Set<string>;
};

/** The allergies the Reader's recipes warn about: the household's, else their own. */
export function useActiveAllergies(): ActiveAllergies {
  const trpc = useTRPC();
  const { data: household } = useQuery({
    ...trpc.households.get.queryOptions(),
    select: (data) => data.household?.allergies,
  });
  const own = useAllergiesQuery();

  const allergies = household && household.length > 0 ? household : own;
  const allergySet = new Set(allergies.map((a) => a.toLowerCase()));

  return { allergies, allergySet };
}
