"use client";

import { useUnitsQuery } from "@/hooks/config";

import { createGroceriesHooks } from "@norish/shared-react/hooks";
import { useTRPC } from "@norish/shared-react/trpc";

import { useGroceriesErrorAdapter } from "./error-adapter";

export const sharedGroceriesHooks = createGroceriesHooks({
  useTRPC,
  useUnitsQuery,
  useErrorAdapter: useGroceriesErrorAdapter,
});
