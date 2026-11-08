"use client";

import { createHouseholdHooks } from "@norish/shared-react/hooks";
import { useTRPC } from "@norish/shared-react/trpc";

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
