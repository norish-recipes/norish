import { createContext, useContext, useMemo } from "react";

import type {
  HouseholdAdminSettingsDto,
  HouseholdSettingsDto,
} from "@norish/shared/contracts/dto/household";

import type { HouseholdMutationsResult, HouseholdQueryResult } from "../../hooks/households/types";

export type HouseholdContextValue = {
  household: HouseholdSettingsDto | HouseholdAdminSettingsDto | null;
  currentUserId: string | undefined;
  isLoading: boolean;
};

type CreateHouseholdContextOptions = {
  useHouseholdQuery: () => Pick<HouseholdQueryResult, "household" | "currentUserId" | "isLoading">;
  useHouseholdSubscription: () => void;
};

export function createHouseholdContext({
  useHouseholdQuery,
  useHouseholdSubscription,
}: CreateHouseholdContextOptions) {
  const HouseholdContext = createContext<HouseholdContextValue | null>(null);

  function HouseholdProvider({ children }: { children: React.ReactNode }) {
    const { household, currentUserId, isLoading } = useHouseholdQuery();

    // Subscribe to WebSocket events
    useHouseholdSubscription();

    const value = useMemo(
      () => ({ household, currentUserId, isLoading }),
      [household, currentUserId, isLoading]
    );

    return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
  }

  function useHouseholdContext(): HouseholdContextValue {
    const context = useContext(HouseholdContext);

    if (!context) {
      throw new Error("useHouseholdContext must be used within HouseholdProvider");
    }

    return context;
  }

  return {
    HouseholdProvider,
    useHouseholdContext,
  };
}

// --- Household Settings Context ---

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

    return (
      <HouseholdSettingsContext.Provider value={value}>
        {children}
      </HouseholdSettingsContext.Provider>
    );
  }

  function useHouseholdSettingsContext(): HouseholdSettingsContextValue {
    const context = useContext(HouseholdSettingsContext);

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
