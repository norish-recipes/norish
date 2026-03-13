import { useMemo } from 'react';

import { useUserAllergiesQuery } from './use-user-allergies-query';

/**
 * Returns the active allergies for the current user.
 * Returns a pre-computed Set for efficient O(1) lookups.
 *
 * Note: When household context is added to mobile, this hook should
 * prefer household allergies over personal allergies (matching the web).
 */
export function useActiveAllergies() {
  const { allergies: userAllergies } = useUserAllergiesQuery();

  const allergies = useMemo(() => userAllergies ?? [], [userAllergies]);

  // Pre-computed Set for O(1) lookups (case-insensitive)
  const allergySet = useMemo(
    () => new Set(allergies.map((a) => a.toLowerCase())),
    [allergies],
  );

  return { allergies, allergySet };
}

export type UseActiveAllergiesResult = ReturnType<typeof useActiveAllergies>;
