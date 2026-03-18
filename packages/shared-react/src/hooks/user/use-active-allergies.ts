import { useMemo } from "react";

type HouseholdContextLike = {
  household: { allergies: string[] } | null;
};

type UserAllergiesQueryLike = {
  allergies: string[];
};

type CreateUseActiveAllergiesOptions = {
  useHouseholdContext: () => HouseholdContextLike;
  useUserAllergiesQuery: () => UserAllergiesQueryLike;
};

export type UseActiveAllergiesResult = {
  allergies: string[];
  allergySet: Set<string>;
};

export function createUseActiveAllergies({
  useHouseholdContext,
  useUserAllergiesQuery,
}: CreateUseActiveAllergiesOptions) {
  return function useActiveAllergies(): UseActiveAllergiesResult {
    const { household } = useHouseholdContext();
    const { allergies: userAllergies } = useUserAllergiesQuery();

    const allergies = useMemo(() => {
      if (household?.allergies && household.allergies.length > 0) {
        return household.allergies;
      }

      return userAllergies ?? [];
    }, [household?.allergies, userAllergies]);

    // Pre-computed Set for O(1) lookups (case-insensitive)
    const allergySet = useMemo(() => new Set(allergies.map((a) => a.toLowerCase())), [allergies]);

    return { allergies, allergySet };
  };
}
