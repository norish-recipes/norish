"use client";

import { createHouseholdContext } from "@norish/shared-react/contexts";

import { useHouseholdQuery, useHouseholdSubscription } from "@/hooks/households";


export type { HouseholdContextValue } from "@norish/shared-react/contexts";

const { HouseholdProvider, useHouseholdContext } = createHouseholdContext({
  useHouseholdQuery,
  useHouseholdSubscription,
});

export { HouseholdProvider, useHouseholdContext };
