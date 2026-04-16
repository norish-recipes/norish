"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useUnitsQuery } from "@/hooks/config";

import { createGroceriesHooks } from "@norish/shared-react/hooks";

import { useGroceriesErrorAdapter } from "./error-adapter";

export const sharedGroceriesHooks = createGroceriesHooks({
  useTRPC,
  useUnitsQuery,
  useErrorAdapter: useGroceriesErrorAdapter,
});
