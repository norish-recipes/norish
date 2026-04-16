"use client";

import { useTRPC } from "@/app/providers/trpc-provider";

import { createHouseholdHooks } from "@norish/shared-react/hooks";

import {
  useCurrentHouseholdUserId,
  useCurrentHouseholdUserName,
  useHouseholdToastAdapter,
} from "./adapters";

export const sharedHouseholdHooks = createHouseholdHooks({
  useTRPC,
  useCurrentUserId: useCurrentHouseholdUserId,
  useCurrentUserName: useCurrentHouseholdUserName,
  useToastAdapter: useHouseholdToastAdapter,
});
