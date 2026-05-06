"use client";


import {
  createUseGroceriesCache,
  createUseGroceriesSubscription,
} from "@norish/shared-react/hooks/groceries";

import { useGroceriesErrorAdapter } from "./error-adapter";

import { useTRPC } from "@/app/providers/trpc-provider";

const useGroceriesCacheHelpers = createUseGroceriesCache({ useTRPC });
const useSharedGroceriesSubscription = createUseGroceriesSubscription({
  useTRPC,
  useGroceriesCacheHelpers,
  useErrorAdapter: useGroceriesErrorAdapter,
});

export const useGroceriesSubscription = useSharedGroceriesSubscription;
