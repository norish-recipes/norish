"use client";

import { useTRPC } from "@/app/providers/trpc-provider";

import {
  createUseHouseholdCache,
  createUseHouseholdQuery,
  createUseHouseholdSubscription,
} from "@norish/shared-react/hooks/households";

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
