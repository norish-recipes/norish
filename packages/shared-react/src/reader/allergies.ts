import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

export type ActiveAllergies = {
  allergies: string[];
  /** Lower-cased, for a case-insensitive lookup. */
  allergySet: Set<string>;
};

const NONE: string[] = [];

/** The allergies the Reader's recipes warn about: the household's, else their own. */
export function useActiveAllergies(): ActiveAllergies {
  const trpc = useTRPC();
  const { data: household } = useQuery({
    ...trpc.households.get.queryOptions(),
    select: (data) => data.household?.allergies,
  });
  const { data: own } = useQuery({
    ...trpc.user.getAllergies.queryOptions(),
    select: (data) => data.allergies,
  });

  const allergies = household && household.length > 0 ? household : (own ?? NONE);
  const allergySet = useMemo(() => new Set(allergies.map((a) => a.toLowerCase())), [allergies]);

  return { allergies, allergySet };
}
