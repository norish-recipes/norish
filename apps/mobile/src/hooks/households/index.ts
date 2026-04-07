import { sharedHouseholdHooks } from "./shared-household-hooks";

export const useHouseholdQuery = sharedHouseholdHooks.useHouseholdQuery;
export type { HouseholdData, HouseholdQueryResult } from "@norish/shared-react/hooks";

export const useHouseholdMutations = sharedHouseholdHooks.useHouseholdMutations;
export type { HouseholdMutationsResult } from "@norish/shared-react/hooks";

export const useHouseholdSubscription = sharedHouseholdHooks.useHouseholdSubscription;

export const useHouseholdCacheHelpers = sharedHouseholdHooks.useHouseholdCacheHelpers;
export type { HouseholdCacheHelpers } from "@norish/shared-react/hooks";
