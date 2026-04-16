"use client";

import { useTRPC } from "@/app/providers/trpc-provider";

import {
  createUseGroceriesCache,
  createUseGroceriesSubscription,
} from "@norish/shared-react/hooks/groceries";

import { useGroceriesErrorAdapter } from "./error-adapter";

const useGroceriesCacheHelpers = createUseGroceriesCache({ useTRPC });
const useSharedGroceriesSubscription = createUseGroceriesSubscription({
  useTRPC,
  useGroceriesCacheHelpers,
  useErrorAdapter: useGroceriesErrorAdapter,
});

export const useGroceriesSubscription = useSharedGroceriesSubscription;
