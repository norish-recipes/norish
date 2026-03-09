"use client";

import { useHouseholdContext } from "@/context/household-context";
import { useHouseholdMutations } from "@/hooks/households";

import { createHouseholdSettingsContext } from "@norish/shared-react/contexts";

export type { HouseholdSettingsContextValue } from "@norish/shared-react/contexts";

const { HouseholdSettingsProvider, useHouseholdSettingsContext } = createHouseholdSettingsContext({
  useHouseholdContext,
  useHouseholdMutations,
});

export { HouseholdSettingsProvider, useHouseholdSettingsContext };
