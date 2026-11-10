import { createContext, use, useMemo } from "react";

import type {
  HouseholdAdminSettingsDto,
  HouseholdSettingsDto,
} from "@norish/shared/contracts/dto/household";

import type { HouseholdMutationsResult } from "../../reader";

/** The household as the settings page reads it. */
export type HouseholdContextValue = {
  household: HouseholdSettingsDto | HouseholdAdminSettingsDto | null;
  currentUserId: string | undefined;
  isLoading: boolean;
};

export type HouseholdSettingsContextValue = HouseholdContextValue & {
  createHousehold: (name: string) => void;
  joinHousehold: (code: string) => void;
  leaveHousehold: (householdId: string) => void;
  kickUser: (householdId: string, userId: string) => void;
  regenerateJoinCode: (householdId: string) => void;
  transferAdmin: (householdId: string, newAdminId: string) => void;
};

type CreateHouseholdSettingsContextOptions = {
  useHouseholdContext: () => HouseholdContextValue;
  useHouseholdMutations: () => HouseholdMutationsResult;
};

export function createHouseholdSettingsContext({
  useHouseholdContext,
  useHouseholdMutations,
}: CreateHouseholdSettingsContextOptions) {
  const HouseholdSettingsContext = createContext<HouseholdSettingsContextValue | null>(null);

  function HouseholdSettingsProvider({ children }: { children: React.ReactNode }) {
    "use memo";

    const { household, currentUserId, isLoading } = useHouseholdContext();
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
