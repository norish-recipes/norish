import { createContext, use, useMemo } from "react";

import type { HouseholdMutationsResult, HouseholdResult } from "../../reader";

export type HouseholdSettingsContextValue = Pick<
  HouseholdResult,
  "household" | "currentUserId" | "isLoading"
> &
  HouseholdMutationsResult;

type CreateHouseholdSettingsContextOptions = {
  useHousehold: () => HouseholdResult;
  useHouseholdMutations: () => HouseholdMutationsResult;
};

export function createHouseholdSettingsContext({
  useHousehold,
  useHouseholdMutations,
}: CreateHouseholdSettingsContextOptions) {
  const HouseholdSettingsContext = createContext<HouseholdSettingsContextValue | null>(null);

  function HouseholdSettingsProvider({ children }: { children: React.ReactNode }) {
    "use memo";

    const { household, currentUserId, isLoading } = useHousehold();
    const {
      createHousehold,
      joinHousehold,
      leaveHousehold,
      kickUser,
      regenerateJoinCode,
      transferAdmin,
    } = useHouseholdMutations();

    const value = useMemo<HouseholdSettingsContextValue>(
      () => ({
        household,
        currentUserId,
        isLoading,
        createHousehold,
        joinHousehold,
        leaveHousehold,
        kickUser,
        regenerateJoinCode,
        transferAdmin,
      }),
      [
        household,
        currentUserId,
        isLoading,
        createHousehold,
        joinHousehold,
        leaveHousehold,
        kickUser,
        regenerateJoinCode,
        transferAdmin,
      ]
    );

    return <HouseholdSettingsContext value={value}>{children}</HouseholdSettingsContext>;
  }

  function useHouseholdSettingsContext(): HouseholdSettingsContextValue {
    "use memo";

    const context = use(HouseholdSettingsContext);

    if (!context) {
      throw new Error("useHouseholdSettingsContext must be used within HouseholdSettingsProvider");
    }

    return context;
  }

  return {
    HouseholdSettingsProvider,
    useHouseholdSettingsContext,
  };
}
