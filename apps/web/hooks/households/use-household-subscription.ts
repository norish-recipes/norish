"use client";

import {
  createUseHouseholdCache,
  createUseHouseholdQuery,
  createUseHouseholdSubscription,
} from "@norish/shared-react/hooks/households";
import { useTRPC } from "@norish/shared-react/trpc";

import { useHouseholdToastAdapter } from "./adapters";

const useHouseholdCacheHelpers = createUseHouseholdCache({ useTRPC });
const useHouseholdQuery = createUseHouseholdQuery({ useTRPC });
const useSharedHouseholdSubscription = createUseHouseholdSubscription({
  useTRPC,
  useHouseholdCacheHelpers,
  useCurrentUserId: () => useHouseholdQuery().currentUserId,
  useToastAdapter: useHouseholdToastAdapter,
});

export const useHouseholdSubscription = useSharedHouseholdSubscription;
