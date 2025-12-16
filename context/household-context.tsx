"use client";

import type { HouseholdSettingsDto, HouseholdAdminSettingsDto } from "@/types/dto/household";

import { createContext, useContext, ReactNode } from "react";

import { useHouseholdQuery, useHouseholdSubscription } from "@/hooks/households";

type HouseholdContextType = {
  household: HouseholdSettingsDto | HouseholdAdminSettingsDto | null;
  currentUserId: string | undefined;
  isLoading: boolean;
};

const HouseholdContext = createContext<HouseholdContextType | null>(null);

// This provider is needed for updates when allergies change etc..
export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { household, currentUserId, isLoading } = useHouseholdQuery();

  useHouseholdSubscription();

  return (
    <HouseholdContext.Provider
      value={{
        household,
        currentUserId,
        isLoading,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHouseholdContext() {
  const context = useContext(HouseholdContext);

  if (!context) {
    throw new Error("useHouseholdContext must be used within HouseholdProvider");
  }

  return context;
}
