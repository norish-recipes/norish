"use client";

import {
  createUseHouseholdMutations,
  createUseHouseholdQuery,
} from "@norish/shared-react/hooks/households";
import { useTRPC } from "@norish/shared-react/trpc";

import { useCurrentHouseholdUserName } from "./adapters";

const useHouseholdQuery = createUseHouseholdQuery({ useTRPC });
const useSharedHouseholdMutations = createUseHouseholdMutations({
  useTRPC,
  useHouseholdQuery,
  useCurrentUserName: useCurrentHouseholdUserName,
});

export const useHouseholdMutations = useSharedHouseholdMutations;

export type { HouseholdMutationsResult } from "@norish/shared-react/hooks";
