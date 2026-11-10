"use client";

import { createHouseholdSettingsContext } from "@norish/shared-react/contexts";
import { useHousehold, useHouseholdMutations } from "@norish/shared-react/reader";

export type { HouseholdSettingsContextValue } from "@norish/shared-react/contexts";

const { HouseholdSettingsProvider, useHouseholdSettingsContext } = createHouseholdSettingsContext({
  useHouseholdContext: useHousehold,
  useHouseholdMutations,
});

export { HouseholdSettingsProvider, useHouseholdSettingsContext };
