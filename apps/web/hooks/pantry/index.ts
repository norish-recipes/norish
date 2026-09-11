"use client";

import { sharedPantryHooks } from "./shared-pantry-hooks";

export type { PantryMutationsResult, PantryQueryResult } from "@norish/shared-react/hooks";

export const { usePantryQuery, usePantryMutations, usePantrySubscription } = sharedPantryHooks;
