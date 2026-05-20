"use client";

import { createGroceriesHooks } from "@norish/shared-react/hooks";

import { useGroceriesErrorAdapter } from "./error-adapter";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useUnitsQuery } from "@/hooks/config";



export const sharedGroceriesHooks = createGroceriesHooks({
  useTRPC,
  useUnitsQuery,
  useErrorAdapter: useGroceriesErrorAdapter,
});
