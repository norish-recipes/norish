"use client";

import { sharedHouseholdHooks } from "./shared-household-hooks";

export const useHouseholdQuery = sharedHouseholdHooks.useHouseholdQuery;

export type { HouseholdData, HouseholdQueryResult } from "@norish/shared-react/hooks";
