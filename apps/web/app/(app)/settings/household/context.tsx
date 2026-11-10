"use client";

import { createHouseholdSettingsContext } from "@norish/shared-react/contexts";
import { useHousehold, useHouseholdMutations } from "@norish/shared-react/reader";

const { HouseholdSettingsProvider, useHouseholdSettingsContext } = createHouseholdSettingsContext({
  useHousehold,
  useHouseholdMutations,
});

export { HouseholdSettingsProvider, useHouseholdSettingsContext };
