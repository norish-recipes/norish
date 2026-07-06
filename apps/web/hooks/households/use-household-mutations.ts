"use client";

import { useTRPC } from "@/app/providers/trpc-provider";

import {
  createUseHouseholdMutations,
  createUseHouseholdQuery,
} from "@norish/shared-react/hooks/households";

import { useCurrentHouseholdUserName } from "./adapters";

const useHouseholdQuery = createUseHouseholdQuery({ useTRPC });
const useSharedHouseholdMutations = createUseHouseholdMutations({
  useTRPC,
  useHouseholdQuery,
  useCurrentUserName: useCurrentHouseholdUserName,
});

export const useHouseholdMutations = useSharedHouseholdMutations;

export type { HouseholdMutationsResult } from "@norish/shared-react/hooks";
