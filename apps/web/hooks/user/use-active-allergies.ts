"use client";

import { useMemo } from "react";

import { useUserSettingsQuery } from "./use-user-query";

import { useHouseholdContext } from "@/context/household-context";

/**
 * Returns the active allergies for the current user.
 * If the user is in a household with allergies configured, returns household allergies.
 * Otherwise, returns the user's personal allergies.
 *
 * Also returns a pre-computed Set for efficient O(1) lookups.
 */
export function useActiveAllergies() {
  const { household } = useHouseholdContext();
  const { allergies: userAllergies } = useUserSettingsQuery();

  const allergies = useMemo(() => {
    if (household?.allergies && household.allergies.length > 0) {
      return household.allergies;
    }

    return userAllergies ?? [];
  }, [household?.allergies, userAllergies]);

  // Pre-computed Set for O(1) lookups (case-insensitive)
  const allergySet = useMemo(() => new Set(allergies.map((a) => a.toLowerCase())), [allergies]);

  return { allergies, allergySet };
}

export type UseActiveAllergiesResult = ReturnType<typeof useActiveAllergies>;
