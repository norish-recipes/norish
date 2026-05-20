"use client";


import { createHouseholdHooks } from "@norish/shared-react/hooks";

import {
  useCurrentHouseholdUserId,
  useCurrentHouseholdUserName,
  useHouseholdToastAdapter,
} from "./adapters";

import { useTRPC } from "@/app/providers/trpc-provider";

export const sharedHouseholdHooks = createHouseholdHooks({
  useTRPC,
  useCurrentUserId: useCurrentHouseholdUserId,
  useCurrentUserName: useCurrentHouseholdUserName,
  useToastAdapter: useHouseholdToastAdapter,
});
