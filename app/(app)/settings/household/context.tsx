"use client";

import type { HouseholdSettingsDto, HouseholdAdminSettingsDto } from "@/types/dto/household";

import { createContext, useContext, ReactNode } from "react";

import { useHouseholdMutations } from "@/hooks/households";
import { useHouseholdContext } from "@/context/household-context";

type HouseholdSettingsContextType = {
  household: HouseholdSettingsDto | HouseholdAdminSettingsDto | null;
  currentUserId: string | undefined;
  isLoading: boolean;

  // Actions all return void (fire-and-forget)
  createHousehold: (name: string) => void;
  joinHousehold: (code: string) => void;
  leaveHousehold: (householdId: string) => void;
  kickUser: (householdId: string, userId: string) => void;
  regenerateJoinCode: (householdId: string) => void;
  transferAdmin: (householdId: string, newAdminId: string) => void;
};

const HouseholdSettingsContext = createContext<HouseholdSettingsContextType | null>(null);

export function HouseholdSettingsProvider({ children }: { children: ReactNode }) {
  const { household, currentUserId, isLoading } = useHouseholdContext();
  const {
    createHousehold,
    joinHousehold,
    leaveHousehold,
    kickUser,
    regenerateJoinCode,
    transferAdmin,
  } = useHouseholdMutations();

  return (
    <HouseholdSettingsContext.Provider
      value={{
        household,
        currentUserId,
        isLoading,
        createHousehold,
        joinHousehold,
        leaveHousehold,
        kickUser,
        regenerateJoinCode,
        transferAdmin,
      }}
    >
      {children}
    </HouseholdSettingsContext.Provider>
  );
}

export function useHouseholdSettingsContext() {
  const context = useContext(HouseholdSettingsContext);

  if (!context) {
    throw new Error("useHouseholdSettingsContext must be used within HouseholdSettingsProvider");
  }

  return context;
}
